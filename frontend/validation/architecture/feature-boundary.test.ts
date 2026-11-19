import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

export interface FrontendBoundaryCounts {
  pendingMoveContextFiles: number;
  pendingMoveTypeFiles: number;
  pendingMoveUtilFiles: number;
  pendingMoveFeatureEdges: number;
  featureCycles: number;
  transitionalExceptions: number;
}

export interface FrontendBoundaryBaseline {
  phase: number;
  baselineSnapshot: string;
  initialCounts: FrontendBoundaryCounts;
  currentCounts: FrontendBoundaryCounts;
  contextFiles: Array<{
    path: string;
    owner: string;
    status: 'allowed' | 'pending-move';
    reason: string;
  }>;
  typeFiles: Array<{
    path: string;
    owner: string;
    status: 'allowed' | 'pending-move';
    reason: string;
  }>;
  utilFiles: Array<{
    path: string;
    owner: string;
    status: 'allowed' | 'pending-move';
    reason: string;
  }>;
  featureDependencyMatrix: Array<{
    source: string;
    target: string;
    owner: string;
    status: 'allowed' | 'pending-move';
    reason: string;
  }>;
  featureCycles: Array<{
    cycle: string[];
    owner: string;
    status: 'allowed' | 'pending-move';
    reason: string;
  }>;
  exceptions: Array<{
    source: string;
    target: string;
    kind: string;
    owner: string;
    status: 'allowed' | 'pending-move';
    reason: string;
  }>;
}

export interface RawFrontendAstEdge {
  specifier: string;
  isTypeOnly: boolean;
  syntaxKind: 'import' | 'export-from' | 'dynamic-import';
}

export interface ResolvedFrontendEdge extends RawFrontendAstEdge {
  source: string;
  target: string;
}

function toPosixRelative(fromRoot: string, fullPath: string): string {
  return path.relative(fromRoot, fullPath).replace(/\\/g, '/');
}

function walkFrontendFiles(dirPath: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules' || entry.name === 'dist') continue;
      results.push(...walkFrontendFiles(full));
    } else if (
      (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx') &&
      !entry.name.endsWith('.d.ts')
    ) {
      results.push(full);
    }
  }
  return results.sort();
}

export function extractFrontendAstEdges(fileName: string, sourceText: string): RawFrontendAstEdge[] {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const edges: RawFrontendAstEdge[] = [];

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

export function resolveFrontendSpecifier(
  fromRelPath: string,
  specifier: string,
  knownFiles: ReadonlySet<string>,
): string | null {
  if (/(?:^|\/)backend(?:\/|$)/.test(specifier)) {
    return `__BACKEND__:${specifier}`;
  }

  let candidateRel: string;
  if (specifier.startsWith('@/')) {
    candidateRel = specifier.slice(2);
  } else if (specifier.startsWith('.')) {
    const fromDir = path.posix.dirname(fromRelPath);
    candidateRel = path.posix.normalize(path.posix.join(fromDir, specifier));
    if (candidateRel.startsWith('../')) {
      return `__EXTERNAL__:${candidateRel}`;
    }
  } else {
    return null;
  }

  const stripped = candidateRel.replace(/\.(js|jsx|ts|tsx)$/, '');
  for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
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

function getFeatureName(relPath: string): string | null {
  if (!relPath.startsWith('features/')) return null;
  const parts = relPath.split('/');
  return parts.length >= 3 ? parts[1] : null;
}

function getFeatureSubpath(relPath: string): string | null {
  if (!relPath.startsWith('features/')) return null;
  const parts = relPath.split('/');
  return parts.length >= 3 ? parts.slice(2).join('/') : null;
}

export function classifyFrontendEdges(
  edges: ResolvedFrontendEdge[],
  baselineExceptions: FrontendBoundaryBaseline['exceptions'],
) {
  const backendImportViolations: ResolvedFrontendEdge[] = [];
  const sharedToFeatureViolations: ResolvedFrontendEdge[] = [];
  const featureDeepImportViolations: ResolvedFrontendEdge[] = [];
  const matchedExceptionKeys = new Set<string>();

  const exceptionMap = new Map<string, FrontendBoundaryBaseline['exceptions'][number]>();
  for (const ex of baselineExceptions) {
    exceptionMap.set(`${ex.source} -> ${ex.target}`, ex);
  }

  for (const edge of edges) {
    if (edge.target.startsWith('__BACKEND__:') || edge.target.startsWith('__EXTERNAL__:../backend')) {
      backendImportViolations.push(edge);
      continue;
    }

    const key = `${edge.source} -> ${edge.target}`;
    if (exceptionMap.has(key)) {
      matchedExceptionKeys.add(key);
      continue;
    }

    if (
      (edge.source.startsWith('components/common/') || edge.source.startsWith('utils/')) &&
      edge.target.startsWith('features/') &&
      !edge.isTypeOnly
    ) {
      sharedToFeatureViolations.push(edge);
    }

    const srcFeature = getFeatureName(edge.source);
    const dstFeature = getFeatureName(edge.target);
    if (dstFeature && srcFeature !== dstFeature) {
      const subpath = getFeatureSubpath(edge.target);
      if (subpath !== 'index.ts' && subpath !== 'index.tsx') {
        featureDeepImportViolations.push(edge);
      }
    }
  }

  const staleExceptions = baselineExceptions.filter(
    ex => !matchedExceptionKeys.has(`${ex.source} -> ${ex.target}`),
  );

  return {
    backendImportViolations,
    sharedToFeatureViolations,
    featureDeepImportViolations,
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

describe('Frontend Feature-Based Architecture Boundaries', () => {
  const srcRoot = path.resolve(__dirname, '../../src');
  const baselinePath = path.resolve(__dirname, './boundary-baseline.json');
  const baseline: FrontendBoundaryBaseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

  it('recognizes valid public imports, relative deep imports, alias deep imports, invalid re-exports, backend imports, and stale allowlist entries', () => {
    const knownFiles = new Set([
      'features/employees/components/EmployeeOverviewTab.tsx',
      'features/biometrics/index.ts',
      'features/biometrics/api/biometricApi.ts',
      'features/auth/index.ts',
      'features/auth/lib/faceLoginRequest.ts',
      'components/common/Toast.tsx',
      'features/notifications/index.ts',
    ]);

    const sampleFeatureSource = `
      import { BiometricSection } from '@/features/biometrics';
      import { faceLoginApi } from '../../auth';
      import { enrollFace } from '../../biometrics/api/biometricApi';
      import type { TimeoutConfig } from '@/features/auth/lib/faceLoginRequest';
      export { rawBiometric } from '../../biometrics/api/biometricApi';
      import { backendUtil } from '../../../../backend/src/common/utils';
    `;

    const rawEdges = extractFrontendAstEdges('EmployeeOverviewTab.tsx', sampleFeatureSource);
    const resolvedEdges: ResolvedFrontendEdge[] = rawEdges
      .map(edge => {
        const target = resolveFrontendSpecifier(
          'features/employees/components/EmployeeOverviewTab.tsx',
          edge.specifier,
          knownFiles,
        );
        return target
          ? {
              ...edge,
              source: 'features/employees/components/EmployeeOverviewTab.tsx',
              target,
            }
          : null;
      })
      .filter((e): e is ResolvedFrontendEdge => e !== null);

    const sharedRuntimeEdge: ResolvedFrontendEdge = {
      source: 'components/common/Toast.tsx',
      target: 'features/notifications/index.ts',
      specifier: '../../features/notifications',
      isTypeOnly: false,
      syntaxKind: 'import',
    };

    const result = classifyFrontendEdges(
      [...resolvedEdges, sharedRuntimeEdge],
      [
        {
          source: 'context/AuthContext.tsx',
          target: 'features/auth/lib/faceLoginRequest.ts',
          kind: 'feature-deep-import',
          owner: 'auth',
          status: 'pending-move',
          reason: 'Stale test exception',
        },
      ],
    );

    expect(result.backendImportViolations).toHaveLength(1);
    expect(result.sharedToFeatureViolations).toHaveLength(1);
    expect(result.sharedToFeatureViolations[0]).toMatchObject({
      source: 'components/common/Toast.tsx',
      target: 'features/notifications/index.ts',
    });

    expect(result.featureDeepImportViolations.map(v => ({
      target: v.target,
      syntaxKind: v.syntaxKind,
      isTypeOnly: v.isTypeOnly,
    }))).toEqual([
      {
        target: 'features/biometrics/api/biometricApi.ts',
        syntaxKind: 'import',
        isTypeOnly: false,
      },
      {
        target: 'features/auth/lib/faceLoginRequest.ts',
        syntaxKind: 'import',
        isTypeOnly: true,
      },
      {
        target: 'features/biometrics/api/biometricApi.ts',
        syntaxKind: 'export-from',
        isTypeOnly: false,
      },
    ]);

    expect(result.staleExceptions).toHaveLength(1);
    expect(result.staleExceptions[0].source).toBe('context/AuthContext.tsx');
  });

  it('keeps currentCounts synchronized with manifest entries and never above frozen initialCounts', () => {
    const liveCounts: FrontendBoundaryCounts = {
      pendingMoveContextFiles: baseline.contextFiles.filter(f => f.status === 'pending-move').length,
      pendingMoveTypeFiles: baseline.typeFiles.filter(f => f.status === 'pending-move').length,
      pendingMoveUtilFiles: baseline.utilFiles.filter(f => f.status === 'pending-move').length,
      pendingMoveFeatureEdges: baseline.featureDependencyMatrix.filter(e => e.status === 'pending-move').length,
      featureCycles: baseline.featureCycles.length,
      transitionalExceptions: baseline.exceptions.filter(e => e.status === 'pending-move').length,
    };

    expect(liveCounts).toEqual(baseline.currentCounts);
    expect(baseline.currentCounts.pendingMoveContextFiles).toBeLessThanOrEqual(
      baseline.initialCounts.pendingMoveContextFiles,
    );
    expect(baseline.currentCounts.pendingMoveTypeFiles).toBeLessThanOrEqual(
      baseline.initialCounts.pendingMoveTypeFiles,
    );
    expect(baseline.currentCounts.pendingMoveUtilFiles).toBeLessThanOrEqual(
      baseline.initialCounts.pendingMoveUtilFiles,
    );
    expect(baseline.currentCounts.pendingMoveFeatureEdges).toBeLessThanOrEqual(
      baseline.initialCounts.pendingMoveFeatureEdges,
    );
    expect(baseline.currentCounts.featureCycles).toBeLessThanOrEqual(baseline.initialCounts.featureCycles);
    expect(baseline.currentCounts.transitionalExceptions).toBeLessThanOrEqual(
      baseline.initialCounts.transitionalExceptions,
    );

    if (baseline.phase >= 2) {
      expect(baseline.currentCounts.pendingMoveContextFiles).toBe(0);
      expect(baseline.currentCounts.pendingMoveTypeFiles).toBe(0);
      expect(baseline.currentCounts.pendingMoveUtilFiles).toBe(0);
      expect(baseline.currentCounts.pendingMoveFeatureEdges).toBe(0);
      expect(baseline.currentCounts.featureCycles).toBe(0);
      expect(baseline.currentCounts.transitionalExceptions).toBe(0);
      expect(baseline.contextFiles.map(f => f.path).sort()).toEqual([
        'context/AppContext.tsx',
        'context/ThemeContext.tsx',
        'context/ToastContext.tsx',
        'context/index.ts',
      ]);
    }
  });

  it('classifies every file in src/context/, src/types/, and src/utils/ without unclassified or stale entries', () => {
    const checkDirectoryInventory = (
      dirName: 'context' | 'types' | 'utils',
      manifestEntries: Array<{ path: string; owner: string; status: 'allowed' | 'pending-move'; reason: string }>,
    ) => {
      const fullDir = path.join(srcRoot, dirName);
      const actualFiles = fs
        .readdirSync(fullDir, { withFileTypes: true })
        .filter(
          entry =>
            entry.isFile() &&
            (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
            !entry.name.endsWith('.test.ts') &&
            !entry.name.endsWith('.test.tsx'),
        )
        .map(entry => `${dirName}/${entry.name}`)
        .sort();

      const manifestPaths = manifestEntries.map(e => e.path).sort();
      expect(actualFiles).toEqual(manifestPaths);

      for (const item of manifestEntries) {
        expect(item.owner.trim().length).toBeGreaterThan(0);
        expect(item.reason.trim().length).toBeGreaterThan(0);
        expect(['allowed', 'pending-move']).toContain(item.status);
      }
    };

    checkDirectoryInventory('context', baseline.contextFiles);
    checkDirectoryInventory('types', baseline.typeFiles);
    checkDirectoryInventory('utils', baseline.utilFiles);
  });

  it('blocks backend imports, runtime components/common or utils -> features imports, and deep imports into features', () => {
    const allFiles = walkFrontendFiles(srcRoot);
    const knownRelFiles = new Set(allFiles.map(f => toPosixRelative(srcRoot, f)));
    const allResolvedEdges: ResolvedFrontendEdge[] = [];

    for (const fullPath of allFiles) {
      const relSource = toPosixRelative(srcRoot, fullPath);
      const rawEdges = extractFrontendAstEdges(relSource, fs.readFileSync(fullPath, 'utf8'));
      for (const edge of rawEdges) {
        const target = resolveFrontendSpecifier(relSource, edge.specifier, knownRelFiles);
        if (target) {
          allResolvedEdges.push({
            ...edge,
            source: relSource,
            target,
          });
        }
      }
    }

    const {
      backendImportViolations,
      sharedToFeatureViolations,
      featureDeepImportViolations,
      staleExceptions,
    } = classifyFrontendEdges(allResolvedEdges, baseline.exceptions);

    expect(backendImportViolations).toEqual([]);
    expect(sharedToFeatureViolations).toEqual([]);
    expect(featureDeepImportViolations).toEqual([]);
    expect(staleExceptions).toEqual([]);
  });

  it('enforces the directed feature dependency matrix (including type imports) and blocks feature cycles', () => {
    const allFiles = walkFrontendFiles(srcRoot);
    const knownRelFiles = new Set(allFiles.map(f => toPosixRelative(srcRoot, f)));
    const actualFeatureEdges = new Set<string>();
    const featureAdjacency = new Map<string, Set<string>>();

    for (const fullPath of allFiles) {
      const relSource = toPosixRelative(srcRoot, fullPath);
      const srcFeature = getFeatureName(relSource);
      if (!srcFeature) continue;
      if (!featureAdjacency.has(srcFeature)) {
        featureAdjacency.set(srcFeature, new Set());
      }

      const rawEdges = extractFrontendAstEdges(relSource, fs.readFileSync(fullPath, 'utf8'));
      for (const edge of rawEdges) {
        const target = resolveFrontendSpecifier(relSource, edge.specifier, knownRelFiles);
        if (!target) continue;
        const dstFeature = getFeatureName(target);
        if (dstFeature && dstFeature !== srcFeature) {
          actualFeatureEdges.add(`${srcFeature} -> ${dstFeature}`);
          featureAdjacency.get(srcFeature)!.add(dstFeature);
        }
      }
    }

    const expectedFeatureEdges = baseline.featureDependencyMatrix
      .map(e => `${e.source} -> ${e.target}`)
      .sort();

    expect([...actualFeatureEdges].sort()).toEqual(expectedFeatureEdges);

    const actualCycles = findElementaryCycles(featureAdjacency).map(c => c.join(' -> '));
    const expectedCycles = baseline.featureCycles.map(c => c.cycle.join(' -> ')).sort();
    expect(actualCycles).toEqual(expectedCycles);
  });
});
