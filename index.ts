import { program } from "commander";
import pc from "picocolors";
import { findFiles } from "./scanner";
import { parseFile, type Post } from "./parser";
import { lookForLinks } from "./link";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function spinner(message: string): () => void {
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write(`\r  ${pc.cyan(FRAMES[i++ % FRAMES.length])} ${message}`);
  }, 80);
  return () => {
    clearInterval(id);
    process.stdout.write("\r" + " ".repeat(message.length + 4) + "\r");
  };
}

function bar(score: number): string {
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  const color = score >= 80 ? pc.green : score >= 50 ? pc.yellow : pc.red;
  return color("█".repeat(filled)) + pc.dim("░".repeat(empty));
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function confidenceLabel(score: number): string {
  if (score >= 100) return pc.green("high");
  if (score >= 60) return pc.yellow("medium");
  return pc.red("low");
}

program
  .name("blogbase")
  .description("Internal link analyzer for MDX blogs")
  .version("0.1.0");

program
  .command("analyze")
  .description("Analyze content directory for internal link opportunities")
  .argument("<path>", "directory to scan for .mdx files")
  .action(async (path: string) => {
    console.log();
    console.log(`  ${pc.bold(pc.cyan("blogbase"))} ${pc.dim("v" + program.version())}`);
    console.log();

    const stop1 = spinner("Scanning for .mdx files...");
    const files = await findFiles(path);
    stop1();

    if (files.length === 0) {
      console.log(`  ${pc.red("✕")} No .mdx files found in ${pc.bold(path)}`);
      console.log();
      return;
    }

    console.log(`  ${pc.green("✓")} Found ${pc.bold(String(files.length))} post${files.length > 1 ? "s" : ""}`);

    const stop2 = spinner("Parsing frontmatter...");
    const posts: Post[] = [];
    for (const file of files) {
      const post = await parseFile(file);
      posts.push(post);
    }
    stop2();
    console.log(`  ${pc.green("✓")} Parsed ${pc.bold(String(posts.length))} posts`);

    const stop3 = spinner("Analyzing link opportunities...");
    const suggestions = lookForLinks(posts);
    stop3();
    console.log(`  ${pc.green("✓")} Analysis complete`);
    console.log();

    if (suggestions.length === 0) {
      console.log(`  ${pc.yellow("›")} No link suggestions found. Add more posts to discover opportunities.`);
      console.log();
      return;
    }

    console.log(
      `  ${pc.bold(pc.white(suggestions.length + " suggestion" + (suggestions.length > 1 ? "s" : "") + " found"))}`
    );
    console.log(`  ${pc.dim("─".repeat(50))}`);
    console.log();

    const maxTitle = 36;

    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      const sourceName = truncate(s.sourceFile, maxTitle);
      const targetName = truncate(s.targetPost, maxTitle);
      const matched = truncate(s.matchedText, 32);
      const num = pc.dim(`#${i + 1}`);

      console.log(`    ${pc.bold(pc.cyan("Suggestion"))} ${num}`);
      console.log(`    ${pc.dim("From")}  ${pc.white(sourceName)}`);
      console.log(`    ${pc.dim("To")}    ${pc.white(targetName)}`);
      console.log(`    ${pc.dim("Match")} ${pc.bold(pc.green(`"${matched}"`))}`);
      console.log(
        `    ${pc.dim("Confidence")}  ${bar(s.confidence)} ${pc.bold(String(Math.round(s.confidence)))} ${confidenceLabel(s.confidence)}`
      );
      console.log();
    }

    console.log(`  ${pc.dim("─".repeat(50))}`);
    console.log(
      `  ${pc.dim("Scanned")} ${pc.bold(String(posts.length))} posts → ${pc.bold(String(suggestions.length))} opportunities`
    );
    console.log();
  });

program.parse();
