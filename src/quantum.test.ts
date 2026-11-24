import { describe, expect, it } from 'vitest';
import { measure, statevector } from './quantum';

describe('statevector', () => {
  it('prepares a Bell pair and preserves normalization', () => {
    const result = statevector.run({ qubits: 3, gates: [
      { kind: 'H', target: 0 }, { kind: 'CNOT', control: 0, target: 1 },
    ] });
    expect(result.amplitudes[0]).toBeCloseTo(Math.SQRT1_2);
    expect(result.amplitudes[3]).toBeCloseTo(Math.SQRT1_2);
    expect(result.probabilities.filter(Boolean)).toHaveLength(2);
    expect(result.probabilities.reduce((sum, p) => sum + p)).toBeCloseTo(1);
  });

  it('rotates signed amplitudes, then shows constructive and destructive interference', () => {
    const rotated = statevector.run({ qubits: 3, gates: [{ kind: 'RY', target: 2, angle: -Math.PI / 2 }] });
    expect(rotated.amplitudes[4]).toBeCloseTo(-Math.SQRT1_2);
    const result = statevector.run({ qubits: 3, gates: [
      { kind: 'H', target: 0 }, { kind: 'H', target: 0 },
    ] });
    expect(result.probabilities[0]).toBeCloseTo(1);
    expect(result.probabilities[1]).toBe(0);
    expect(result.incoherent.slice(0, 2)).toEqual([0.5, 0.5]);
  });

  it('samples cumulative probabilities without selecting impossible branches', () => {
    expect(measure([0, 0.25, 0, 0.75, 0], () => 0)).toBe(1);
    expect(measure([0, 0.25, 0, 0.75, 0], () => 0.25)).toBe(3);
    expect(measure([0, 0.25, 0, 0.749999999, 0], () => 0.9999999999)).toBe(3);
  });
});
