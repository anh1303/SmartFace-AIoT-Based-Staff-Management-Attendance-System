import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

const root = path.resolve('src/modules')
function violations(file: string, text: string) {
  const owner = path.relative(root, file).split(path.sep)[0]
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const result: string[] = []
  function visit(node: ts.Node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text
      if (specifier.startsWith('.')) {
        const target = path.resolve(path.dirname(file), specifier)
        const relative = path.relative(root, target).split(path.sep)
        const allowed = relative.length === 2 && (relative[1] === 'public.js' || relative[0] === 'biometrics' && relative[1] === 'fingerprint.public.js')
        if (!relative[0].startsWith('..') && relative[0] !== owner && !allowed) result.push(`${file}: ${specifier}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return result
}

it('rejects internal cross-module imports, including type-only imports and re-exports', () => {
  const file = path.join(root, 'attendance', 'example.ts')
  expect(violations(file, "import type { X } from '../payroll/private.js'; export { y } from '../shifts/private.js' ")).toHaveLength(2)
  expect(violations(file, "import { x } from '../payroll/public.js' ")).toEqual([])
  expect(violations(file, "import { x } from '../payroll/internal/public.js' ")).toHaveLength(1)
})

it('keeps cross-module imports behind public contracts', () => {
  const problems: string[] = []
  function walk(dir: string) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name)
      if (item.isDirectory()) walk(file)
      else if (file.endsWith('.ts')) problems.push(...violations(file, readFileSync(file, 'utf8')))
    }
  }
  walk(root)
  expect(problems).toEqual([])
})

function findCycles(graph: Map<string, Set<string>>): string[] {
  const visiting = new Set<string>(), visited = new Set<string>(), cycles: string[] = []
  function visit(name: string, chain: string[]) {
    if (visiting.has(name)) { cycles.push([...chain, name].join(' -> ')); return }
    if (visited.has(name)) return
    visiting.add(name)
    for (const next of graph.get(name) ?? []) visit(next, [...chain, name])
    visiting.delete(name)
    visited.add(name)
  }
  for (const name of graph.keys()) visit(name, [])
  return cycles
}

it('detects runtime cycles while allowing a one-way dependency', () => {
  expect(findCycles(new Map([['a', new Set(['b'])], ['b', new Set(['a'])]]))).not.toEqual([])
  expect(findCycles(new Map([['a', new Set(['b'])], ['b', new Set()]]))).toEqual([])
})

it('keeps the runtime module dependency graph acyclic', () => {
  const graph = new Map<string, Set<string>>()
  function walk(dir: string) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name)
      if (item.isDirectory()) { walk(file); continue }
      if (!file.endsWith('.ts')) continue
      const owner = path.relative(root, file).split(path.sep)[0]
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      for (const node of source.statements) {
        if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue
        if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly || ts.isExportDeclaration(node) && node.isTypeOnly) continue
        if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier) || !node.moduleSpecifier.text.startsWith('.')) continue
        const target = path.relative(root, path.resolve(path.dirname(file), node.moduleSpecifier.text)).split(path.sep)
        if (target[0].startsWith('..') || target[0] === owner) continue
        if (!graph.has(owner)) graph.set(owner, new Set())
        graph.get(owner)!.add(target[0])
      }
    }
  }
  walk(root)
  expect(findCycles(graph)).toEqual([])
})

it('keeps runtime source imports acyclic across module and shared files', () => {
  const graph = new Map<string, Set<string>>()
  const sourceRoot = path.resolve('src')
  function walk(dir: string) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name)
      if (item.isDirectory()) { if (item.name !== '__tests__') walk(file); continue }
      if (!file.endsWith('.ts')) continue
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      for (const node of source.statements) {
        if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue
        if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly || ts.isExportDeclaration(node) && node.isTypeOnly) continue
        if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier) || !node.moduleSpecifier.text.startsWith('.')) continue
        const target = path.resolve(path.dirname(file), node.moduleSpecifier.text.replace(/\.js$/, '.ts'))
        if (!graph.has(file)) graph.set(file, new Set())
        graph.get(file)!.add(target)
      }
    }
  }
  walk(sourceRoot)
  expect(findCycles(graph).map(cycle => cycle.replaceAll(sourceRoot + path.sep, ''))).toEqual([])
})
