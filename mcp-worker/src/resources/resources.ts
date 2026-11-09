import { header } from "../const/const";
import { GitHubContentItem, Env } from "../type/type";

async function list(env: Env) {
  const { GITHUB_OWNER, GITHUB_REPO, BRANCH = "main", GITHUB_TOKEN } = env;

  const ghUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/trees/${BRANCH}?recursive=1`;
  const res = await fetch(ghUrl, { headers: header(GITHUB_TOKEN!) });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${errText}`);
  }

  const data: any = await res.json();
  const tree = data.tree || [];

  const markdownFiles = tree.filter((item: any) => 
    item.path.startsWith("_posts/") && 
    (item.path.endsWith(".md") || item.path.endsWith(".markdown"))
  );

  const resources = markdownFiles.map((f: any) => {
    const relativePath = f.path.replace("_posts/", "");
    return {
      uri: `blog://posts/${relativePath}`,
      name: f.path.split("/").pop() || f.path,
      mimeType: "text/markdown",
      description: `Blog post: ${f.path}`,
    };
  });

  return { resources };
}

async function read(params: any, env: Env) {
  const { GITHUB_OWNER, GITHUB_REPO, BRANCH = "main", GITHUB_TOKEN } = env;

  const uri = params?.uri as string;
  const match = uri ? uri.match(/^blog:\/\/posts\/(.+)$/) : null;
  if (!match) {
    throw new Error(`Invalid or missing resource URI: ${uri}`);
  }

  const filePath = match[1];
  const ghUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${BRANCH}/_posts/${filePath}`;

  const res = await fetch(ghUrl, { headers: header(GITHUB_TOKEN!) });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch post content for ${filePath}: ${res.status} ${res.statusText}`,
    );
  }

  const text = await res.text();

  return {
    contents: [
      {
        uri,
        mimeType: "text/markdown",
        text,
      },
    ],
  };
}

export { list, read };