import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { findFiles } from '../scanner'

describe('findFiles', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'blog-engine-test-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should return an empty array for a directory with no .mdx files', async () => {
    await writeFile(join(tempDir, 'readme.md'), '# Hello')
    const files = await findFiles(tempDir)
    expect(files).toEqual([])
  })

  it('should find .mdx files in the root directory', async () => {
    await writeFile(join(tempDir, 'hello.mdx'), '---\ntitle: Hello\n---')
    await writeFile(join(tempDir, 'world.mdx'), '---\ntitle: World\n---')
    const files = await findFiles(tempDir)
    expect(files.length).toBe(2)
    expect(files.every((f) => f.endsWith('.mdx'))).toBe(true)
  })

  it('should find .mdx files in nested directories', async () => {
    const nestedDir = join(tempDir, 'blog', 'posts')
    await mkdir(nestedDir, { recursive: true })
    await writeFile(join(nestedDir, 'post.mdx'), '---\ntitle: Post\n---')
    const files = await findFiles(tempDir)
    expect(files.length).toBe(1)
    expect(files[0]).toContain('post.mdx')
  })

  it('should not match .md files', async () => {
    await writeFile(join(tempDir, 'readme.md'), '# Hello')
    await writeFile(join(tempDir, 'notes.mdx'), '---')
    const files = await findFiles(tempDir)
    expect(files.length).toBe(1)
    expect(files[0]).toContain('notes.mdx')
  })

  it('should not match files with mdx in the middle of the name', async () => {
    await writeFile(join(tempDir, 'notmdx.txt'), 'content')
    await writeFile(join(tempDir, 'actual.mdx'), 'content')
    const files = await findFiles(tempDir)
    expect(files.length).toBe(1)
    expect(files[0]).toContain('actual.mdx')
  })

  it('should handle empty directories', async () => {
    const emptyDir = join(tempDir, 'empty')
    await mkdir(emptyDir)
    const files = await findFiles(emptyDir)
    expect(files).toEqual([])
  })

  it('should return full paths for found files', async () => {
    await writeFile(join(tempDir, 'test.mdx'), 'content')
    const files = await findFiles(tempDir)
    expect(files[0]).toBe(join(tempDir, 'test.mdx'))
  })

  it('should throw for non-existent directory', async () => {
    await expect(findFiles(join(tempDir, 'nonexistent'))).rejects.toThrow()
  })
})
