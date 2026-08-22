export interface Env {
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  BRANCH?: string;
  GITHUB_TOKEN?: string;

  AI: {
    run(model: string, input: any): Promise<any>;
  };
  VECTOR_INDEX: {
    query(vector: number[], options?: { topK?: number }): Promise<{
      matches: Array<{ id: string; score: number; metadata?: any }>;
    }>;
    upsert(vectors: Array<{ id: string; values: number[]; metadata?: any }>): Promise<any>;
  };
  DB: {
    prepare(query: string): {
      bind(...args: any[]): {
        all(): Promise<{ results: any[] }>;
        first(): Promise<any>;
        run(): Promise<any>;
      };
    };
  };
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