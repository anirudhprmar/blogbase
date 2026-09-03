import type { Post } from "./parser";

type LinkSuggestion = {
  sourceFile: string;
  targetPost: string;
  text: string;
  confidence: number;
};

export function lookForLinks(posts: Post[]) {
  const suggestions: LinkSuggestion[] = []
    
  for (const post of posts) {
    for (const target of posts) {
      if (post.path === target.path) continue;
      
      const content = target.content.toLowerCase()
      const title = target.content.toLowerCase()

      const start = content.indexOf(title);

      if (start !== -1) {
        suggestions.push({
          sourceFile: post.path,
          targetPost: target.path,
          text: post.title,
          confidence: calculateScore(content,title)
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

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim()
}