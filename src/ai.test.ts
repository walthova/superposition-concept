import { describe, expect, it, vi } from 'vitest';
import { parseAiScenarioData, requestAiScenario } from './ai';

const validPayload = {
  setting: 'Urban energy shift',
  factors: [
    { label: 'Grid storage', lowLabel: 'Scarce batteries', highLabel: 'Abundant storage', likelihood: 0.6 },
    { label: 'Solar subsidies', lowLabel: 'Cut incentives', highLabel: 'Expanded credits', likelihood: 45 },
    { label: 'Utility buy-in', lowLabel: 'Slow permits', highLabel: 'Fast interconnects', likelihood: 0.55 },
  ],
  branches: ['000', '001', '010', '011', '100', '101', '110', '111'].map(bits => ({
    bits,
    title: `Path ${bits}`,
    narrative: `First sentence for ${bits}. Second sentence for ${bits}.`,
  })),
};

describe('AI scenario client', () => {
  it('validates and normalizes valid AI payloads', () => {
    const parsed = parseAiScenarioData(validPayload);
    expect(parsed).not.toBeNull();
    expect(parsed!.factors[1].likelihood).toBeCloseTo(0.45);
    expect(parsed!.branches).toHaveLength(8);
  });

  it('rejects malformed or incomplete AI payloads', () => {
    expect(parseAiScenarioData(null)).toBeNull();
    expect(parseAiScenarioData({ ...validPayload, factors: validPayload.factors.slice(0, 2) })).toBeNull();
    expect(parseAiScenarioData({ ...validPayload, branches: validPayload.branches.slice(0, 7) })).toBeNull();
    expect(parseAiScenarioData({
      ...validPayload,
      branches: validPayload.branches.map((branch, idx) => (idx === 1 ? { ...branch, bits: '000' } : branch)),
    })).toBeNull();
  });

  it('posts the prompt to /api/scenario and returns validated scenario data', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(validPayload), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const result = await requestAiScenario('What if every roof had solar?', {
      endpoint: 'https://api.example.com/',
      fetchImpl: fetchMock,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/scenario',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.setting).toBe('Urban energy shift');
  });

  it('throws a clear error when no endpoint is configured or upstream fails', async () => {
    await expect(requestAiScenario('Test?', { endpoint: null })).rejects.toThrow('AI backend not configured');
    const failingFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 }),
    );
    await expect(
      requestAiScenario('Test?', { endpoint: 'https://api.example.com', fetchImpl: failingFetch }),
    ).rejects.toThrow('Rate limit exceeded');
  });
});
