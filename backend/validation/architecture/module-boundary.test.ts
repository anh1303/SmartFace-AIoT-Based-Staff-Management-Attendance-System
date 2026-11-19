import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

export interface BackendBoundaryCounts {
  pendingMoveCommonFiles: number;
  pendingMoveCommonUtilsExports: number;
  runtimeModuleCycles: number;
  transitionalExceptions: number;
  allowedCompositionPortExceptions: number;
}

export interface BackendBoundaryBaseline {
  phase: number;
  baselineSnapshot: string;
  initialCounts: BackendBoundaryCounts;
  currentCounts: BackendBoundaryCounts;
  commonFiles: Array<{
    path: string;
    owner: string;
    status: 'allowed' | 'pending-move';
    reason: string;
    representativeCallers: string[];
  }>;
  commonUtilsExports: Array<{
    exportName: string;
    owner: string;
    status: 'allowed' | 'pending-move';
    reason: string;
  }>;
  runtimeModuleCycles: Array<{
    cycle: string[];
    owner: string;
    status: 'allowed' | 'pending-move';
    reason: string;
  }>;
  exceptions: Array<{
    source: string;
    target: string;
    kind: 'bootstrap-deep-import' | 'composition-port-wiring' | 'cross-module-deep-import';
    owner: string;
    status: 'allowed' | 'pending-move';
    reason: string;
  }>;
}

export interface RawAstDependencyEdge {
  specifier: string;
  isTypeOnly: boolean;
  syntaxKind: 'import' | 'export-from' | 'dynamic-import';
}

export interface ResolvedBackendEdge extends RawAstDependencyEdge {
  source: string;
  target: string;
}

const PUBLIC_MODULE_ENTRIES = new Set(['public.ts', 'fingerprint.public.ts']);
const BOOTSTRAP_ROUTER_CONSUMERS = new Set(['routes.ts', 'server.ts']);

function toPosixRelative(fromRoot: string, fullPath: string): string {
  return path.relative(fromRoot, fullPath).replace(/\\/g, '/');
}

function walkTsFiles(dirPath: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === 'dist') continue;
      results.push(...walkTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }
  return results.sort();
}

export function extractAstDependencyEdges(fileName: string, sourceText: string): RawAstDependencyEdge[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const edges: RawAstDependencyEdge[] = [];

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      let isTypeOnly = false;
      if (node.importClause) {
        if (node.importClause.isTypeOnly) {
          isTypeOnly = true;
        } else if (
          !node.importClause.name &&
          node.importClause.namedBindings &&
          ts.isNamedImports(node.importClause.namedBindings)
        ) {
          const elements = node.importClause.namedBindings.elements;
          if (elements.length > 0 && elements.every(el => el.isTypeOnly)) {
            isTypeOnly = true;
          }
        }
      }
      edges.push({
        specifier: node.moduleSpecifier.text,
        isTypeOnly,
        syntaxKind: 'import',
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      let isTypeOnly = Boolean(node.isTypeOnly);
      if (!isTypeOnly && node.exportClause && ts.isNamedExports(node.exportClause)) {
        const elements = node.exportClause.elements;
        if (elements.length > 0 && elements.every(el => el.isTypeOnly)) {
          isTypeOnly = true;
        }
      }
      edges.push({
        specifier: node.moduleSpecifier.text,
        isTypeOnly,
        syntaxKind: 'export-from',
      });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      edges.push({
        specifier: node.arguments[0].text,
        isTypeOnly: false,
        syntaxKind: 'dynamic-import',
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return edges;
}

export function resolveBackendSpecifier(
  fromRelPath: string,
  specifier: string,
  knownFiles: ReadonlySet<string>,
): string | null {
  let candidateRel: string;
  if (specifier.startsWith('@/')) {
    candidateRel = specifier.slice(2);
  } else if (specifier.startsWith('src/')) {
    candidateRel = specifier.slice(4);
  } else if (specifier.startsWith('.')) {
    const fromDir = path.posix.dirname(fromRelPath);
    candidateRel = path.posix.normalize(path.posix.join(fromDir, specifier));
  } else {
    return null;
  }

  const stripped = candidateRel.replace(/\.(js|ts)$/, '');
  for (const suffix of ['.ts', '/index.ts']) {
    const attempt = `${stripped}${suffix}`;
    if (knownFiles.has(attempt)) {
      return attempt;
    }
  }
  if (knownFiles.has(candidateRel)) {
    return candidateRel;
  }
  return null;
}

function getModuleName(relPath: string): string | null {
  if (!relPath.startsWith('modules/')) return null;
  const parts = relPath.split('/');
  return parts.length >= 3 ? parts[1] : null;
}

function getModuleSubpath(relPath: string): string | null {
  if (!relPath.startsWith('modules/')) return null;
  const parts = relPath.split('/');
  return parts.length >= 3 ? parts.slice(2).join('/') : null;
}

export function classifyBackendEdges(
  edges: ResolvedBackendEdge[],
  baselineExceptions: BackendBoundaryBaseline['exceptions'],
) {
  const commonToModuleViolations: ResolvedBackendEdge[] = [];
  const moduleBoundaryViolations: Array<ResolvedBackendEdge & { kind: string }> = [];
  const matchedExceptionKeys = new Set<string>();

  const exceptionMap = new Map<string, BackendBoundaryBaseline['exceptions'][number]>();
  for (const ex of baselineExceptions) {
    exceptionMap.set(`${ex.source} -> ${ex.target}`, ex);
  }

  for (const edge of edges) {
    if (edge.source.startsWith('common/') && edge.target.startsWith('modules/') && !edge.isTypeOnly) {
      commonToModuleViolations.push(edge);
      continue;
    }

    const srcMod = getModuleName(edge.source);
    const dstMod = getModuleName(edge.target);
    if (!dstMod || srcMod === dstMod) continue;

    const dstSubpath = getModuleSubpath(edge.target);
    if (!dstSubpath) continue;

    if (PUBLIC_MODULE_ENTRIES.has(dstSubpath)) {
      continue;
    }
    if (dstSubpath === 'index.ts' && BOOTSTRAP_ROUTER_CONSUMERS.has(edge.source)) {
      continue;
    }

    const key = `${edge.source} -> ${edge.target}`;
    const matchedException = exceptionMap.get(key);
    if (matchedException) {
      matchedExceptionKeys.add(key);
      continue;
    }

    const kind =
      edge.source === 'composition.ts'
        ? 'composition-port-wiring'
        : BOOTSTRAP_ROUTER_CONSUMERS.has(edge.source)
          ? 'bootstrap-deep-import'
          : 'cross-module-deep-import';

    moduleBoundaryViolations.push({ ...edge, kind });
  }

  const staleExceptions = baselineExceptions.filter(
    ex => !matchedExceptionKeys.has(`${ex.source} -> ${ex.target}`),
  );

  return {
    commonToModuleViolations,
    moduleBoundaryViolations,
    staleExceptions,
  };
}

export function findElementaryCycles(adjacency: Map<string, Set<string>>): string[][] {
  const nodes = [...adjacency.keys()].sort();
  const seenCanonical = new Set<string>();
  const cycles: string[][] = [];

  function canonicalizeCycle(loopNodes: string[]): string[] {
    let minIdx = 0;
    for (let i = 1; i < loopNodes.length; i++) {
      if (loopNodes[i] < loopNodes[minIdx]) minIdx = i;
    }
    const rotated = [...loopNodes.slice(minIdx), ...loopNodes.slice(0, minIdx)];
    return [...rotated, rotated[0]];
  }

  for (const startNode of nodes) {
    const stack: string[] = [startNode];
    const onPath = new Set<string>([startNode]);

    function dfs(current: string) {
      const neighbors = [...(adjacency.get(current) ?? [])].sort();
      for (const next of neighbors) {
        if (next === startNode && stack.length > 1) {
          const canonical = canonicalizeCycle(stack);
          const key = canonical.join(' -> ');
          if (!seenCanonical.has(key)) {
            seenCanonical.add(key);
            cycles.push(canonical);
          }
        } else if (next > startNode && !onPath.has(next)) {
          onPath.add(next);
          stack.push(next);
          dfs(next);
          stack.pop();
          onPath.delete(next);
        }
      }
    }

    dfs(startNode);
  }

  return cycles.sort((a, b) => a.join(' -> ').localeCompare(b.join(' -> ')));
}

function extractTopLevelExports(fileName: string, sourceText: string): string[] {
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const names: string[] = [];
  for (const stmt of sf.statements) {
    const isExported = stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!isExported) continue;
    if ((ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt) || ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isEnumDeclaration(stmt)) && stmt.name) {
      names.push(stmt.name.text);
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          names.push(decl.name.text);
        }
      }
    }
  }
  return names;
}

describe('Backend Modular Monolith Architecture Boundaries', () => {
  const srcRoot = path.resolve(__dirname, '../../src');
  const baselinePath = path.resolve(__dirname, './boundary-baseline.json');
  const baseline: BackendBoundaryBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

  it('recognizes valid public imports, relative deep imports, alias deep imports, invalid re-exports, dynamic imports, and stale allowlist entries', () => {
    const knownFiles = new Set([
      'modules/attendance/attendance.service.ts',
      'modules/employees/public.ts',
      'modules/employees/employee.service.ts',
      'modules/biometrics/fingerprint.public.ts',
      'modules/biometrics/biometric.service.ts',
      'common/helper.ts',
      'server.ts',
    ]);

    const sampleSource = `
      import { findEmployeeById } from '../employees/public.js';
      import { verifyFingerprint } from '../biometrics/fingerprint.public.js';
      import { internalEmp } from '../employees/employee.service.js';
      import { aliasInternal } from '@/modules/biometrics/biometric.service.js';
      export { reExportedInternal } from '../employees/employee.service.js';
      async function loadDynamic() {
        return import('../biometrics/biometric.service.js');
      }
    `;

    const rawEdges = extractAstDependencyEdges('attendance.service.ts', sampleSource);
    const resolvedEdges: ResolvedBackendEdge[] = rawEdges
      .map(edge => {
        const target = resolveBackendSpecifier('modules/attendance/attendance.service.ts', edge.specifier, knownFiles);
        return target ? { ...edge, source: 'modules/attendance/attendance.service.ts', target } : null;
      })
      .filter((e): e is ResolvedBackendEdge => e !== null);

    const commonEdge: ResolvedBackendEdge = {
      source: 'common/helper.ts',
      target: 'modules/employees/public.ts',
      specifier: '../modules/employees/public.js',
      isTypeOnly: false,
      syntaxKind: 'import',
    };

    const classification = classifyBackendEdges(
      [...resolvedEdges, commonEdge],
      [
        {
          source: 'server.ts',
          target: 'modules/biometrics/biometric.service.ts',
          kind: 'bootstrap-deep-import',
          owner: 'biometrics',
          status: 'pending-move',
          reason: 'Unused test exception to verify stale detection',
        },
      ],
    );

    expect(classification.commonToModuleViolations).toHaveLength(1);
    expect(classification.commonToModuleViolations[0]).toMatchObject({
      source: 'common/helper.ts',
      target: 'modules/employees/public.ts',
    });

    expect(classification.moduleBoundaryViolations.map(v => ({
      target: v.target,
      syntaxKind: v.syntaxKind,
      kind: v.kind,
    }))).toEqual([
      {
        target: 'modules/employees/employee.service.ts',
        syntaxKind: 'import',
        kind: 'cross-module-deep-import',
      },
      {
        target: 'modules/biometrics/biometric.service.ts',
        syntaxKind: 'import',
        kind: 'cross-module-deep-import',
      },
      {
        target: 'modules/employees/employee.service.ts',
        syntaxKind: 'export-from',
        kind: 'cross-module-deep-import',
      },
      {
        target: 'modules/biometrics/biometric.service.ts',
        syntaxKind: 'dynamic-import',
        kind: 'cross-module-deep-import',
      },
    ]);

    expect(classification.staleExceptions).toHaveLength(1);
    expect(classification.staleExceptions[0].source).toBe('server.ts');
  });

  it('keeps currentCounts synchronized with manifest entries and never above frozen initialCounts', () => {
    const liveCounts: BackendBoundaryCounts = {
      pendingMoveCommonFiles: baseline.commonFiles.filter(f => f.status === 'pending-move').length,
      pendingMoveCommonUtilsExports: baseline.commonUtilsExports.filter(e => e.status === 'pending-move').length,
      runtimeModuleCycles: baseline.runtimeModuleCycles.length,
      transitionalExceptions: baseline.exceptions.filter(e => e.status === 'pending-move').length,
      allowedCompositionPortExceptions: baseline.exceptions.filter(e => e.status === 'allowed').length,
    };

    expect(liveCounts).toEqual(baseline.currentCounts);
    expect(baseline.currentCounts.pendingMoveCommonFiles).toBeLessThanOrEqual(
      baseline.initialCounts.pendingMoveCommonFiles,
    );
    expect(baseline.currentCounts.pendingMoveCommonUtilsExports).toBeLessThanOrEqual(
      baseline.initialCounts.pendingMoveCommonUtilsExports,
    );
    expect(baseline.currentCounts.runtimeModuleCycles).toBeLessThanOrEqual(
      baseline.initialCounts.runtimeModuleCycles,
    );
    expect(baseline.currentCounts.transitionalExceptions).toBeLessThanOrEqual(
      baseline.initialCounts.transitionalExceptions,
    );

    if (baseline.phase >= 2) {
      expect(baseline.currentCounts.pendingMoveCommonFiles).toBe(0);
      expect(baseline.currentCounts.pendingMoveCommonUtilsExports).toBe(0);
      expect(baseline.currentCounts.runtimeModuleCycles).toBe(0);
      expect(baseline.currentCounts.transitionalExceptions).toBe(0);
      for (const ex of baseline.exceptions) {
        expect(ex.status).toBe('allowed');
        expect(ex.kind).toBe('composition-port-wiring');
      }
    }
  });

  it('classifies every file in src/common/ and every export in src/common/utils.ts without unclassified or stale entries', () => {
    const commonDir = path.join(srcRoot, 'common');
    const actualCommonFiles = fs
      .readdirSync(commonDir)
      .filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map(name => `common/${name}`)
      .sort();

    const baselineCommonPaths = baseline.commonFiles.map(f => f.path).sort();
    expect(actualCommonFiles).toEqual(baselineCommonPaths);

    for (const entry of baseline.commonFiles) {
      expect(entry.owner.trim().length).toBeGreaterThan(0);
      expect(entry.reason.trim().length).toBeGreaterThan(0);
      expect(['allowed', 'pending-move']).toContain(entry.status);
    }

    const utilsPath = path.join(commonDir, 'utils.ts');
    const actualExports = extractTopLevelExports('utils.ts', fs.readFileSync(utilsPath, 'utf8')).sort();
    const baselineExports = baseline.commonUtilsExports.map(e => e.exportName).sort();
    expect(actualExports).toEqual(baselineExports);

    for (const exp of baseline.commonUtilsExports) {
      expect(exp.owner.trim().length).toBeGreaterThan(0);
      expect(exp.reason.trim().length).toBeGreaterThan(0);
      expect(['allowed', 'pending-move']).toContain(exp.status);
    }
  });

  it('blocks runtime common -> modules imports, enforces public module contracts, and rejects stale exceptions', () => {
    const allFiles = walkTsFiles(srcRoot);
    const knownRelFiles = new Set(allFiles.map(f => toPosixRelative(srcRoot, f)));
    const allResolvedEdges: ResolvedBackendEdge[] = [];

    for (const fullPath of allFiles) {
      const relSource = toPosixRelative(srcRoot, fullPath);
      const rawEdges = extractAstDependencyEdges(relSource, fs.readFileSync(fullPath, 'utf8'));
      for (const edge of rawEdges) {
        const target = resolveBackendSpecifier(relSource, edge.specifier, knownRelFiles);
        if (target) {
          allResolvedEdges.push({
            ...edge,
            source: relSource,
            target,
          });
        }
      }
    }

    const { commonToModuleViolations, moduleBoundaryViolations, staleExceptions } = classifyBackendEdges(
      allResolvedEdges,
      baseline.exceptions,
    );

    expect(commonToModuleViolations).toEqual([]);
    expect(moduleBoundaryViolations).toEqual([]);
    expect(staleExceptions).toEqual([]);
  });

  it('tracks runtime module cycles (excluding type-only edges) and blocks any new cycle', () => {
    const allFiles = walkTsFiles(srcRoot);
    const knownRelFiles = new Set(allFiles.map(f => toPosixRelative(srcRoot, f)));
    const runtimeAdjacency = new Map<string, Set<string>>();

    for (const fullPath of allFiles) {
      const relSource = toPosixRelative(srcRoot, fullPath);
      const srcMod = getModuleName(relSource);
      if (!srcMod) continue;
      if (!runtimeAdjacency.has(srcMod)) {
        runtimeAdjacency.set(srcMod, new Set());
      }

      const rawEdges = extractAstDependencyEdges(relSource, fs.readFileSync(fullPath, 'utf8'));
      for (const edge of rawEdges) {
        if (edge.isTypeOnly) continue;
        const target = resolveBackendSpecifier(relSource, edge.specifier, knownRelFiles);
        if (!target) continue;
        const dstMod = getModuleName(target);
        if (dstMod && dstMod !== srcMod) {
          runtimeAdjacency.get(srcMod)!.add(dstMod);
        }
      }
    }

    const actualCycles = findElementaryCycles(runtimeAdjacency).map(c => c.join(' -> '));
    const baselineCycles = baseline.runtimeModuleCycles
      .map(c => c.cycle.join(' -> '))
      .sort((a, b) => a.localeCompare(b));

    expect(actualCycles).toEqual(baselineCycles);
  });
});
