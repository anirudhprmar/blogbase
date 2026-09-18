#!/usr/bin/env bun
import { program } from "commander";
import pc from "picocolors";
import pkg from "../package.json";
import { findFiles } from "../core/scanner";
import { parseFile, type Post } from "../core/parser";
import { lookForLinks } from "../core/link";
import { applyLinks } from "../core/apply";

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

function lineDiff(original: string, modified: string): { removed: string; added: string } | null {
  const o = original.split("\n");
  const m = modified.split("\n");
  const len = Math.max(o.length, m.length);
  for (let i = 0; i < len; i++) {
    if (o[i] !== m[i]) {
      return { removed: o[i] ?? "", added: m[i] ?? "" };
    }
  }
  return null;
}

program
  .name("blogsbase")
  .description("Internal link analyzer for MDX blogs")
  .version(pkg.version);

program
  .command("analyze")
  .description("Analyze content directory for internal link opportunities")
  .argument("<path>", "directory to scan for .mdx files")
  .option("-j, --json", "output results as JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    if (!options.json) {
      console.log();
      console.log(`  ${pc.bold(pc.cyan("blogsbase"))} ${pc.dim("v" + program.version())}`);
      console.log();
    }

    const stop1 = options.json ? () => {} : spinner("Scanning for .mdx files...");
    const files = await findFiles(path);
    stop1();

    if (files.length === 0) {
      if (options.json) {
        console.log(
          JSON.stringify({ scanned: 0, suggestions: [], error: `No .mdx files found in ${path}` })
        );
        return;
      }
      console.log(`  ${pc.red("✕")} No .mdx files found in ${pc.bold(path)}`);
      console.log();
      return;
    }

    if (!options.json) {
      console.log(`  ${pc.green("✓")} Found ${pc.bold(String(files.length))} post${files.length > 1 ? "s" : ""}`);
    }

    const stop2 = options.json ? () => {} : spinner("Parsing frontmatter...");
    const posts: Post[] = [];
    for (const file of files) {
      const post = await parseFile(file);
      posts.push(post);
    }
    stop2();

    if (!options.json) {
      console.log(`  ${pc.green("✓")} Parsed ${pc.bold(String(posts.length))} posts`);
    }

    const stop3 = options.json ? () => {} : spinner("Analyzing link opportunities...");
    const suggestions = lookForLinks(posts);
    stop3();

    if (options.json) {
      console.log(
        JSON.stringify({
          scanned: posts.length,
          suggestions,
        })
      );
      return;
    }

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
      const s = suggestions[i]!;
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

program
  .command("apply")
  .description("Apply internal link suggestions to MDX files (preview by default)")
  .argument("<path>", "directory to scan for .mdx files")
  .option("--write", "write changes to files instead of previewing")
  .action(async (path: string, options: { write?: boolean }) => {
    console.log();
    console.log(`  ${pc.bold(pc.cyan("blogsbase"))} ${pc.dim("v" + program.version())}`);
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

    const stop4 = options.write ? spinner("Applying changes...") : spinner("Preparing preview...");
    const changes = await applyLinks(suggestions, !!options.write);
    stop4();
    console.log(`  ${pc.green("✓")} ${options.write ? "Applied" : "Preview generated"}`);
    console.log();

    if (changes.length === 0) {
      console.log(`  ${pc.yellow("›")} No link changes to ${options.write ? "apply" : "preview"}.`);
      console.log();
      return;
    }

    for (const change of changes) {
      console.log(`  ${pc.bold(pc.cyan(change.sourceFile))}`);
      const diff = lineDiff(change.original, change.modified);
      if (diff) {
        console.log(`    ${pc.red("−")} ${diff.removed}`);
        console.log(`    ${pc.green("+")} ${diff.added}`);
      }
      console.log();
    }

    console.log(`  ${pc.dim("─".repeat(50))}`);
    if (options.write) {
      console.log(
        `  ${pc.dim("Updated")} ${pc.bold(String(changes.length))} link${changes.length > 1 ? "s" : ""} in ${pc.bold(String(files.length))} post${files.length > 1 ? "s" : ""}`
      );
    } else {
      console.log(
        `  ${pc.dim("Preview")} ${pc.bold(String(changes.length))} link${changes.length > 1 ? "s" : ""} — run ${pc.cyan("--write")} to apply`
      );
    }
    console.log();
  });

program.parse();
