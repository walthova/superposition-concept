import { describe, expect, it } from 'vitest';
import { defaultPrompt, generateScenario } from './scenario';

describe('scenario generation', () => {
  it('normalizes prompts and generates eight distinct, normalized futures locally', () => {
    const scenario = generateScenario('  ' + defaultPrompt + '  ');
    expect(scenario).toEqual(generateScenario(''));
    expect(scenario.branches.map(branch => branch.bits)).toEqual(['000', '001', '010', '011', '100', '101', '110', '111']);
    expect(new Set(scenario.branches.map(branch => branch.narrative)).size).toBe(8);
    expect(scenario.branches.reduce((total, branch) => total + branch.probability, 0)).toBeCloseTo(1);
    expect(scenario.branches.some(branch => Math.abs(branch.probability - branch.incoherent) > 0.01)).toBe(true);
  });

  it('matches the situation to its factors and changes the circuit with prompt wording', () => {
    const lunar = generateScenario('A lunar base');
    expect(lunar.factors[0].label).toBe('Crew momentum');
    expect(lunar.branches[0].narrative).toContain('crew');
    expect(lunar.circuit).not.toEqual(generateScenario('A permanent lunar base').circuit);
  });

  it('expands a measured state with new amplitudes conditioned on its lineage', () => {
    const root = generateScenario(defaultPrompt);
    const next = generateScenario(root.prompt, [7]);
    expect(next.depth).toBe(1);
    expect(next.lineage).toEqual([7]);
    expect(next.branches[0].narrative).toContain('After The New Equilibrium:');
    expect(next.branches[0].narrative).not.toContain(root.branches[0].narrative);
    expect(next.branches.map(branch => branch.probability)).not.toEqual(root.branches.map(branch => branch.probability));
    expect(next.branches).not.toEqual(generateScenario(root.prompt, [0]).branches);
  });

  it('introduces distinct event text, ignoring numbers, across many observations of the same state', () => {
    for (const prompt of [defaultPrompt, 'A lunar base', 'A four-day workweek', 'A new project']) {
      const horizons = Array.from({ length: 108 }, (_, i) => generateScenario(prompt, Array<number>(i + 1).fill(7)));
      for (let index = 0; index < 8; index++) {
        const events = horizons.map(horizon => horizon.branches[index].narrative.split(': ')[1].replace(/\d+/g, ''));
        expect(new Set(events).size).toBe(horizons.length);
      }
    }
  });
});
