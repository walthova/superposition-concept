import { expect, it } from 'vitest';
import { reserveOrbitWheel } from './space';

it.each([
  [{}, false],
  [{ shiftKey: true }, true],
  [{ shiftKey: true, ctrlKey: true }, false],
  [{ shiftKey: true, metaKey: true }, false],
])('only sends deliberate Shift-scroll to the orbit controls (%j)', (modifiers, zooms) => {
  const canvas = new EventTarget();
  const wheel = Object.assign(new Event('wheel', { cancelable: true }), modifiers) as WheelEvent;
  canvas.addEventListener('wheel', event => reserveOrbitWheel(event as WheelEvent));
  canvas.addEventListener('wheel', event => event.preventDefault());
  expect(canvas.dispatchEvent(wheel)).toBe(!zooms);
});
