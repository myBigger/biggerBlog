import { BLOG_PATH } from "@/content.config";
import { slugifyStr } from "./slugify";

/**
 * Get full path of a blog post
 * @param id - id of the blog post (filename without extension)
 * @param filePath - the blog post full file location
 * @param includeBase - whether to include `/posts` in return value
 * @param customSlug - URL slug from frontmatter; falls back to id segment
 * @returns blog post path
 */
export function getPath(
  id: string,
  filePath: string | undefined,
  includeBase = true,
  customSlug?: string
) {
  const pathSegments = filePath
    ?.replace(BLOG_PATH, "")
    .split("/")
    .filter(path => path !== "") // remove empty string in the segments ["", "other-path"] <- empty string will be removed
    .filter(path => !path.startsWith("_")) // exclude directories start with underscore "_"
    .slice(0, -1) // remove the last segment_ file name_ since it's unnecessary
    .map(segment => slugifyStr(segment)); // slugify each segment path

  const basePath = includeBase ? "/posts" : "";

  // Making sure `id` does not contain the directory
  const blogId = id.split("/");
  const slugFromId = blogId.length > 0 ? blogId.slice(-1) : blogId;
  const slug = customSlug ?? slugFromId;

  // If not inside the sub-dir, simply return the file path
  if (!pathSegments || pathSegments.length < 1) {
    return [basePath, slug].join("/");
  }

  return [basePath, ...pathSegments, slug].join("/");
}
