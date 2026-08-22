import { Env } from '../type/type'

async function executeBlogRAG(query: string, env: Env) {
  const embeddingResponse = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
    text: [query],
  });
  const vector = embeddingResponse.data[0];

  const matches = await env.VECTOR_INDEX.query(vector, { topK: 3 });

  if (!matches.matches || matches.matches.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No related content found in ambersuncreates.com",
        },
      ],
    };
  }

  const ids = matches.matches.map((m: any) => m.id);
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT title, content FROM posts WHERE id IN (${placeholders})`
  ).bind(...ids).all();

  const formattedText = results
    .map((r: any) => `### Title: ${r.title}\n${r.content}`)
    .join("\n\n---\n\n");

  return {
    content: [
      {
        type: "text",
        text: `Found the following content:\n\n${formattedText}`,
      },
    ],
  };
}

export { executeBlogRAG }