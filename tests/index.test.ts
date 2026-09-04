import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CLI_PATH = join(import.meta.dir, '..', 'index.ts')

async function runCli(args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(['bun', 'run', CLI_PATH, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() }
}

describe('CLI', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'blogbase-cli-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should show version flag', async () => {
    const { stdout } = await runCli(['--version'])
    expect(stdout).toBe('0.1.0')
  })

  it('should show help text', async () => {
    const { stdout } = await runCli(['--help'])
    expect(stdout).toContain('blogbase')
    expect(stdout).toContain('directory path to look in')
  })

  it('should find .mdx files and print them', async () => {
    await writeFile(join(tempDir, 'hello.mdx'), '---\ntitle: Hello\n---\nBody')
    const { stdout, exitCode } = await runCli([tempDir])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Found 1 .mdx file(s):')
    expect(stdout).toContain('Hello')
    expect(stdout).toContain('path:')
  })

  it('should show "No .mdx files found" when directory is empty', async () => {
    const { stdout, exitCode } = await runCli([tempDir])
    expect(exitCode).toBe(0)
    expect(stdout).toBe('No .mdx files found.')
  })

  it('should find multiple .mdx files', async () => {
    await writeFile(join(tempDir, 'a.mdx'), '---\ntitle: A\n---\nContent A')
    await writeFile(join(tempDir, 'b.mdx'), '---\ntitle: B\n---\nContent B')
    const { stdout, exitCode } = await runCli([tempDir])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Found 2 .mdx file(s):')
    expect(stdout).toContain('A')
    expect(stdout).toContain('B')
  })

  it('should find .mdx files in nested directories', async () => {
    const nestedDir = join(tempDir, 'blog', 'posts')
    await mkdir(nestedDir, { recursive: true })
    await writeFile(join(nestedDir, 'post.mdx'), '---\ntitle: Post\n---\nBody')
    const { stdout, exitCode } = await runCli([tempDir])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Found 1 .mdx file(s):')
    expect(stdout).toContain('Post')
  })

  it('should not match .md files', async () => {
    await writeFile(join(tempDir, 'readme.md'), '# Hello')
    const { stdout } = await runCli([tempDir])
    expect(stdout).toBe('No .mdx files found.')
  })

  it('should error on non-existent path', async () => {
    const { exitCode } = await runCli([join(tempDir, 'nonexistent')])
    expect(exitCode).not.toBe(0)
  })
})
