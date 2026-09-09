## blogbase

Internal link analyzer for MDX blogs. Scans your content directory, finds where one post mentions another post's title, and suggests (or applies) internal links.

### Install

```bash
bun install
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

### How it works

1. Scans for `.mdx` files recursively
2. Parses frontmatter (`title`, `slug`) from each file
3. Searches each post's body for mentions of other posts' titles
4. Scores matches by confidence
5. `apply` replaces matched text with `[title](/slug)` markdown links