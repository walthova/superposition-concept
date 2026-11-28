# Superposition

**A world simulator where you can walk into possible futures.** Start with a what-if, look at several plausible stories side by side, and observe one to reveal the next set of possibilities. The first build is a concept demo: a 3D possibility map, not a generated 3D world or a forecasting tool.

## Try it

[Open the public demo](https://walthova.github.io/superposition-concept/), or run it locally with Node.js 22 (22.12 or newer).

```sh
npm ci
npm run dev
```

Open the URL Vite prints, including `/superposition-concept/`. Enter a what-if or choose an example. Drag to orbit the map, Shift-scroll or pinch to zoom, and select a timeline node or inspector row to see its story and amplitude. On touch screens, swipe sideways to orbit or vertically to scroll the page. **Measure** samples an outcome from the full distribution, regardless of which timeline you’re inspecting. **Next circuit** uses that outcome as the fork for eight new futures.

## What’s quantum

- An optional AI backend (`worker/`) turns any what-if question into three specific binary factors and eight tailored stories (with browser-local templates as an instant fallback). Sliders on each factor set its `RY` rotation angle (`θ = 2·asin(√p)`). The simulated circuit starts in `|000⟩`, mixes and links the factors with `RY`, `CNOT`, and `H`, and reports signed real amplitudes. Labels display bits in `q2 q1 q0` order.
- A timeline’s weight is its squared amplitude. The inspector compares it with a reference that discards phase after each gate: the difference shows how amplitudes can interfere. The browser uses classical randomness to sample a basis state, then seeds a new circuit with the observed lineage.
- Neither the model weights nor the narratives are predictions. No quantum hardware is connected, and the AI API key lives only in the backend worker (never in the client). Set `VITE_API_URL` at build time (or as a GitHub Pages repository variable) to connect the static frontend to the deployed worker. The circuit and simulator are separate from the renderer; a later version could send the gate description to an IBM Quantum/Qiskit adapter and report measured shot frequencies separately from simulator amplitudes.

## Develop and deploy

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

CI runs lint, type checking, unit tests, and build. The Pages workflow publishes `dist/` on pushes to `main` or manual dispatch. After first selecting **Settings → Pages → Source → GitHub Actions**, run **Deploy to GitHub Pages** from the Actions tab to publish the current `main`.

The original Python Monte Carlo spike and concept notebook are preserved in [legacy](legacy/); they are not used by the web app.
