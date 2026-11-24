import { PerspectiveCamera, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { collapseTimeline, frameTimeline, minimumOrbitDistance, observePath, retainObservedPath, timelineCurve } from './timeline';

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

it('shows only the measured path without removing the current frontier', () => {
  const root = new Vector3();
  const frontier = Array.from({ length: 8 }, (_, index) => ({
    index, curve: timelineCurve(root, index), group: { visible: true },
  }));
  collapseTimeline(frontier, 4);
  expect(frontier.filter(path => path.group.visible)).toEqual([frontier[4]]);
  const next = observePath(frontier, 4)!;
  expect(next.fork).toBe(frontier[4].curve.v3);
  expect(next.fading).toHaveLength(7);
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

it('retains only the six newest observed paths and disposes each dropped segment once', () => {
  const trail: number[] = [];
  const dropped: number[] = [];
  for (let i = 0; i < 10; i++) retainObservedPath(trail, i, path => dropped.push(path));
  expect(trail).toEqual([4, 5, 6, 7, 8, 9]);
  expect(dropped).toEqual([0, 1, 2, 3]);
});
