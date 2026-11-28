import { describe, expect, it } from 'vitest';
import {
  advanceScenario,
  angleFromLikelihood,
  createAiScenario,
  defaultPrompt,
  examples,
  generateScenario,
  likelihoodFromAngle,
  reweightScenario,
  type AiScenarioData,
} from './scenario';

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
    ['What if I open up a second bakery?', 'Business expansion'],
    ['What if I open a second business location?', 'Business expansion'],
    ['What if I opened another café in a neighboring city?', 'Business expansion'],
    ['What if my business opened a second pizza shop?', 'Business expansion'],
    ['What if my bakery opened a new store alongside its existing one?', 'Business expansion'],
    ['What if I open a new shop alongside my current pizza shop?', 'Business expansion'],
    ['What if our company moved to a four-day workweek?', 'Organizational systems'],
    ['What if I move my office to a new location?', 'Organizational systems'],
    ['What if another team handled store inventory?', 'Organizational systems'],
    ['What if I opened a new bakery?', 'Open scenario'],
    ['What if I open a new bakery in addition to my current job?', 'Open scenario'],
    ['What if I open a new bakery in addition to my current job at a store?', 'Open scenario'],
    ['What if my business opened a third location?', 'Organizational systems'],
    ['What if my city adds a new shopping district?', 'Civic systems'],
    ['What if my city adds a second polling location?', 'Civic systems'],
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

  it('maps factor likelihoods to RY angles and reweights probabilities without changing stories', () => {
    for (const p of [0.05, 0.25, 0.5, 0.75, 0.95]) {
      expect(likelihoodFromAngle(angleFromLikelihood(p))).toBeCloseTo(p, 6);
    }
    const base = generateScenario(defaultPrompt);
    const reweighted = reweightScenario(base, [0.9, 0.2, 0.8]);
    expect(reweighted.branches.map(b => b.title)).toEqual(base.branches.map(b => b.title));
    expect(reweighted.branches.map(b => b.narrative)).toEqual(base.branches.map(b => b.narrative));
    expect(reweighted.branches.reduce((sum, b) => sum + b.probability, 0)).toBeCloseTo(1);
    expect(reweighted.branches.map(b => b.probability)).not.toEqual(base.branches.map(b => b.probability));
  });

  it('builds and advances AI-authored scenarios with custom factors and eight stories', () => {
    const aiData: AiScenarioData = {
      setting: 'Coffee shop pivot',
      factors: [
        { label: 'Morning foot traffic', lowLabel: 'Slow mornings', highLabel: 'Packed rush', likelihood: 0.65 },
        { label: 'Bean supply cost', lowLabel: 'Price spike', highLabel: 'Stable roast', likelihood: 0.4 },
        { label: 'Barista retention', lowLabel: 'High turnover', highLabel: 'Steady crew', likelihood: 0.7 },
      ],
      branches: ['111', '000', '001', '010', '011', '100', '101', '110'].map(bits => ({
        bits,
        title: bits === '111' ? 'Phase 2: Peak Rush' : `Outcome ${bits}`,
        narrative: bits === '000' ? 'After launch: regulars stay away.' : `Story for branch ${bits}.`,
      })),
    };
    const scenario = createAiScenario('What if I convert my bookstore into a cafe?', aiData);
    expect(scenario.source).toBe('ai');
    expect(scenario.setting).toBe('Coffee shop pivot');
    expect(scenario.factors.map(f => f.label)).toEqual(['Morning foot traffic', 'Bean supply cost', 'Barista retention']);
    expect(scenario.branches.map(b => b.bits)).toEqual(['000', '001', '010', '011', '100', '101', '110', '111']);
    expect(scenario.branches[0].title).toBe('Outcome 000');
    expect(scenario.branches[7].title).toBe('Phase 2: Peak Rush');
    expect(scenario.branches.reduce((sum, b) => sum + b.probability, 0)).toBeCloseTo(1);

    const next = advanceScenario(scenario, 7);
    expect(next.depth).toBe(1);
    expect(next.lineage).toEqual([7]);
    expect(next.branches[0].narrative).toBe('After Phase 2: Peak Rush: After launch: regulars stay away.');
    expect(next.likelihoods[0]).toBeGreaterThan(scenario.likelihoods[0]);

    const third = advanceScenario(next, 0);
    expect(third.branches[0].narrative).toBe('After Outcome 000: After launch: regulars stay away.');
  });
});
