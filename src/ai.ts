import type { AiBranchInput, AiFactorInput, AiScenarioData } from './scenario';

const EXPECTED_BITS = ['000', '001', '010', '011', '100', '101', '110', '111'] as const;

function asNonEmptyString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asFactor(value: unknown): AiFactorInput | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const label = asNonEmptyString(record.label, 48);
  const lowLabel = asNonEmptyString(record.lowLabel, 40);
  const highLabel = asNonEmptyString(record.highLabel, 40);
  const rawLikelihood = asFiniteNumber(record.likelihood);
  if (!label || !lowLabel || !highLabel || rawLikelihood === null) return null;
  const normalized = rawLikelihood > 1 && rawLikelihood <= 100 ? rawLikelihood / 100 : rawLikelihood;
  const likelihood = Math.min(0.95, Math.max(0.05, normalized));
  return { label, lowLabel, highLabel, likelihood };
}

function asBranch(value: unknown): AiBranchInput | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const bits = typeof record.bits === 'string' ? record.bits.trim() : '';
  const title = asNonEmptyString(record.title, 72);
  const narrative = asNonEmptyString(record.narrative, 420);
  if (!EXPECTED_BITS.includes(bits as (typeof EXPECTED_BITS)[number]) || !title || !narrative) return null;
  return { bits, title, narrative };
}

export function parseAiScenarioData(payload: unknown): AiScenarioData | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const setting = asNonEmptyString(record.setting, 64);
  if (!setting || !Array.isArray(record.factors) || record.factors.length !== 3) return null;
  const factors = record.factors.map(asFactor);
  if (factors.some(factor => factor === null)) return null;
  if (!Array.isArray(record.branches) || record.branches.length !== 8) return null;
  const parsedBranches = record.branches.map(asBranch);
  if (parsedBranches.some(branch => branch === null)) return null;

  const byBits = new Map<string, AiBranchInput>();
  for (const branch of parsedBranches as AiBranchInput[]) {
    byBits.set(branch.bits, branch);
  }
  if (byBits.size !== 8) return null;

  const orderedBranches = EXPECTED_BITS.map(bits => byBits.get(bits)!);
  return {
    setting,
    factors: factors as [AiFactorInput, AiFactorInput, AiFactorInput],
    branches: orderedBranches,
  };
}

export function getApiEndpoint(): string | null {
  const configured = import.meta.env.VITE_API_URL?.trim();
  return configured ? configured.replace(/\/+$/, '') : null;
}

export interface RequestAiOptions {
  endpoint?: string | null;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function requestAiScenario(prompt: string, options: RequestAiOptions = {}): Promise<AiScenarioData> {
  const endpoint = (options.endpoint === undefined ? getApiEndpoint() : options.endpoint)?.replace(/\/+$/, '') ?? null;
  if (!endpoint) {
    throw new Error('AI backend not configured');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 25_000;
  const timer = globalThis.setTimeout(() => controller.abort(new Error('AI request timed out')), timeoutMs);
  const onAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetchImpl(`${endpoint}/api/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) detail = body.error;
      } catch {
        // Ignore non-JSON error body
      }
      throw new Error(detail);
    }
    const json: unknown = await response.json();
    const parsed = parseAiScenarioData(json);
    if (!parsed) {
      throw new Error('Invalid AI scenario response');
    }
    return parsed;
  } finally {
    globalThis.clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}
