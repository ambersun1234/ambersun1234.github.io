import fs from "fs";
import path from "path";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
const VECTORIZE_INDEX_NAME = "blog-vector-index";
const VECTORIZE_DIMENSIONS = 1024;
const VECTORIZE_METRIC = process.env.VECTORIZE_METRIC || "cosine";
const MAX_CHUNK_CHARS = 2000;
const SEQUENCE_TOO_LONG_CODE = 3030;
const DELETE_BATCH_SIZE = 500;

const postsDir = "./_posts/";

function chunkText(text, maxChars) {
  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (para.length <= maxChars) {
      current = para;
    } else {
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
    }
  }

  if (current) chunks.push(current);
  return chunks.filter((c) => c.trim().length > 0);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function embedWithTruncation(label, text) {
  let candidate = text;

  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/baai/bge-m3`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: [candidate] }),
      },
    );
    const data = await res.json();
    if (data.success) {
      if (candidate.length !== text.length) {
        console.log(
          `⚠️ [${label}] embedded a truncated version (${candidate.length}/${text.length} chars) due to sequence length limit`,
        );
      }
      return data;
    }

    const tooLong = data.errors?.some(
      (e) => e.code === SEQUENCE_TOO_LONG_CODE,
    );
    if (!tooLong) {
      return data;
    }

    candidate = candidate.slice(0, Math.floor(candidate.length * 0.8));
    console.log(
      `⚠️ [${label}] embedding input too long, retrying with ${candidate.length} chars...`,
    );
  }

  return { success: false, errors: [{ message: "exceeded truncation retry attempts" }] };
}

async function d1Query(sql, params) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  return res.json();
}

async function init() {
  console.log("🛠️ checking d1 table...");
  const initTableData = await d1Query(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    chunk_index INTEGER DEFAULT 0,
    content TEXT
  );`);
  if (!initTableData.success) {
    console.error(
      "❌ Failed to initialize d1 table posts:",
      initTableData.errors,
    );
    process.exit(1);
  }

  const alterData = await d1Query(
    "ALTER TABLE posts ADD COLUMN chunk_index INTEGER DEFAULT 0;",
  );
  if (!alterData.success) {
    const alreadyExists = alterData.errors?.some((e) =>
      /duplicate column/i.test(e.message || ""),
    );
    if (!alreadyExists) {
      console.error("❌ Failed to migrate posts table:", alterData.errors);
      process.exit(1);
    }
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

  // 404 = never existed, 410 = existed but was deleted — both mean "create it"
  if (getIndexRes.status !== 404 && getIndexRes.status !== 410) {
    const errData = await getIndexRes.json().catch(() => ({}));
    console.error(
      `❌ Failed to check vectorize index (HTTP ${getIndexRes.status}):`,
      JSON.stringify(errData.errors || getIndexRes.statusText),
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

    const lookupData = await d1Query("SELECT id FROM posts WHERE title = ?", [
      title,
    ]);
    if (!lookupData.success) {
      console.error(
        `❌ Failed to look up existing chunks for [${title}]:`,
        lookupData.errors,
      );
      continue;
    }
    const existingIds = (lookupData.result?.[0]?.results || []).map((r) =>
      r.id.toString(),
    );

    if (existingIds.length > 0) {
      for (const batch of chunk(existingIds, DELETE_BATCH_SIZE)) {
        const deleteVectorRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX_NAME}/delete-by-ids`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${CF_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids: batch }),
          },
        );
        const deleteVectorData = await deleteVectorRes.json();
        if (!deleteVectorData.success) {
          console.error(
            `❌ Failed to delete stale vectors for [${title}]:`,
            deleteVectorData.errors,
          );
          continue;
        }
      }

      const deleteRowsData = await d1Query(
        "DELETE FROM posts WHERE title = ?",
        [title],
      );
      if (!deleteRowsData.success) {
        console.error(
          `❌ Failed to delete stale rows for [${title}]:`,
          deleteRowsData.errors,
        );
        continue;
      }
    }

    const chunks = chunkText(content, MAX_CHUNK_CHARS);

    for (let i = 0; i < chunks.length; i++) {
      const chunkContent = chunks[i];
      const label = `${title}#${i}`;

      const embeddingData = await embedWithTruncation(label, chunkContent);
      if (!embeddingData.success) {
        console.error(
          `❌ Failed to generate embedding of [${label}]:`,
          embeddingData.errors,
        );
        continue;
      }
      const vector = embeddingData.result.data[0];

      const insertData = await d1Query(
        "INSERT INTO posts (title, chunk_index, content) VALUES (?, ?, ?)",
        [title, i, chunkContent],
      );
      if (!insertData.success) {
        console.error(
          `❌ Failed to write into d1 of [${label}]:`,
          insertData.errors,
        );
        continue;
      }
      const chunkId = insertData.result[0].meta.last_row_id.toString();

      const ndjsonLine =
        JSON.stringify({
          id: chunkId,
          values: vector,
          metadata: { title, chunk_index: i },
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
          `❌ Failed to vectorize the chunk [${label}]:`,
          vectorizeData.errors,
        );
        continue;
      }

      console.log(`✅ Successfully synced: ${label} (ID: ${chunkId})`);
    }
  }
}

(async () => {
  await main().catch(console.error);
})();
