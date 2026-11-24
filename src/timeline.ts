import { Box3, CubicBezierCurve3, MathUtils, Vector3 } from 'three';

const trailCapacity = 6;

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

export function collapseTimeline(frontier: { index: number; group: { visible: boolean } }[], index: number) {
  frontier.forEach(path => { path.group.visible = path.index === index; });
}

export function retainObservedPath<T>(trail: T[], path: T, dispose: (path: T) => void) {
  trail.push(path);
  trail.splice(0, Math.max(0, trail.length - trailCapacity)).forEach(dispose);
}

export function frameTimeline(curves: CubicBezierCurve3[]) {
  const hull = curves.flatMap(({ v0, v1, v2, v3 }) => [v0, v1, v2, v3]);
  const center = new Box3().setFromPoints(hull).getCenter(new Vector3());
  const radius = Math.max(...hull.map(point => point.distanceTo(center)));
  return { center, radius };
}

export function minimumOrbitDistance(radius: number, verticalFov: number, aspect: number) {
  const vertical = MathUtils.degToRad(verticalFov) / 2;
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  return radius * 1.12 / Math.sin(Math.min(vertical, horizontal));
}
