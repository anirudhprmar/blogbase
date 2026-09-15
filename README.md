## blogbase

Internal link analyzer for MDX blogs. Scans your content directory, finds where one post mentions another post's title, and suggests (or applies) internal links. Ships a CLI and a read-only MCP server for agents.

> Requires [Bun](https://bun.sh) (>= 1.0). The package ships raw TypeScript and runs exclusively on the Bun runtime.

### Install

```bash
bun add -g blogbase        # install CLI globally
bun add blogbase           # or scope it to a project
```

Use it from an agent or one-off:

```bash
bunx blogbase analyze ./content
bunx blogbase-mcp           # MCP server over stdio
```

### Commands

#### `analyze`

Scan a directory for `.mdx` files and find link opportunities.

```bash
blogbase analyze ./content
```

With JSON output for scripting / MCP integration:

```bash
blogbase analyze ./content --json
```

JSON output:

```json
{
  "scanned": 12,
  "suggestions": [
    {
      "sourceFile": "content/react.mdx",
      "targetPost": "content/hooks.mdx",
      "targetSlug": "hooks",
      "matchedText": "hooks",
      "originalMatch": "Hooks",
      "confidence": 100
    }
  ]
}
```

#### `apply`

Apply link suggestions to your MDX files. Preview by default (no files modified).

```bash
blogbase apply ./content          # preview changes
blogbase apply ./content --write  # write changes to disk
```

Preview output:

```
  content/react.mdx
    − React applications can use Server Components.
    + React applications can use [Server Components](/react-server-components).

  Preview 1 link — run --write to apply
```

Running `apply` is idempotent — it won't double-link text that already has a link.

### MCP server

`blogbase-mcp` exposes the analyzer as a read-only Model Context Protocol server over stdio, so agents (Claude, Cursor, opencode, etc.) can inspect your posts and link opportunities without modifying files.

```bash
blogbase-mcp
```

Add it to your client's MCP configuration:

```json
{
  "mcpServers": {
    "blogbase": {
      "command": "bunx",
      "args": ["blogbase-mcp"]
    }
  }
}
```

Tools (all take `contentPath` per call):

| Tool        | Purpose                                            |
| ----------- | -------------------------------------------------- |
| `analyze`   | Return link suggestions (same shape as `--json`)   |
| `preview`   | Diff of what `apply` would change — never writes   |
| `listPosts` | List post titles, slugs, and paths                 |

The MCP server is read-only by design. To commit changes, agents invoke the CLI (`blogbase apply --write`) themselves.

### How it works

1. Scans for `.mdx` files recursively
2. Parses frontmatter (`title`, `slug`) from each file
3. Searches each post's body for mentions of other posts' titles
4. Scores matches by confidence
5. `apply` replaces matched text with `[title](/slug)` markdown links