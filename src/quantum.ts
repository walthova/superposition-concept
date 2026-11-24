export type Gate =
  | { kind: 'H'; target: number }
  | { kind: 'RY'; target: number; angle: number }
  | { kind: 'CNOT'; control: number; target: number };

export interface Circuit {
  qubits: number;
  gates: Gate[];
}

export interface QuantumResult {
  amplitudes: number[];
  probabilities: number[];
  incoherent: number[];
}

export interface QuantumBackend {
  run(circuit: Circuit): QuantumResult;
}

export const statevector: QuantumBackend = {
  run({ qubits, gates }) {
    const amplitudes = Array<number>(2 ** qubits).fill(0);
    const incoherent = [...amplitudes];
    amplitudes[0] = incoherent[0] = 1;
    for (const gate of gates) {
      const bit = 1 << gate.target;
      for (let i = 0; i < amplitudes.length; i++) {
        if (i & bit) continue;
        const j = i | bit;
        const a = amplitudes[i], b = amplitudes[j];
        const x = incoherent[i], y = incoherent[j];
        if (gate.kind === 'CNOT') {
          if (!(i & (1 << gate.control))) continue;
          [amplitudes[i], amplitudes[j]] = [b, a];
          [incoherent[i], incoherent[j]] = [y, x];
        } else if (gate.kind === 'H') {
          amplitudes[i] = (a + b) * Math.SQRT1_2;
          amplitudes[j] = (a - b) * Math.SQRT1_2;
          incoherent[i] = incoherent[j] = (x + y) / 2;
        } else {
          const c = Math.cos(gate.angle / 2), s = Math.sin(gate.angle / 2);
          amplitudes[i] = c * a - s * b;
          amplitudes[j] = s * a + c * b;
          incoherent[i] = c * c * x + s * s * y;
          incoherent[j] = s * s * x + c * c * y;
        }
      }
    }
    return { amplitudes, probabilities: amplitudes.map(a => a * a), incoherent };
  },
};

export function measure(probabilities: readonly number[], random = Math.random): number {
  let draw = random();
  let last = 0;
  for (let i = 0; i < probabilities.length; i++) {
    if (probabilities[i] <= 0) continue;
    last = i;
    draw -= probabilities[i];
    if (draw < 0) return i;
  }
  return last;
}
