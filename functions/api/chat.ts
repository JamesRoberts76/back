export interface Env {
  OPENAI_API_KEY: string;
  SOVEREIGN_ALLOWED_ORIGINS?: string;
  OPENAI_BASE_URL?: string;
}

const COOKIE_NAME = 'sovereign_uid';
const COOKIE_DOMAIN = '.guide';

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const origin = request.headers.get('Origin') || '';
  const sovereignOrigin = request.headers.get('X-Sovereign-Origin') || '';

  if (!isAllowedOrigin(origin, sovereignOrigin, env.SOVEREIGN_ALLOWED_ORIGINS)) {
    return json(
      {
        message: 'Unauthorized origin',
        threadId: null,
        ui: { status: 'error', action: 'none' }
      },
      403
    );
  }

  let body: {
    siteId: string;
    sessionContext: string;
    message: string;
    threadId?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return json(
      {
        message: 'Invalid JSON payload',
        threadId: null,
        ui: { status: 'error', action: 'none' }
      },
      400
    );
  }

  const { siteId, sessionContext, message } = body;

  if (!siteId || !sessionContext || !message) {
    return json(
      {
        message: 'Missing required fields: siteId, sessionContext, message',
        threadId: null,
        ui: { status: 'error', action: 'none' }
      },
      400
    );
  }

  const cookies = request.headers.get('Cookie') || '';
  let sovereignUid = getCookie(cookies, COOKIE_NAME);
  let setCookieHeader: string | null = null;

  if (!sovereignUid) {
    sovereignUid = crypto.randomUUID();
    setCookieHeader = buildCookie(sovereignUid);
  }

  const threadId = body.threadId || sovereignUid;
  const apiUrl = `${(env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '')}/v1/chat/completions`;

  const payload = {
    model: 'gpt-5.1',
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(siteId, sessionContext)
      },
      {
        role: 'user',
        content: message
      }
    ],
    temperature: 0.3
  };

  try {
    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!upstream.ok) {
      return withCookie(
        {
          message: `Upstream error from OpenAI: ${upstream.status}`,
          threadId,
          ui: { status: 'error', action: 'none' }
        },
        502,
        setCookieHeader
      );
    }

    const data = await upstream.json();
    const assistantText =
      data?.choices?.[0]?.message?.content ||
      'The Architect could not generate a response.';

    return withCookie(
      {
        message: assistantText,
        threadId,
        ui: { status: 'success', action: 'none' }
      },
      200,
      setCookieHeader
    );
  } catch {
    return withCookie(
      {
        message: 'Error contacting the Architect backend',
        threadId,
        ui: { status: 'error', action: 'none' }
      },
      502,
      setCookieHeader
    );
  }
}

function isAllowedOrigin(origin: string, sovereignOrigin: string, allowedList?: string): boolean {
  const allowed = (allowedList || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return allowed.includes(origin) && allowed.includes(sovereignOrigin);
}

function getCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function buildCookie(value: string): string {
  return [
    `${COOKIE_NAME}=${value}`,
    `Domain=${COOKIE_DOMAIN}`,
    'Path=/',
    'Secure',
    'HttpOnly',
    'SameSite=Lax'
  ].join('; ');
}

function buildSystemPrompt(siteId: string, sessionContext: string): string {
  return [
    'You are the Architect for the Sovereign Network.',
    `You are serving ${siteId}.`,
    `Session context: ${sessionContext}.`,
    'Your tone is sober, exacting, calm, and systems-oriented.',
    'Do not sound promotional, therapeutic, lifestyle-driven, or politically theatrical.',
    'Do not use hype, soft filler, motivational language, brand-speak, or generic AI phrasing.',
    'Prefer short paragraphs and compact bullet points when useful.',
    'Be concrete. Name structures, tradeoffs, constraints, and next actions.',
    'If the user asks a broad question, reduce it to first principles and practical sequencing.',
    'If you do not know something, say so plainly.',
    'Treat sovereignty as a practical design problem across identity, infrastructure, coordination, law, money, privacy, and resilience.',
    'This site is not self-help. It is a field manual.',
    'Answer as an architect, not as a cheerleader.',
    'Keep responses concise, controlled, and useful.'
  ].join(' ');
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function withCookie(body: unknown, status: number, setCookie: string | null): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (setCookie) headers['Set-Cookie'] = setCookie;

  return new Response(JSON.stringify(body), { status, headers });
}
