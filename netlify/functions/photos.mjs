import { neon } from "@netlify/neon";

const sql = neon();

async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS photos (
      id        SERIAL PRIMARY KEY,
      token     TEXT NOT NULL,
      sender    TEXT NOT NULL,
      caption   TEXT,
      data      TEXT NOT NULL,
      seen      BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_photos_token ON photos(token)`;
}

export default async (req) => {
  const url    = new URL(req.url);
  const method = req.method;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (method === "OPTIONS") return new Response("", { status: 200, headers });

  try {
    await initDB();

    if (method === "GET") {
      const token = url.searchParams.get("token");
      if (!token) return json({ error: "missing token" }, 400, headers);
      const photos = await sql`
        SELECT id, sender, caption, data, seen, created_at
        FROM photos WHERE token = ${token}
        ORDER BY created_at ASC
      `;
      return json({ photos }, 200, headers);
    }

    if (method === "POST") {
      const body = await req.json();
      const { token, sender, caption, photos: imgs } = body;
      if (!token || !sender || !imgs?.length)
        return json({ error: "missing fields" }, 400, headers);
      for (const data of imgs) {
        await sql`
          INSERT INTO photos (token, sender, caption, data)
          VALUES (${token}, ${sender}, ${caption || ""}, ${data})
        `;
      }
      return json({ ok: true, count: imgs.length }, 200, headers);
    }

    if (method === "PATCH") {
      const token = url.searchParams.get("token");
      if (!token) return json({ error: "missing token" }, 400, headers);
      await sql`UPDATE photos SET seen = TRUE WHERE token = ${token}`;
      return json({ ok: true }, 200, headers);
    }

    return json({ error: "method not allowed" }, 405, headers);

  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500, headers);
  }
};

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

export const config = { path: "/api/photos" };
