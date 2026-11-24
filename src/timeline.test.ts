import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { observePath, timelineCurve } from './timeline';

it('extends the same observed segments at successive horizons', () => {
  const root = new Vector3(0, -0.95, 3);
  const open = (fork: Vector3) => Array.from({ length: 8 }, (_, index) => ({ index, curve: timelineCurve(fork, index) }));
  const firstFrontier = open(root);
  const first = observePath(firstFrontier, 7)!;
  const secondFrontier = open(first.fork);
  const second = observePath(secondFrontier, 0)!;
  expect(first.path).toBe(firstFrontier[7]);
  expect(first.fading).toHaveLength(7);
  expect(first.fading).not.toContain(first.path);
  expect(first.path.curve.v0).toBe(root);
  expect(second.path.curve.v0).toBe(first.path.curve.v3);
  expect(open(second.fork).every(path => path.curve.v0 === second.path.curve.v3)).toBe(true);
  expect(second.fork.z).toBeLessThan(first.fork.z);
});
