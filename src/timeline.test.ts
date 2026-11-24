import { PerspectiveCamera, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { frameTimeline, minimumOrbitDistance, observePath, timelineCurve } from './timeline';

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

it('fits a distant fork at minimum zoom, including from the opposite side and on narrow screens', () => {
  let fork = new Vector3(0, -0.95, 3);
  for (const index of [0, 7, 6, 0, 7, 2]) fork = timelineCurve(fork, index).v3;
  const curves = Array.from({ length: 8 }, (_, index) => timelineCurve(fork, index));
  const { center, radius } = frameTimeline(curves);
  for (const [fov, aspect] of [[42, 1.5], [68, 0.65]]) {
    const camera = new PerspectiveCamera(fov, aspect);
    const distance = minimumOrbitDistance(radius, fov, aspect);
    for (const direction of [new Vector3(0, 0, -1), new Vector3(1, 0, -1), new Vector3(1, 1, 1)]) {
      camera.position.copy(center).add(direction.setLength(distance));
      camera.lookAt(center);
      camera.updateMatrixWorld();
      for (const point of curves.flatMap(curve => curve.getPoints(20))) {
        const { x, y, z } = point.project(camera);
        expect(Math.max(Math.abs(x), Math.abs(y), Math.abs(z))).toBeLessThan(1);
      }
    }
  }
});
