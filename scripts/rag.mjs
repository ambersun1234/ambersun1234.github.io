import fs from "fs";
import path from "path";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
const VECTORIZE_INDEX_NAME = "blog-vector-index";
const VECTORIZE_DIMENSIONS = 1024; // @cf/baai/bge-m3 output dimension
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cloudflare's API occasionally returns a malformed/truncated body (seen in
// CI as "Unexpected non-whitespace character after JSON at position 4").
// Read as text first so a parse failure doesn't blow up with an opaque
// undici stack trace, log the raw body for diagnosis, and retry a couple
// times in case it's transient.
async function fetchJson(url, options, context, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // force a fresh connection instead of reusing a keep-alive socket —
    // avoids a Node/undici race where a reused socket splices the next
    // response's bytes onto the tail of the previous one
    const res = await fetch(url, {
      ...options,
      headers: { ...options.headers, Connection: "close" },
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      lastErr = err;
      console.error(
        `⚠️ [${context}] non-JSON response (HTTP ${res.status}, attempt ${attempt + 1}/${retries + 1}): ${err.message}`,
      );
      console.error(`⚠️ [${context}] raw response (truncated): ${text.slice(0, 500)}`);
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }
  throw lastErr;
}

async function embedWithTruncation(label, text) {
  let candidate = text;

  for (let attempt = 0; attempt < 6; attempt++) {
    const data = await fetchJson(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/baai/bge-m3`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: [candidate] }),
      },
      `embed:${label}`,
    );
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

async function d1Query(sql, params, context) {
  return fetchJson(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    },
    `d1:${context}`,
  );
}

async function init() {
  console.log("🛠️ checking d1 table...");
  const initTableData = await d1Query(
    `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    chunk_index INTEGER DEFAULT 0,
    content TEXT
  );`,
    undefined,
    "create table",
  );
  if (!initTableData.success) {
    console.error(
      "❌ Failed to initialize d1 table posts:",
      initTableData.errors,
    );
    process.exit(1);
  }

  // best-effort migration for tables created before chunk_index existed
  const alterData = await d1Query(
    "ALTER TABLE posts ADD COLUMN chunk_index INTEGER DEFAULT 0;",
    undefined,
    "alter table",
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
    const errText = await getIndexRes.text();
    console.error(
      `❌ Failed to check vectorize index (HTTP ${getIndexRes.status}): ${errText.slice(0, 500)}`,
    );
    process.exit(1);
  }

  console.log(`🛠️ vectorize index not found, creating [${VECTORIZE_INDEX_NAME}]...`);
  const createIndexData = await fetchJson(
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
    "vectorize create index",
  );
  if (!createIndexData.success) {
    console.error(
      "❌ Failed to create vectorize index:",
      createIndexData.errors,
    );
    process.exit(1);
  }
  console.log("✅ vectorize index ready");
}

async function processPost(file) {
  const filePath = path.join(postsDir, file);
  const content = fs.readFileSync(filePath, "utf-8");
  const title = file.replace(".md", "");

  console.log(`🛠️ processing: ${title}...`);

  // wipe out any chunks left over from a previous run of this post first —
  // chunk count can change between runs as content changes, so we can't
  // update-in-place the way a single-row-per-post upsert did.
  const lookupData = await d1Query(
    "SELECT id FROM posts WHERE title = ?",
    [title],
    `lookup:${title}`,
  );
  if (!lookupData.success) {
    console.error(
      `❌ Failed to look up existing chunks for [${title}]:`,
      lookupData.errors,
    );
    return;
  }
  const existingIds = (lookupData.result?.[0]?.results || []).map((r) =>
    r.id.toString(),
  );

  if (existingIds.length > 0) {
    for (const batch of chunk(existingIds, DELETE_BATCH_SIZE)) {
      const deleteVectorData = await fetchJson(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX_NAME}/delete-by-ids`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: batch }),
        },
        `vectorize delete-by-ids:${title}`,
      );
      if (!deleteVectorData.success) {
        console.error(
          `❌ Failed to delete stale vectors for [${title}]:`,
          deleteVectorData.errors,
        );
        return;
      }
    }

    const deleteRowsData = await d1Query(
      "DELETE FROM posts WHERE title = ?",
      [title],
      `delete:${title}`,
    );
    if (!deleteRowsData.success) {
      console.error(
        `❌ Failed to delete stale rows for [${title}]:`,
        deleteRowsData.errors,
      );
      return;
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
      `insert:${label}`,
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

    const vectorizeData = await fetchJson(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX_NAME}/upsert`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/x-ndjson",
        },
        body: ndjsonLine,
      },
      `vectorize upsert:${label}`,
    );
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
  let failedCount = 0;

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    try {
      await processPost(file);
    } catch (err) {
      failedCount++;
      console.error(`❌ Unexpected error while processing [${file}], skipping:`, err);
    }
  }

  if (failedCount > 0) {
    console.error(`❌ ${failedCount} post(s) failed to sync`);
    process.exit(1);
  }
}

(async () => {
  try {
    await main();
  } catch (err) {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  }
})();
