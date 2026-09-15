import { file } from "bun";
import matter from "gray-matter";

export type Post = {
  title: string;
  slug: string;
  description?: string;
  content: string;
  path: string;
};

export async function parseFile(path: string): Promise<Post> {
  const mdxFile = file(path);
  const rawContent = await mdxFile.text();
  const { data, content } = matter(rawContent);

  return {
    title: data.title ?? "",
    slug: data.slug ?? "",
    description: data.description,
    content,
    path,
  };
}