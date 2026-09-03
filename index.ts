import { program } from "commander";
import { findFiles } from "./scanner";
import { parseFile, type Post } from "./parser";
import { lookForLinks } from "./link";

program
  .name('blog-engine')
  .description('looking for markdown files')
  .version('0.1.0')
  .argument('<path>', 'directory path to look in')
  .action(async (path: string) => {
    const files = await findFiles(path);
    if (files.length === 0) {
      console.log('No .mdx files found.');
      return;
    }
    console.log(`Found ${files.length} .mdx file(s):\n`);
    
    const posts: Post[] = [];
    
    for (const file of files) {
      const post = await parseFile(file);
      posts.push(post);
      console.log(`  ${post.title || file}`);
      console.log(`    path: ${post.path}`);
      if (post.description) {
        console.log(`    description: ${post.description}`);
      }
    }
    const suggestions = lookForLinks(posts)
    if (suggestions.length > 0) {
      console.log(suggestions);
    }
  })

program.parse()