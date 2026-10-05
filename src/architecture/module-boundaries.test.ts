import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { resolve, dirname, relative } from 'path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '../shared/ipc-channels'

const root = resolve(__dirname, '../..')
function files(directory: string): string[] {
  return readdirSync(directory).flatMap(name => {
    const path = resolve(directory, name)
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) && !name.includes('.test.') ? [path] : []
  })
}
const sources = files(resolve(root, 'src')).filter(p => !p.includes('/architecture/'))
const ast = new Map(sources.map(file => [file, ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)]))
const graph = new Map<string, string[]>()

function modulePath(file: string, specifier: string): string {
  const base = specifier.startsWith('@shared/') ? resolve(root, 'src/shared', specifier.slice(8))
    : specifier.startsWith('@services/') ? resolve(root, 'src/services', specifier.slice(10))
    : specifier.startsWith('.') ? resolve(dirname(file), specifier) : specifier
  if (base === specifier) return specifier
  return [base, base + '.ts', base + '.tsx', resolve(base, 'index.ts')].find(p => existsSync(p) && statSync(p).isFile()) ?? base
}

for (const [file, source] of ast) {
  const dependencies: string[] = []
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      const bindings = clause?.namedBindings
      const onlyTypes = clause?.isTypeOnly || (!clause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every(e => e.isTypeOnly))
      if (!onlyTypes) dependencies.push(modulePath(file, node.moduleSpecifier.text))
    } else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const onlyTypes = node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.every(e => e.isTypeOnly)
      if (!onlyTypes) dependencies.push(modulePath(file, node.moduleSpecifier.text))
    } else if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) dependencies.push(modulePath(file, node.arguments[0].text))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  graph.set(file, dependencies)
}

function reachable(start: string): Set<string> {
  const seen = new Set<string>()
  const walk = (file: string) => { if (seen.has(file)) return; seen.add(file); graph.get(file)?.forEach(walk) }
  walk(start)
  return seen
}

describe('architecture regression gates', () => {
  it('shared contracts do not depend on application layers; services do not depend on processes', () => {
    const violations: string[] = []
    for (const [file, dependencies] of graph) {
      const from = relative(root, file)
      for (const dependency of dependencies) {
        const to = relative(root, dependency)
        if (from.startsWith('src/shared/') && /^src\/(main|preload|renderer|services)\//.test(to)) violations.push(`${from} -> ${to}`)
        if (from.startsWith('src/services/') && /^src\/(main|preload|renderer)\//.test(to)) violations.push(`${from} -> ${to}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('domain cores remain independent of native clients and persistent adapters, transitively', () => {
    const cores = [
      'src/services/ai/completion-gateway.ts', 'src/services/ai/completion-pricing.ts',
      'src/services/ai/ai-configuration.ts', 'src/services/ai/deepseek-session.ts',
      'src/services/ai/json-process.ts', 'src/services/capture/capture-context.ts',
      'src/services/context/assistant-messages.ts',
      'src/services/work/work-coach-orchestrator.ts', 'src/services/work/work-coach-quiz-scheduler.ts',
      'src/services/work/work-coach-session-core.ts', 'src/services/work/work-coach-prompt.ts',
      'src/services/settings/settings-validation.ts', 'src/main/auto-capture-loop.ts',
      'src/services/settings/settings-repository.ts', 'src/services/settings/conversation-repository.ts',
      'src/services/settings/settings-migrations.ts', 'src/services/settings/lazy-settings-store.ts',
      'src/services/audio/transcription-service.ts', 'src/services/audio/whisper-configuration.ts',
      'src/services/capture/watch-frame.ts', 'src/services/capture/capture-preview.ts',
      'src/services/capture/capture-process.ts', 'src/services/ui/watch-frame-drag.ts',
      'src/services/audio/audio-format.ts', 'src/services/audio/transcript-buffer.ts',
      'src/main/ipc/input-validation.ts', 'src/main/ipc/rate-limiter.ts'
    ]
    const forbidden = new Set(['electron', 'electron-store', 'openai', '@cursor/sdk', 'child_process', 'fs', 'dotenv'])
    const violations: string[] = []
    for (const core of cores) {
      expect(ast.has(resolve(root, core)), core).toBe(true)
      for (const dependency of reachable(resolve(root, core))) {
        if (forbidden.has(dependency.replace(/^node:/, '')) || /\/services\/settings\/store\.ts$/.test(dependency)) violations.push(`${core} -> ${dependency}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('renderer runtime dependencies do not reach Node, Electron or provider clients', () => {
    const violations: string[] = []
    const forbidden = new Set(['electron', 'electron-store', 'fs', 'path', 'crypto', 'child_process', 'openai', '@cursor/sdk'])
    for (const file of sources.filter(p => p.includes('/src/renderer/'))) {
      for (const dependency of reachable(file)) {
        if (forbidden.has(dependency.replace(/^node:/, '')) || /\/src\/(main|preload)\//.test(dependency)) violations.push(`${relative(root, file)} -> ${dependency}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('service modules have no runtime dependency cycles', () => {
    const cycles: string[] = []
    const visited = new Set<string>()
    const stack = new Set<string>()
    function walk(file: string): void {
      if (!file.includes('/src/services/')) return
      if (stack.has(file)) { cycles.push(relative(root, file)); return }
      if (visited.has(file)) return
      visited.add(file); stack.add(file)
      graph.get(file)?.forEach(walk)
      stack.delete(file)
    }
    for (const file of graph.keys()) walk(file)
    expect(cycles).toEqual([])
  })

  it('every preload send/invoke has exactly one matching main registration', () => {
    const registrations = new Map<string, { kind: string; file: string }[]>()
    const requests: { channel: string; kind: string }[] = []
    function channel(node: ts.Expression): string | undefined {
      if (ts.isStringLiteral(node)) return node.text
      if (ts.isPropertyAccessExpression(node) && node.expression.getText() === 'IPC_CHANNELS') return IPC_CHANNELS[node.name.text as keyof typeof IPC_CHANNELS]
    }
    for (const [file, source] of ast) {
      function visit(node: ts.Node): void {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.arguments[0]) {
          const receiver = node.expression.expression.getText(source), method = node.expression.name.text
          const name = channel(node.arguments[0])
          if (name && receiver === 'ipcMain' && ['on', 'handle'].includes(method)) {
            registrations.set(name, [...(registrations.get(name) ?? []), { kind: method, file: relative(root, file) }])
          }
          if (name && receiver === 'ipcRenderer' && ['send', 'invoke'].includes(method)) requests.push({ channel: name, kind: method === 'send' ? 'on' : 'handle' })
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(requests.length).toBeGreaterThan(0)
    for (const request of requests) {
      const handlers = registrations.get(request.channel) ?? []
      expect(handlers, request.channel).toHaveLength(1)
      expect(handlers[0].kind, request.channel).toBe(request.kind)
    }
  })
})
