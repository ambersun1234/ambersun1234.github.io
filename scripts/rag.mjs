import fs from "fs";
import path from "path";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
const VECTORIZE_INDEX_NAME = "blog-vector-index";
const VECTORIZE_DIMENSIONS = 768;
const VECTORIZE_METRIC = process.env.VECTORIZE_METRIC || "cosine";

const postsDir = "./_posts/";

async function init() {
  console.log("🛠️ checking d1 table...");
  const initTableRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: `CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        content TEXT
      );`,
      }),
    },
  );
  const initTableData = await initTableRes.json();
  if (!initTableData.success) {
    console.error(
      "❌ Failed to initialize d1 table posts:",
      initTableData.errors,
    );
    process.exit(1);
  }
  console.log("✅ D1 ready");

  console.log("🛠️ checking vectorize index...");
  const getIndexRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX_NAME}`,
    { headers: { Authorization: `Bearer ${CF_API_TOKEN}` } },
  );

  if (getIndexRes.status === 200) {
    console.log("✅ vectorize index ready");
    return;
  }

  if (getIndexRes.status !== 404 && getIndexRes.status !== 410) {
    const errData = await getIndexRes.json().catch(() => ({}));
    console.error(
      "❌ Failed to check vectorize index:",
      errData.errors || getIndexRes.statusText,
    );
    process.exit(1);
  }

  console.log(`🛠️ vectorize index not found, creating [${VECTORIZE_INDEX_NAME}]...`);
  const createIndexRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: VECTORIZE_INDEX_NAME,
        config: { dimensions: VECTORIZE_DIMENSIONS, metric: VECTORIZE_METRIC },
      }),
    },
  );
  const createIndexData = await createIndexRes.json();
  if (!createIndexData.success) {
    console.error(
      "❌ Failed to create vectorize index:",
      createIndexData.errors,
    );
    process.exit(1);
  }
  console.log("✅ vectorize index ready");
}

async function main() {
  if (!CF_ACCOUNT_ID) {
    console.error("❌ CF_ACCOUNT_ID not set");
    process.exit(1);
  }

  if (!CF_API_TOKEN) {
    console.error("❌ CF_API_TOKEN not set");
    process.exit(1);
  }

  if (!D1_DATABASE_ID) {
    console.error("❌ D1_DATABASE_ID not set");
    process.exit(1);
  }

  await init();

  const files = fs.readdirSync(postsDir, { recursive: true });

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    const filePath = path.join(postsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const title = file.replace(".md", "");

    console.log(`🛠️ processing: ${title}...`);

    const embeddingRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/baai/bge-base-en-v1.5`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: [content] }),
      },
    );
    const embeddingData = await embeddingRes.json();
    if (!embeddingData.success) {
      console.error(
        `❌ Failed to generate embedding of [${title}]:`,
        embeddingData.errors,
      );
      continue;
    }
    const vector = embeddingData.result.data[0];

    const lookupRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sql: "SELECT id FROM posts WHERE title = ?",
          params: [title],
        }),
      },
    );
    const lookupData = await lookupRes.json();
    if (!lookupData.success) {
      console.error(
        `❌ Failed to look up existing post [${title}]:`,
        lookupData.errors,
      );
      continue;
    }
    const existing = lookupData.result?.[0]?.results?.[0];

    let postId;
    if (existing) {
      postId = existing.id.toString();
      const updateRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sql: "UPDATE posts SET content = ? WHERE id = ?",
            params: [content, existing.id],
          }),
        },
      );
      const updateData = await updateRes.json();
      if (!updateData.success) {
        console.error(
          `❌ Failed to update d1 of [${title}]:`,
          updateData.errors,
        );
        continue;
      }
      console.log(`⚠️ Successfully updated d1: ${title} (ID: ${postId})`);
    } else {
      const d1Res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sql: "INSERT INTO posts (title, content) VALUES (?, ?)",
            params: [title, content],
          }),
        },
      );
      const d1Data = await d1Res.json();
      if (!d1Data.success) {
        console.error(`❌ Failed to write into d1 of [${title}]:`, d1Data.errors);
        continue;
      }
      postId = d1Data.result[0].meta.last_row_id.toString();
      console.log(`✅ Successfully inserted d1: ${title} (ID: ${postId})`);
    }

    const ndjsonLine =
      JSON.stringify({
        id: postId,
        values: vector,
        metadata: { title },
      }) + "\n";

    const vectorizeRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX_NAME}/upsert`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/x-ndjson",
        },
        body: ndjsonLine,
      },
    );
    const vectorizeData = await vectorizeRes.json();
    if (!vectorizeData.success) {
      console.error(
        `❌ Failed to vectorize the post [${title}]:`,
        vectorizeData.errors,
      );
      continue;
    }

    console.log(`✅ Successfully synced vectorize: ${title} (ID: ${postId})`);
  }
}

(async () => {
  await main().catch(console.error);
})();
