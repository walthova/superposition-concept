import { describe, expect, it } from 'vitest';
import { defaultPrompt, examples, generateScenario } from './scenario';

const bakeryLoan = 'What if I take out a 150,000 USD loan to open a second location for my bakery business next year?';

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

  it.each([
    [bakeryLoan, 'Business expansion'],
    ['What if I opened another café in a neighboring city?', 'Business expansion'],
    ['What if our company moved to a four-day workweek?', 'Organizational systems'],
    ['What if my city adds a new shopping district?', 'Civic systems'],
  ])('matches %s to %s', (prompt, setting) => {
    expect(generateScenario(prompt).setting).toBe(setting);
  });

  it('compares business tradeoffs and names the observed branch in the next round', () => {
    const scenario = generateScenario(bakeryLoan);
    expect(scenario.factors.map(factor => factor.label)).toEqual(['Customer demand', 'Staffing coverage', 'Cash flow']);
    expect(new Set(scenario.branches.map(branch => branch.title)).size).toBe(8);
    expect(scenario.branches[0].narrative).toContain('Sales at the new location start slowly');
    expect(scenario.branches[7].narrative).toContain('retains a cash buffer');

    const next = generateScenario(scenario.prompt, [7]);
    expect(next.branches[0].narrative).toContain(`After ${scenario.branches[7].title}:`);
    expect(next.branches[0].narrative).not.toContain(scenario.branches[0].narrative);
    expect(next.factors).toEqual(scenario.factors);
  });

  it('offers a template-backed example for business owners', () => {
    expect(examples.map(({ prompt }) => generateScenario(prompt).setting)).toContain('Business expansion');
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
    for (const prompt of [defaultPrompt, 'A lunar base', 'A four-day workweek', 'A new project', bakeryLoan]) {
      const horizons = Array.from({ length: 108 }, (_, i) => generateScenario(prompt, Array<number>(i + 1).fill(7)));
      for (let index = 0; index < 8; index++) {
        const events = horizons.map(horizon => horizon.branches[index].narrative.split(': ')[1].replace(/\d+/g, ''));
        expect(new Set(events).size).toBe(horizons.length);
      }
    }
  });
});
