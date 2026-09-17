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

  const store = getStore("content-brain-conversations");

  try {
    if (request.method === "GET") {
      const { blobs } = await store.list({ prefix: "conversation/" });
      const conversations = (await Promise.all(
        blobs.map(({ key }) => store.get(key, { type: "json", consistency: "strong" })),
      )).filter(Boolean);
      conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return Response.json({ conversations }, { headers: jsonHeaders });
    }

    if (request.method === "POST") {
      const conversation = await request.json();
      if (!conversation?.id || !conversation?.title || !Array.isArray(conversation?.messages)) {
        return Response.json({ error: "Missing required conversation fields." }, { status: 400, headers: jsonHeaders });
      }
      await store.setJSON(`conversation/${conversation.id}`, conversation);
      return Response.json({ conversation }, { status: 201, headers: jsonHeaders });
    }

    return Response.json({ error: "Method not allowed." }, { status: 405, headers: jsonHeaders });
  } catch (error) {
    console.error("Conversation history error", error);
    return Response.json({ error: "Conversation history is temporarily unavailable." }, { status: 500, headers: jsonHeaders });
  }
};
