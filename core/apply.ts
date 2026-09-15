import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import type { LinkSuggestion } from "./link";

export type ApplyResult = {
  sourceFile: string;
  original: string;
  modified: string;
  slug: string;
  match: string;
};

export async function applyLinks(
  suggestions: LinkSuggestion[],
  write: boolean
): Promise<ApplyResult[]> {
  const byFile = new Map<string, LinkSuggestion[]>();
  for (const s of suggestions) {
    const list = byFile.get(s.sourceFile) ?? [];
    list.push(s);
    byFile.set(s.sourceFile, list);
  }

  const results: ApplyResult[] = [];

  for (const [filePath, fileSuggestions] of byFile) {
    const original = await readFile(filePath, "utf-8");
    let content = original;

    for (const s of fileSuggestions) {
      const slug = s.targetSlug || basename(s.targetPost, ".mdx");
      const regex = new RegExp(escapeRegex(s.originalMatch), "i");
      const replacement = `[${s.originalMatch}](/${slug})`;

      const newContent = content.replace(regex, replacement);
      if (newContent !== content) {
        results.push({
          sourceFile: filePath,
          original: content,
          modified: newContent,
          slug,
          match: s.originalMatch,
        });
        content = newContent;
      }
    }

    if (write && content !== original) {
      await writeFile(filePath, content, "utf-8");
    }
  }

  return results;
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
