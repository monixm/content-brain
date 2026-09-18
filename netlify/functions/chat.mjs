const zoneNames = {
  business: "MY BUSINESS",
  voice: "MY VOICE",
  expert: "EXPERT BRAIN",
  inspiration: "INSPIRATION",
};

function authorized(request) {
  const expected = process.env.CONTENT_HUB_SECRET;
  return !expected || request.headers.get("x-content-hub-key") === expected;
}

function sourceContext(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return "No source material was connected.";
  return sources.slice(0, 80).map((source, index) => [
    `[${index + 1}] ${zoneNames[source.zone] || source.zone}: ${source.title}`,
    source.url ? `URL: ${source.url}` : "",
    source.content ? `CONTENT: ${source.content}` : "",
    source.tags?.length ? `TAGS: ${source.tags.join(", ")}` : "",
    source.takeaways?.length ? `ELEMENTS THE USER LIKES: ${source.takeaways.join(", ")}` : "",
    source.image ? `REFERENCE IMAGE: attached below as image for source [${index + 1}]` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
}

function extractText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text)
    .join("\n");
}

export default async (request) => {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
  if (!authorized(request)) return Response.json({ error: "That access key is not correct." }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "The writing assistant is not configured yet. Add OPENAI_API_KEY in Netlify, then redeploy." }, { status: 503 });
  }

  try {
    const { prompt, history = [], sources = [], images = [] } = await request.json();
    if (!prompt?.trim() && !images.length) return Response.json({ error: "Write a request or attach a screenshot first." }, { status: 400 });

    const transcript = history.slice(-8).map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n");
    const inputText = `CONNECTED KNOWLEDGE\n\n${sourceContext(sources)}\n\nRECENT CONVERSATION\n\n${transcript}\n\nCURRENT REQUEST\n\n${prompt || "Please analyze the attached screenshot."}`;
    const validImages = images
      .filter((image) => typeof image?.dataUrl === "string" && image.dataUrl.startsWith("data:image/"))
      .slice(0, 3);
    const sourceImages = sources
      .slice(0, 80)
      .map((source, index) => ({ source, index }))
      .filter(({ source }) => typeof source?.image === "string" && source.image.startsWith("data:image/"))
      .slice(0, 8);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        instructions: "You are Content Brain, a sharp personal content strategist and writer focused by default on growing the user's Instagram and LinkedIn presence. Use the connected knowledge as source material. My Business supplies factual positioning and audience context. My Voice contains evolving tone preferences and desired phrasing; it does not require past published content. Expert Brain supplies methods and quality standards. Ideas & Inspiration supplies hooks, captions, concepts, structures, visuals, CTAs, and creative direction but must never be copied closely. Pay special attention to the elements the user explicitly marked as liking. When sources conflict, prioritize My Business for facts and My Voice for tone. Never invent business facts. Produce practical, polished content and respond directly to revision requests. Keep the user's requested platform, format, and length.",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: inputText },
            ...validImages.flatMap((image, index) => [
              { type: "input_text", text: `CURRENT MESSAGE SCREENSHOT ${index + 1}: ${image.name || "Screenshot"}` },
              { type: "input_image", image_url: image.dataUrl, detail: "auto" },
            ]),
            ...sourceImages.flatMap(({ source, index }) => [
              { type: "input_text", text: `CONNECTED REFERENCE IMAGE FOR SOURCE [${index + 1}]: ${source.title}` },
              { type: "input_image", image_url: source.image, detail: "auto" },
            ]),
          ],
        }],
        max_output_tokens: 2200,
        store: false,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI response error", data);
      return Response.json({ error: data.error?.message || "The writing assistant could not complete that request." }, { status: response.status });
    }

    return Response.json({ text: extractText(data) || "I couldn’t produce a response from that request." });
  } catch (error) {
    console.error("Chat function error", error);
    return Response.json({ error: "The writing assistant is temporarily unavailable." }, { status: 500 });
  }
};
