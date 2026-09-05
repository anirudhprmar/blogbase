import type { Post } from "./parser";

export type LinkSuggestion = {
  sourceFile: string;
  targetPost: string;
  matchedText: string;
  confidence: number;
};

export function lookForLinks(posts: Post[]) {
  const suggestions: LinkSuggestion[] = []
  const suggestedTargets = new Map<string, Set<string>>()
    
  for (const post of posts) {
    for (const target of posts) {
      if (post.path === target.path) continue;

      const alreadySuggested = suggestedTargets.get(post.path)?.has(target.path);
      if (alreadySuggested) continue;
      
      const content = cleanContent(post.content).toLowerCase()
      const title = target.title.toLowerCase()
      const start = content.indexOf(title);

      if (start !== -1) {
        if (!suggestedTargets.has(post.path)) {
          suggestedTargets.set(post.path, new Set());
        }
        suggestedTargets.get(post.path)!.add(target.path);

        suggestions.push({
          sourceFile: post.path,
          targetPost: target.path,
          matchedText: title,
          confidence: calculateScore(content, title)
        })
      }
    }
  }

  return suggestions
}
    

function calculateScore(content: string, title:string) {
  const nContent = normalize(content);
  const nTitle = normalize(title);

  if (nContent.includes(nTitle)) {
    return 100;
  }

  const titleWords = new Set(nTitle.split(" "));
  const contentWords = new Set(nContent.split(" "));

  const matchedWords = [...titleWords].filter(word => contentWords.has(word))

  return(matchedWords.length / titleWords.size) * 100
}

function cleanContent(content: string): string {
  let cleaned = content;

  cleaned = cleaned.replace(/^---\n[\s\S]*?\n---\n?/m, "");
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
  cleaned = cleaned.replace(/`[^`]+`/g, "");
  cleaned = cleaned.replace(/\[[^\]]+\]\([^)]+\)/g, "");
  cleaned = cleaned.replace(/^#{1,6}\s+.+$/gm, "");
  cleaned = cleaned.replace(/^-\s+.+$/gm, "");

  return cleaned;
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim()
}