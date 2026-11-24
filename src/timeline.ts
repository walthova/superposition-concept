import { CubicBezierCurve3, Vector3 } from 'three';

export function timelineCurve(fork: Vector3, index: number): CubicBezierCurve3 {
  const offset = (index - 3.5) / 3.5;
  const end = new Vector3(
    offset * 6.95 + fork.x * 0.36,
    2.18 + (index % 2) * 1.58 + (1 - Math.abs(offset)) * 1.15,
    fork.z - 5.9 - Math.abs(offset) * 1.45,
  );
  return new CubicBezierCurve3(
    fork, new Vector3(fork.x + offset * 0.6, fork.y + 0.3, fork.z - 0.8),
    new Vector3(end.x * 0.75 + fork.x * 0.25, end.y + 0.06, end.z + 1.7), end,
  );
}

export function observePath<T extends { index: number; curve: CubicBezierCurve3 }>(frontier: T[], index: number) {
  const path = frontier.find(candidate => candidate.index === index);
  if (!path) return;
  return { path, fork: path.curve.v3, fading: frontier.filter(candidate => candidate !== path) };
}
