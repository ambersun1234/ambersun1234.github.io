export interface Env {
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  BRANCH?: string;
  GITHUB_TOKEN?: string;
}

export interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  id?: string | number | null;
  params?: any;
}

export interface GitHubContentItem {
  name: string;
  path: string;
  download_url?: string;
}