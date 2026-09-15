import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Subprocess } from 'bun'

const MCP_PATH = join(import.meta.dir, '..', 'mcp', 'index.ts')

class MCPSession {
  proc: Subprocess<'pipe', 'pipe', 'pipe'>
  pending: string[] = []
  private nextId = 1

  constructor() {
    this.proc = Bun.spawn(['bun', 'run', MCP_PATH], {
      stdout: 'pipe',
      stdin: 'pipe',
      stderr: 'pipe',
    })
    const decoder = new TextDecoder()
    let buf = ''
    const consume = async () => {
      for await (const chunk of this.proc.stdout) {
        buf += decoder.decode(chunk)
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        this.pending.push(...lines.filter((l) => l.trim()))
      }
    }
    consume()
  }

  async request(method: string, params?: unknown): Promise<any> {
    const id = this.nextId++
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      const idx = this.pending.findIndex((l) => {
        try {
          return JSON.parse(l).id === id
        } catch {
          return false
        }
      })
      if (idx !== -1) {
        return JSON.parse(this.pending.splice(idx, 1)[0]!)
      }
      await Bun.sleep(10)
    }
    throw new Error(`timeout waiting for response to ${method}`)
  }

  async initialize() {
    const res = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0.0.1' },
    })
    await this.request('notifications/initialized', {})
    return res
  }

  async callTool(name: string, arguments_: Record<string, unknown>): Promise<any> {
    const res = await this.request('tools/call', { name, arguments: arguments_ })
    return res.result
  }

  async close() {
    this.proc.kill()
    await this.proc.exited
  }
}

describe('MCP', () => {
  let tempDir: string
  let session: MCPSession

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'blogbase-mcp-test-'))
    await writeFile(join(tempDir, 'a.mdx'), '---\ntitle: A\nslug: a\n---\nA post referencing the B post.')
    await writeFile(join(tempDir, 'b.mdx'), '---\ntitle: B\nslug: b\n---\nContent B')
    session = new MCPSession()
    await session.initialize()
  })

  afterEach(async () => {
    await session.close()
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should advertise the blogbase server name', async () => {
    const res = await session.initialize()
    expect(res.result.serverInfo.name).toBe('blogbase')
    expect(res.result.serverInfo.version).toBe('0.2.0')
  })

  it('should expose analyze, preview, and listPosts tools', async () => {
    const res = await session.request('tools/list')
    const names = res.result.tools.map((t: any) => t.name)
    expect(names).toEqual(['analyze', 'preview', 'listPosts'])
  })

  it('should list posts with listPosts', async () => {
    const result = await session.callTool('listPosts', { contentPath: tempDir })
    const list = JSON.parse(result.content[0].text)
    expect(list).toHaveLength(2)
    expect(list.map((p: any) => p.title).sort()).toEqual(['A', 'B'])
  })

  it('should return link suggestions with analyze', async () => {
    const result = await session.callTool('analyze', { contentPath: tempDir })
    const out = JSON.parse(result.content[0].text)
    expect(out.scanned).toBe(2)
    expect(out.suggestions[0]).toMatchObject({
      sourceFile: join(tempDir, 'a.mdx'),
      targetPost: join(tempDir, 'b.mdx'),
      targetSlug: 'b',
      matchedText: 'b',
      confidence: 100,
    })
  })

  it('should preview changes without modifying files', async () => {
    const before = await readFile(join(tempDir, 'a.mdx'), 'utf-8')
    const result = await session.callTool('preview', { contentPath: tempDir })
    const changes = JSON.parse(result.content[0].text)
    expect(changes).toHaveLength(1)
    expect(changes[0].slug).toBe('b')
    expect(changes[0].modified).toContain('[B](/b)')
    const after = await readFile(join(tempDir, 'a.mdx'), 'utf-8')
    expect(after).toBe(before)
  })

  it('should return an error for a missing content path', async () => {
    const result = await session.callTool('analyze', {
      contentPath: join(tempDir, 'nonexistent'),
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Error')
  })
})