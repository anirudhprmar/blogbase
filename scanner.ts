import { opendir } from 'node:fs/promises'
import { join } from 'node:path'

export async function findFiles(dirPath: string): Promise<string[]> {
  const dir = await opendir(dirPath, { recursive: true })
  const matchedFiles: string[] = [];

  for await (const entry of dir) {
    if (entry.isFile() && entry.name.endsWith('.mdx')) {
      const fullPath = join(entry.parentPath, entry.name);
      matchedFiles.push(fullPath);
    }
  }
  return matchedFiles;
}