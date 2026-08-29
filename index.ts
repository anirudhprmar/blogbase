import { program } from "commander";
import { findFiles } from "./scanner";

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
    files.forEach((file) => console.log(`  ${file}`));
  })

program.parse()