import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest, resetRateLimitForTests } from './handler';

const modelJson = {
  setting: 'Remote work shift',
  factors: [
    { label: 'Team cohesion', lowLabel: 'Siloed squads', highLabel: 'Tight async flow', likelihood: 0.55 },
    { label: 'Talent pool', lowLabel: 'Local hiring', highLabel: 'Global hires', likelihood: 0.7 },
    { label: 'Office lease', lowLabel: 'Sunk cost', highLabel: 'Subleased space', likelihood: 0.4 },
  ],
  branches: ['000', '001', '010', '011', '100', '101', '110', '111'].map(bits => ({
    bits,
    title: `Future ${bits}`,
    narrative: `Narrative for ${bits}. Second line for ${bits}.`,
  })),
};

describe('worker scenario handler', () => {
  beforeEach(() => {
    resetRateLimitForTests();
  });

  it('serves CORS preflight and health status', async () => {
    const preflight = await handleRequest(
      new Request('https://worker.test/api/scenario', {
        method: 'OPTIONS',
        headers: { Origin: 'https://walthova.github.io' },
      }),
      { OPENAI_API_KEY: 'sk-test' },
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('https://walthova.github.io');

    const health = await handleRequest(new Request('https://worker.test/health'), { OPENAI_API_KEY: 'sk-test' });
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, provider: 'openai' });
  });

  it('blocks disallowed origins and validates prompt bounds', async () => {
    const blocked = await handleRequest(
      new Request('https://worker.test/api/scenario', {
        method: 'POST',
        headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'What if?' }),
      }),
      { OPENAI_API_KEY: 'sk-test' },
    );
    expect(blocked.status).toBe(403);

    const tooLong = await handleRequest(
      new Request('https://worker.test/api/scenario', {
        method: 'POST',
        headers: { Origin: 'https://walthova.github.io', 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'a'.repeat(301) }),
      }),
      { OPENAI_API_KEY: 'sk-test' },
    );
    expect(tooLong.status).toBe(400);
  });

  it('calls OpenAI when OPENAI_API_KEY is set and returns validated scenario JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(modelJson)}\n\`\`\`` } }],
      }), { status: 200 }),
    );
    const response = await handleRequest(
      new Request('https://worker.test/api/scenario', {
        method: 'POST',
        headers: { Origin: 'https://walthova.github.io', 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'What if we went fully remote?' }),
      }),
      { OPENAI_API_KEY: 'sk-test' },
      { fetchImpl: fetchMock },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.setting).toBe('Remote work shift');
    expect(body.branches).toHaveLength(8);
  });

  it('returns 503 when no provider API key is configured', async () => {
    const response = await handleRequest(
      new Request('https://worker.test/api/scenario', {
        method: 'POST',
        headers: { Origin: 'https://walthova.github.io', 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'What if we went fully remote?' }),
      }),
      {},
    );
    expect(response.status).toBe(503);
  });
});
