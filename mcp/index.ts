#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import pkg from "../package.json";
import { findFiles } from "../core/scanner";
import { parseFile } from "../core/parser";
import { lookForLinks } from "../core/link";
import { applyLinks } from "../core/apply";

const server = new McpServer({
  name: "blogbase",
  version: pkg.version,
});

async function loadContent(contentPath: string) {
  const files = await findFiles(contentPath);
  const posts = [];
  for (const file of files) {
    posts.push(await parseFile(file));
  }
  return posts;
}

server.tool(
  "analyze",
  "Analyze a content directory for internal link opportunities between MDX posts",
  { contentPath: z.string().describe("Path to the content directory of .mdx files") },
  async ({ contentPath }) => {
    try {
      const posts = await loadContent(contentPath);
      const suggestions = lookForLinks(posts);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ scanned: posts.length, suggestions }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "preview",
  "Preview the internal link changes that would be applied to MDX files (no files are modified)",
  { contentPath: z.string().describe("Path to the content directory of .mdx files") },
  async ({ contentPath }) => {
    try {
      const posts = await loadContent(contentPath);
      const suggestions = lookForLinks(posts);
      const changes = await applyLinks(suggestions, false);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(changes, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "listPosts",
  "List all MDX posts in a content directory with their titles, slugs, and paths",
  { contentPath: z.string().describe("Path to the content directory of .mdx files") },
  async ({ contentPath }) => {
    try {
      const posts = await loadContent(contentPath);
      const list = posts.map((p) => ({
        title: p.title,
        slug: p.slug,
        path: p.path,
        description: p.description,
      }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(list, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);