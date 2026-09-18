import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CLI_PATH = join(import.meta.dir, '..', 'cli', 'index.ts')

function stripAnsi(input: string): string {
  return input.replace(/\u001B\[[0-9;]*m/g, '')
}

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(['bun', 'run', CLI_PATH, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  return { exitCode, stdout: stripAnsi(stdout).trim(), stderr: stripAnsi(stderr).trim() }
}

describe('CLI', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'blogsbase-cli-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should show version flag', async () => {
    const { stdout } = await runCli(['--version'])
    expect(stdout).toBe('0.2.0')
  })

  it('should show help text', async () => {
    const { stdout } = await runCli(['--help'])
    expect(stdout).toContain('blogsbase')
    expect(stdout).toContain('analyze')
    expect(stdout).toContain('Internal link analyzer')
  })

  it('should find .mdx files and show link suggestions', async () => {
    await writeFile(join(tempDir, 'hello.mdx'), '---\ntitle: Hello\n---\nA post mentioning the World.')
    await writeFile(join(tempDir, 'world.mdx'), '---\ntitle: World\n---\nContent')
    const { stdout, exitCode } = await runCli(['analyze', tempDir])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Found 2 posts')
    expect(stdout).toContain('1 suggestion')
    expect(stdout).toContain('Match "world"')
  })

  it('should show "No .mdx files found" when directory is empty', async () => {
    const { stdout, exitCode } = await runCli(['analyze', tempDir])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('No .mdx files found')
  })

  it('should find multiple .mdx files', async () => {
    await writeFile(join(tempDir, 'a.mdx'), '---\ntitle: A\n---\nContent about B project')
    await writeFile(join(tempDir, 'b.mdx'), '---\ntitle: B\n---\nContent B')
    const { stdout, exitCode } = await runCli(['analyze', tempDir])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Found 2 posts')
    expect(stdout).toContain('Match "b"')
  })

  it('should find .mdx files in nested directories', async () => {
    const nestedDir = join(tempDir, 'blog', 'posts')
    await mkdir(nestedDir, { recursive: true })
    await writeFile(join(nestedDir, 'post.mdx'), '---\ntitle: Post\n---\nMentions the Guide.')
    await writeFile(join(tempDir, 'guide.mdx'), '---\ntitle: Guide\n---\nContent')
    const { stdout, exitCode } = await runCli(['analyze', tempDir])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Found 2 posts')
    expect(stdout).toContain('Match "guide"')
  })

  it('should not match .md files', async () => {
    await writeFile(join(tempDir, 'readme.md'), '# Hello')
    const { stdout } = await runCli(['analyze', tempDir])
    expect(stdout).toContain('No .mdx files found')
  })

  it('should error on non-existent path', async () => {
    const { exitCode } = await runCli(['analyze', join(tempDir, 'nonexistent')])
    expect(exitCode).not.toBe(0)
  })

  it('should output valid JSON with --json flag', async () => {
    await writeFile(join(tempDir, 'a.mdx'), '---\ntitle: A\n---\nAbout the B project.')
    await writeFile(join(tempDir, 'b.mdx'), '---\ntitle: B\n---\nContent B')
    const { stdout, exitCode } = await runCli(['analyze', tempDir, '--json'])
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout)
    expect(parsed.scanned).toBe(2)
    expect(Array.isArray(parsed.suggestions)).toBe(true)
    expect(parsed.suggestions[0]).toMatchObject({
      sourceFile: join(tempDir, 'a.mdx'),
      targetPost: join(tempDir, 'b.mdx'),
      matchedText: 'b',
      confidence: 100,
    })
  })

  it('should output JSON error when no .mdx files found with --json flag', async () => {
    const { stdout, exitCode } = await runCli(['analyze', tempDir, '--json'])
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout)
    expect(parsed.scanned).toBe(0)
    expect(parsed.suggestions).toEqual([])
    expect(parsed.error).toContain('No .mdx files found')
  })
})
