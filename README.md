# Superposition

**A world simulator where you can walk into possible futures.** Start with a what-if, look at several plausible stories side by side, and observe one to reveal the next set of possibilities. The first build is a concept demo: a 3D possibility map, not a generated 3D world or a forecasting tool.

## Try it

Use Node.js 22 (22.12 or newer).

```sh
npm ci
npm run dev
```

Open the URL Vite prints, including `/superposition-concept/`. Enter a what-if or choose an example. Drag to orbit the map, scroll or pinch to zoom, and select a timeline node or inspector row to see its story and amplitude. **Observe** samples a branch from the full distribution, regardless of which timeline you’re inspecting. The selected outcome becomes the fork for eight new futures.

## What’s quantum

- Browser-local templates classify a prompt and seed `RY` angles for three binary factors. The simulated circuit starts in `|000⟩`, mixes and links the factors with `RY`, `CNOT`, and `H`, and reports signed real amplitudes. Labels display bits in `q2 q1 q0` order.
- A timeline’s weight is its squared amplitude. The inspector compares it with a reference that discards phase after each gate: the difference shows how amplitudes can interfere. The browser uses classical randomness to sample a basis state, then seeds a new circuit with the observed lineage.
- Neither the model weights nor the narratives are predictions. They do not come from real-world datasets, and no quantum hardware, API key, or backend is needed. The circuit and simulator are separate from the renderer; a later version could send the gate description to an IBM Quantum/Qiskit adapter and report measured shot frequencies separately from simulator amplitudes.

## Develop and deploy

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

CI runs lint, type checking, unit tests, and build. The Pages workflow publishes `dist/` on pushes to `main` or manual dispatch once the repository owner has selected **Settings → Pages → Source → GitHub Actions**.

The original Python Monte Carlo spike and concept notebook are preserved in [legacy](legacy/); they are not used by the web app.
