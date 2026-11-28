import { parseAiScenarioData } from '../../src/ai';
import type { AiScenarioData } from '../../src/scenario';

export interface WorkerEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_ALLOWED_ORIGINS = [
  'https://walthova.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const MAX_BODY_BYTES = 2048;
const rateBuckets = new Map<string, number[]>();

const SYSTEM_PROMPT = `You are the scenario writer for Superposition, a 3-qubit interactive what-if explorer.
Given a user's what-if question, return ONLY valid JSON matching this exact shape:
{
  "setting": "2-4 word domain label",
  "factors": [
    { "label": "2-4 word factor for q0", "lowLabel": "2-3 word low state (0)", "highLabel": "2-3 word high state (1)", "likelihood": 0.5 },
    { "label": "2-4 word factor for q1", "lowLabel": "2-3 word low state (0)", "highLabel": "2-3 word high state (1)", "likelihood": 0.5 },
    { "label": "2-4 word factor for q2", "lowLabel": "2-3 word low state (0)", "highLabel": "2-3 word high state (1)", "likelihood": 0.5 }
  ],
  "branches": [
    { "bits": "000", "title": "2-5 word title", "narrative": "2 crisp sentences describing this exact outcome." },
    { "bits": "001", "title": "...", "narrative": "..." },
    { "bits": "010", "title": "...", "narrative": "..." },
    { "bits": "011", "title": "...", "narrative": "..." },
    { "bits": "100", "title": "...", "narrative": "..." },
    { "bits": "101", "title": "...", "narrative": "..." },
    { "bits": "110", "title": "...", "narrative": "..." },
    { "bits": "111", "title": "...", "narrative": "..." }
  ]
}
Rules:
- Pick 3 concrete, independent real-world factors that genuinely matter for the user's specific question.
- Set each factor's starting likelihood between 0.25 and 0.75.
- Bit order is |q2 q1 q0>: the rightmost bit is q0 (factors[0]), middle bit is q1 (factors[1]), leftmost bit is q2 (factors[2]). 0 = lowLabel, 1 = highLabel.
- Every branch narrative must directly reflect the user's question and that exact 3-bit combination of factors in 2 concrete sentences (no generic filler, no markdown).
- Output raw JSON only.`;

function getAllowedOrigins(env: WorkerEnv): string[] {
  const extra = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra];
}

function corsHeaders(request: Request, env: WorkerEnv): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = getAllowedOrigins(env);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function checkRateLimit(clientKey: string, now: number): boolean {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (rateBuckets.get(clientKey) ?? []).filter(timestamp => timestamp > cutoff);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateBuckets.set(clientKey, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(clientKey, recent);
  return true;
}

export function resetRateLimitForTests(): void {
  rateBuckets.clear();
}

function extractJsonText(raw: string): unknown {
  const trimmed = raw.trim();
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(unfenced);
}

async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
  const contentLength = request.headers.get('Content-Length');
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) return null;
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let result = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
    return result;
  } finally {
    reader.releaseLock();
  }
}

async function callOpenAi(prompt: string, apiKey: string, model: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `What-if question: ${prompt}` },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI upstream error (${response.status})`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty OpenAI response');
  return extractJsonText(content);
}

async function callAnthropic(prompt: string, apiKey: string, model: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1400,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `What-if question: ${prompt}` }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Anthropic upstream error (${response.status})`);
  }
  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = data.content?.find(item => item.type === 'text')?.text;
  if (!text) throw new Error('Empty Anthropic response');
  return extractJsonText(text);
}

async function callGemini(prompt: string, apiKey: string, model: string, fetchImpl: typeof fetch): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: `What-if question: ${prompt}` }] }],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Gemini upstream error (${response.status})`);
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty Gemini response');
  return extractJsonText(text);
}

async function generateWithProvider(prompt: string, env: WorkerEnv, fetchImpl: typeof fetch): Promise<AiScenarioData> {
  let raw: unknown;
  if (env.OPENAI_API_KEY) {
    raw = await callOpenAi(prompt, env.OPENAI_API_KEY, env.OPENAI_MODEL || 'gpt-4o-mini', fetchImpl);
  } else if (env.ANTHROPIC_API_KEY) {
    raw = await callAnthropic(prompt, env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest', fetchImpl);
  } else if (env.GEMINI_API_KEY) {
    raw = await callGemini(prompt, env.GEMINI_API_KEY, env.GEMINI_MODEL || 'gemini-2.0-flash', fetchImpl);
  } else {
    throw new Error('NO_PROVIDER');
  }

  const parsed = parseAiScenarioData(raw);
  if (!parsed) {
    throw new Error('Model returned invalid scenario structure');
  }
  return parsed;
}

export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  options: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<Response> {
  const headers = corsHeaders(request, env);
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    const provider = env.OPENAI_API_KEY ? 'openai' : env.ANTHROPIC_API_KEY ? 'anthropic' : env.GEMINI_API_KEY ? 'gemini' : 'none';
    return jsonResponse({ ok: provider !== 'none', provider }, 200, headers);
  }

  if (request.method !== 'POST' || url.pathname !== '/api/scenario') {
    return jsonResponse({ error: 'Not found' }, 404, headers);
  }

  const origin = request.headers.get('Origin');
  if (origin && !headers['Access-Control-Allow-Origin']) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, headers);
  }

  const clientIp = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(clientIp, (options.now ?? Date.now)())) {
    return jsonResponse({ error: 'Too many requests. Please wait a minute and try again.' }, 429, headers);
  }

  const rawBody = await readBoundedText(request, MAX_BODY_BYTES);
  if (rawBody === null) {
    return jsonResponse({ error: 'Request body too large' }, 413, headers);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, headers);
  }

  const rawPrompt = typeof (body as { prompt?: unknown })?.prompt === 'string' ? (body as { prompt: string }).prompt : '';
  const prompt = rawPrompt.trim().replace(/\s+/g, ' ');
  if (!prompt) {
    return jsonResponse({ error: 'Prompt is required' }, 400, headers);
  }
  if (prompt.length > 300) {
    return jsonResponse({ error: 'Prompt must be 300 characters or fewer' }, 400, headers);
  }

  try {
    const scenario = await generateWithProvider(prompt, env, options.fetchImpl ?? fetch);
    return jsonResponse(scenario, 200, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed';
    if (message === 'NO_PROVIDER') {
      return jsonResponse({ error: 'AI provider not configured' }, 503, headers);
    }
    return jsonResponse({ error: message }, 502, headers);
  }
}
