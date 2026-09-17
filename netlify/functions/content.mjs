import { getStore } from "@netlify/blobs";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function authorized(request) {
  const expected = process.env.CONTENT_HUB_SECRET;
  return !expected || request.headers.get("x-content-hub-key") === expected;
}

export default async (request) => {
  if (!authorized(request)) {
    return Response.json({ error: "That access key is not correct." }, { status: 401, headers: jsonHeaders });
  }

  const store = getStore("content-brain-sources");
  const url = new URL(request.url);

  try {
    if (request.method === "GET") {
      const { blobs } = await store.list({ prefix: "item/" });
      const items = (await Promise.all(blobs.map(({ key }) => store.get(key, { type: "json", consistency: "strong" })))).filter(Boolean);
      items.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      return Response.json({ items }, { headers: jsonHeaders });
    }

    if (request.method === "POST") {
      const item = await request.json();
      if (!item?.id || !item?.zone || !item?.title) {
        return Response.json({ error: "Missing required source fields." }, { status: 400, headers: jsonHeaders });
      }
      await store.setJSON(`item/${item.id}`, item);
      return Response.json({ item }, { status: 201, headers: jsonHeaders });
    }

    if (request.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return Response.json({ error: "Missing source ID." }, { status: 400, headers: jsonHeaders });
      await store.delete(`item/${id}`);
      return Response.json({ deleted: true }, { headers: jsonHeaders });
    }

    return Response.json({ error: "Method not allowed." }, { status: 405, headers: jsonHeaders });
  } catch (error) {
    console.error("Content store error", error);
    return Response.json({ error: "The cloud library is temporarily unavailable." }, { status: 500, headers: jsonHeaders });
  }
};
