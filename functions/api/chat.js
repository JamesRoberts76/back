const ALLOWED_ORIGINS = [
    'https://back.guide',
    'https://compressed.guide',
    'http://localhost:8787',
    'http://localhost:3000'
];

function formatHistory(history) {
    return history
        .filter(h => h && typeof h === 'object')
        .map(h => ({
            role: (h.role === 'user' || h.sender === 'user') ? 'user' : 'assistant',
            content: String(h.content ?? h.text ?? '')
        }))
        .filter(h => h.content !== '');
}

export async function onRequestOptions(context) {
    const { request } = context;
    const origin = request.headers.get('Origin') || '';

    if (!ALLOWED_ORIGINS.includes(origin)) {
        return new Response(null, { status: 403 });
    }

    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
            'Vary': 'Origin'
        },
    });
}

export async function onRequestPost(context) {
    let currentOrigin = null;
    
    try {
        const { request, env } = context;
        const origin = request.headers.get('Origin') || '';

        currentOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : null;

        if (!currentOrigin) {
            return new Response(JSON.stringify({ error: 'Unauthorized origin' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const corsHeaders = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': currentOrigin,
            'Vary': 'Origin'
        };

        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
                status: 400,
                headers: corsHeaders,
            });
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return new Response(JSON.stringify({ error: 'Invalid request body: expected JSON object.' }), {
                status: 400,
                headers: corsHeaders,
            });
        }

        const { message, history = [], siteId = 'back.guide' } = body;

        if (!message || typeof message !== 'string') {
            return new Response(JSON.stringify({ error: 'Valid message string is required.' }), {
                status: 400,
                headers: corsHeaders
            });
        }

        if (message.length > 4000) {
            return new Response(JSON.stringify({ error: 'Message exceeds maximum length.' }), {
                status: 400,
                headers: corsHeaders
            });
        }

        if (!Array.isArray(history)) {
            return new Response(JSON.stringify({ error: 'History must be an array.' }), {
                status: 400,
                headers: corsHeaders
            });
        }

        const formattedHistory = formatHistory(history);

        if (formattedHistory.length > 50) {
            return new Response(JSON.stringify({ error: 'History array too large.' }), {
                status: 400,
                headers: corsHeaders
            });
        }

        const apiKey = env.OPENAI_API_KEY ? env.OPENAI_API_KEY.trim() : null;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'OPENAI_API_KEY environment variable is not configured.' }), {
                status: 500,
                headers: corsHeaders
            });
        }

        const safeSiteId = typeof siteId === 'string' 
            ? siteId.toLowerCase().replace(/[\r\n]/g, '').slice(0, 100) 
            : 'back.guide';

        // Dynamically fetch node context from the Cloudflare KV Registry
        let clusterContext = "";
        try {
            if (env.REGISTRY) {
                const registryData = await env.REGISTRY.get(safeSiteId, { type: 'json' });
                if (registryData && registryData.clusterContext) {
                    clusterContext = registryData.clusterContext;
                }
            }
        } catch (kvErr) {
            console.error("KV Registry fetch failed:", kvErr);
        }

        // Balanced James system prompt integrating voice and dynamic KV context
        const jamesSystemPrompt = `
ROLE:
You are James, a 50-year-old digital product builder and former international travel recruitment executive operating from Tenerife. Advising on network node: ${safeSiteId}.

IDENTITY & TONE:
- Understated, knowledgeable, professional, and unhurried. 
- Less is more; actions speak louder than words. Avoid verbose explanations, superficial comfort, and AI cheerleading.
- Use dry British humour rarely and only when a situation naturally warrants it.

CORE PERSPECTIVE:
- Frame specific user issues as part of a broader, systemic pattern of modern life rather than isolated incidents.
- Ground your responses in practical mechanics, observable function, and personal sovereignty.

${clusterContext}

GUARDRAILS:
- Do not diagnose medical conditions or prescribe treatments. Advise qualified clinical assessment for acute, worsening, or unexplained pain.
- Do not ask for personal identifying information.
- Keep responses direct, human, and conversational.
        `.trim();

        const messages = [
            { role: 'system', content: jamesSystemPrompt },
            ...formattedHistory,
            { role: 'user', content: message }
        ];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        let response;
        try {
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ` + apiKey
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 400
                }),
                signal: controller.signal
            });
        } catch (fetchErr) {
            if (controller.signal.aborted) {
                throw new Error('OpenAI request timed out.');
            }
            throw fetchErr;
        } finally {
            clearTimeout(timeoutId);
        }

        let data;
        let parseTimeoutId;
        try {
            data = await Promise.race([
                response.json(),
                new Promise((_, reject) => {
                    parseTimeoutId = setTimeout(() => reject(new Error('Response body timeout')), 5000);
                })
            ]);
        } catch (parseErr) {
            const isTimeout = parseErr instanceof Error && parseErr.message === 'Response body timeout';
            throw new Error(isTimeout ? 'OpenAI response timed out.' : 'Failed to parse response from OpenAI API.');
        } finally {
            clearTimeout(parseTimeoutId);
        }

        if (!response.ok) {
            throw new Error(data?.error?.message || 'Failed to communicate with OpenAI API.');
        }

        const reply = data.choices?.[0]?.message?.content;
        if (reply == null) {
            throw new Error('Unexpected response structure from OpenAI.');
        }

        return new Response(JSON.stringify({ reply, fallback: false }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (err) {
        const fallbackReply = "I am having trouble connecting to the network right now. Let's revisit that shortly.";
        return new Response(JSON.stringify({ reply: fallbackReply, fallback: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...(currentOrigin && { 'Access-Control-Allow-Origin': currentOrigin, 'Vary': 'Origin' })
            }
        });
    }
}
