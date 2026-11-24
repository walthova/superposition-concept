import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Branch } from './scenario';
import { frameTimeline, minimumOrbitDistance, observePath, retainObservedPath, timelineCurve } from './timeline';

export const colors = ['#8c9bff', '#a388ff', '#c28bff', '#ed9df1', '#fbadcc', '#ffbfaf', '#7ae9e6', '#7cbaff'];

interface Path {
  group: THREE.Group;
  curve: THREE.CubicBezierCurve3;
  index: number;
  glow: THREE.Sprite;
  materials: (THREE.LineBasicMaterial | THREE.SpriteMaterial | THREE.MeshBasicMaterial)[];
}

export function reserveOrbitWheel(event: WheelEvent) {
  if (!event.shiftKey || event.ctrlKey || event.metaKey) event.stopImmediatePropagation();
}

export function createSpace(host: HTMLElement, onPick: (index: number) => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
  camera.position.set(0, 7.2, 19);
  const controls = new OrbitControls(camera, renderer.domElement);
  renderer.domElement.addEventListener('wheel', reserveOrbitWheel, { capture: true, passive: true });
  renderer.domElement.style.touchAction = 'pan-y';
  const home = new THREE.Vector3(0, 1.9, 0);
  controls.target.copy(home);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 68;
  controls.maxPolarAngle = Math.PI * 0.59;
  controls.update();

  const network = new THREE.Group();
  scene.add(network);
  const grid = new THREE.GridHelper(80, 80, 0x6862ad, 0x65599c);
  grid.material.transparent = true;
  grid.material.opacity = 0.19;
  grid.position.y = -2.05;
  scene.add(grid);

  let seed = 991;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (const [count, size, opacity] of [[850, 0.035, 0.62], [100, 0.075, 0.72]]) {
    const positions = Array.from({ length: count }, () => [(rand() - 0.5) * 88, rand() * 30 - 2, (rand() - 0.55) * 58]).flat();
    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xb8baff, size, opacity, transparent: true })));
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.13, 'rgba(255,255,255,.8)');
  gradient.addColorStop(0.37, 'rgba(255,255,255,.24)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = (color: THREE.ColorRepresentation, scale: number) => {
    const dot = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    dot.scale.setScalar(scale);
    return dot;
  };
  const core = sprite('#ddd1ff', 2.5);
  core.position.set(0, -0.95, 3);
  scene.add(core);
  for (const [radius, opacity] of [[0.4, 0.45], [0.8, 0.28], [1.35, 0.14]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.017, 64), new THREE.MeshBasicMaterial({
      color: 0xc8beff, transparent: true, opacity, side: THREE.DoubleSide,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, -1.16, 3);
    scene.add(ring);
  }

  function makePath(curve: THREE.CubicBezierCurve3, index: number, probability: number): Path {
    const group = new THREE.Group();
    const color = new THREE.Color(colors[index]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(line);
    const halo = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 46, 0.038 + Math.sqrt(probability) * 0.065, 5, false),
      new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    group.add(halo);
    const endpoint = sprite(color, 0.9 + Math.sqrt(probability));
    endpoint.position.copy(curve.v3);
    group.add(endpoint);
    const glow = sprite(color, 0.72);
    group.add(glow);
    return { group, curve, index, glow, materials: [line.material, halo.material, endpoint.material, glow.material] };
  }

  function dispose(path: Path) {
    network.remove(path.group);
    path.group.traverse(child => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) child.geometry.dispose();
    });
    path.materials.forEach(material => material.dispose());
  }

  function opacity(path: Path, weight: number) {
    const levels = [0.9, 0.22, 0.96, 0.88];
    path.materials.forEach((material, i) => { material.opacity = levels[i] * weight; });
  }

  const root = core.position.clone();
  let paths: Path[] = [];
  let fadingPaths: Path[] = [];
  const trail: Path[] = [];
  let selected = 0;
  let started = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frameStart = home.clone();
  let activeFrame = { center: home.clone(), radius: 0 };

  function fitOrbit() {
    controls.minDistance = Math.max(8, minimumOrbitDistance(activeFrame.radius, camera.fov, camera.aspect));
    controls.maxDistance = Math.max(68, controls.minDistance * 1.5);
  }

  function setBranches(branches: Branch[], observation?: number) {
    fadingPaths.forEach(dispose);
    const result = observation === undefined ? undefined : observePath(paths, observation);
    if (result) {
      const previous = trail.at(-1);
      if (previous) {
        opacity(previous, 0.79);
        previous.glow.position.copy(previous.curve.v3);
      }
      retainObservedPath(trail, result.path, dispose);
      fadingPaths = result.fading;
    } else {
      paths.forEach(dispose);
      fadingPaths = [];
      trail.splice(0).forEach(dispose);
    }
    started = performance.now();
    paths = branches.map(({ index, probability }) => {
      const path = makePath(timelineCurve(result?.fork ?? root, index), index, probability);
      opacity(path, 0);
      network.add(path.group);
      return path;
    });
    frameStart.copy(controls.target);
    activeFrame = frameTimeline(paths.map(path => path.curve));
    fitOrbit();
  }

  new ResizeObserver(() => {
    const { clientWidth, clientHeight } = host;
    if (!clientWidth || !clientHeight) return;
    camera.aspect = clientWidth / clientHeight;
    camera.fov = camera.aspect < 1.3 ? Math.min(68, 42 * 1.3 / camera.aspect) : 42;
    camera.updateProjectionMatrix();
    fitOrbit();
    renderer.setSize(clientWidth, clientHeight);
  }).observe(host);

  const raycaster = new THREE.Raycaster();
  let start = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', event => {
    start = new THREE.Vector2(event.clientX, event.clientY);
  });
  renderer.domElement.addEventListener('pointerup', event => {
    if (start.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
    const targets = paths.map(path => path.group.children[2]);
    const picked = raycaster.intersectObjects(targets, false)[0];
    if (picked) onPick(paths[targets.indexOf(picked.object)].index);
  });

  const offset = new THREE.Vector3();
  renderer.setAnimationLoop(now => {
    const elapsed = reduced ? 1600 : now - started;
    const ease = THREE.MathUtils.smoothstep(elapsed, 0, 470);
    offset.lerpVectors(frameStart, activeFrame.center, ease).sub(controls.target);
    controls.target.add(offset);
    camera.position.add(offset);
    controls.update();
    const fading = Math.max(0, 1 - elapsed / 720);
    if (fadingPaths.length && fading === 0) {
      fadingPaths.forEach(dispose);
      fadingPaths = [];
    }
    fadingPaths.forEach(path => opacity(path, fading * fading * 0.55));
    const latest = trail.at(-1);
    if (latest) {
      opacity(latest, 1.05 + fading * 0.45);
      latest.glow.position.copy(latest.curve.getPoint(Math.min(1, elapsed / 550)));
    }
    const reveal = Math.max(0, Math.min(1, (elapsed - (latest ? 500 : 0)) / 620));
    paths.forEach(path => {
      opacity(path, reveal * (path.index === selected ? 1.1 : 0.62));
      path.glow.position.copy(path.curve.getPoint(reduced ? 0.6 : (now / 3400 + path.index * 0.12) % 1));
    });
    core.material.opacity = reduced ? 0.88 : 0.85 + Math.sin(now / 550) * 0.12;
    renderer.render(scene, camera);
  });
  return { setBranches, select: (index: number) => { selected = index; } };
}
