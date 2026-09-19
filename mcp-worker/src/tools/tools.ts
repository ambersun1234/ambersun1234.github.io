import { Env } from '../type/type'
import { executeBlogRAG } from './rag'

const searchRagCall = "search_blog_rag";

function list() {
  return {
    tools: [
      {
        name: searchRagCall,
        description: "use this RAG to search from ambersuncreates.com",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "what you want to ask about",
            },
          },
          required: ["query"],
        },
      },
    ],
  };
}

async function call(params: any, env: Env) {
  let result: any;

  switch (params.name) {
    case searchRagCall:
      const query = params.arguments?.query;
      if (!query) {
        throw new Error("Missing 'query' argument for search_blog_rag");
      }
      result = await executeBlogRAG(query, env);
      break;

    default:
      throw new Error(`Tool not found: ${params.name}`);
  }

  return result;
}

export { list, call };
