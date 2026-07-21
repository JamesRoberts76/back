const SITE_CONFIG = {
  "back.guide": {
    mode: "practice-companion",
    prompt: "You are the Architect for back.guide. Focus: stepwise explorations of back fascia. Use simple language, concrete sensations, and a sober, practical tone."
  },
  "backfascianetwork.pages.dev": {
    mode: "diagnostic",
    prompt: "You are the Architect. Focus: fascial geometry and unspooling rigid back tissue. Use plain language, precision, and a sober tone."
  },
  "slabfascia.guide": {
    mode: "tissue-restoration",
    prompt: "You are the Architect for slabfascia.guide. Focus: slab friction, gliding planes, and restoring fluid movement in dense tissue. Prioritize experiential cues over anatomy jargon."
  }
};

export async function onRequestPost({ request, env }) {
  if (!env.OPENAI_API_KEY || !String(env.OPENAI_API_KEY).trim()) {
    return new Response(JSON.stringify({
      message: "Configuration error: Missing OPENAI_API_KEY."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({
      message: "Invalid JSON payload."
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { siteId, message, uuid } = body;

  if (!siteId || !SITE_CONFIG[siteId]) {
    return new Response(JSON.stringify({
      message: "Forbidden: Invalid or missing siteId."
    }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!message || !String(message).trim()) {
    return new Response(JSON.stringify({
      message: "Bad Request: Message cannot be empty."
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const config = SITE_CONFIG[siteId];
  const systemPrompt = `${config.prompt} Respond in a sober, professional tone.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: String(message).trim() }
        ]
      })
    });

    const text = await response.text();

    if (!response.ok) {
      return new Response(JSON.stringify({
        message: `OpenAI error (${response.status}): ${text}`
      }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = JSON.parse(text);
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      return new Response(JSON.stringify({
        message: "Error: Received empty response from model."
      }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      message: reply,
      uuid: uuid || crypto.randomUUID()
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      message: `Internal server error: ${e.message || "Unknown error"}`
    }), {
      status: 502,
      headers: { "Content-Type": "application/json" }
    });
  }
}
