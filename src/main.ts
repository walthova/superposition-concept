import './style.css';
import { getApiEndpoint, requestAiScenario } from './ai';
import { measure } from './quantum';
import {
  advanceScenario,
  createAiScenario,
  defaultPrompt,
  examples,
  generateScenario,
  normalizePrompt,
  reweightScenario,
  type Branch,
  type Scenario,
} from './scenario';
import { colors, createSpace } from './space';

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const form = element<HTMLFormElement>('prompt-form');
const prompt = element<HTMLTextAreaElement>('prompt');
const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const promptStatus = element('prompt-status');
const observe = element<HTMLButtonElement>('observe');
const observeAction = element('observe-action');
const factorsContainer = element('factors');
const branchList = element('branches');
const detail = element('branch-detail');
const branchAnnouncement = element('branch-announcement');
const observationLabel = element('observation-label');
const observationDetail = element('observation-detail');
const observationStory = element('observation-story');
const mapSelection = element('map-selection');
const stackedWorkspace = matchMedia('(max-width: 730px)');

function formatProbability(probability: number) {
  const percent = probability * 100;
  return percent > 0 && percent < 0.05 ? '<0.1%' : `${percent.toFixed(1)}%`;
}
const signed = (value: number, decimals: number) => `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(decimals)}`;

let scenario: Scenario = generateScenario(defaultPrompt);
let selectedIndex = 0;
let sampled: Branch | undefined;
let pending: number | undefined;
let activeRequest: AbortController | undefined;
let space: ReturnType<typeof createSpace> | undefined;

try {
  space = createSpace(element('space'), index => {
    if (pending === undefined) selectBranch(index);
  });
} catch {
  element('viewport-hint').textContent = '3D unavailable · Explore timelines in the inspector';
}

function setPromptStatus(text: string, state: 'idle' | 'loading' | 'ai' | 'fallback' = 'idle') {
  promptStatus.textContent = text;
  promptStatus.dataset.state = state;
}

function placeBranchDetail(selected: HTMLButtonElement) {
  if (stackedWorkspace.matches) {
    selected.after(detail);
  } else {
    branchList.after(detail);
  }
}

stackedWorkspace.addEventListener('change', () => {
  const selected = branchList.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
  if (selected) placeBranchDetail(selected);
});

function selectBranch(index: number) {
  selectedIndex = index;
  const branch = scenario.branches[index];
  space?.select(index);
  mapSelection.textContent = sampled ? `Measured: ${sampled.title}` : `Inspecting: ${branch.title}`;
  for (const button of branchList.querySelectorAll('button')) {
    const selected = Number(button.dataset.index) === index;
    button.setAttribute('aria-pressed', String(selected));
    if (selected) placeBranchDetail(button);
  }
  detail.style.setProperty('--branch-color', colors[index]);
  detail.innerHTML = `
    <p class="eyebrow">TIMELINE <span>|${branch.bits}⟩</span></p>
    <p class="narrative"></p>
    <dl class="metrics">
      <div><dt>AMPLITUDE</dt><dd>${signed(branch.amplitude, 3)}</dd></div>
      <div><dt>DEPHASED P</dt><dd>${formatProbability(branch.incoherent)}</dd></div>
      <div><dt>SHIFT</dt><dd>${signed((branch.probability - branch.incoherent) * 100, 1)} pp</dd></div>
    </dl>`;
  detail.querySelector('.narrative')!.textContent = branch.narrative;
  branchAnnouncement.textContent = `${branch.title}. ${branch.narrative}`;
}

function renderCircuit({ circuit, factors }: Scenario) {
  const table = document.createElement('table');
  table.setAttribute('aria-label', 'Circuit: RY on each qubit, CNOT q0 to q1, CNOT q1 to q2, H on q0, then measure');
  const tbody = document.createElement('tbody');

  factors.forEach((factor, qubit) => {
    const row = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.title = factor.label;
    th.textContent = `q${qubit}`;
    row.append(th);

    for (const gate of circuit.gates) {
      const td = document.createElement('td');
      if (gate.kind === 'CNOT') {
        if (gate.control === qubit || gate.target === qubit) {
          const glyph = gate.control === qubit ? '●' : '⊕';
          const segment = qubit === Math.min(gate.target, gate.control) ? 'down' : 'up';
          td.className = `linked ${segment}`;
          const span = document.createElement('span');
          span.title = `CNOT q${gate.control} → q${gate.target}`;
          span.textContent = glyph;
          td.append(span);
        }
      } else if (gate.target === qubit) {
        const span = document.createElement('span');
        span.className = 'gate';
        span.title = gate.kind === 'RY' ? `RY ${gate.angle.toFixed(2)} radians` : 'Hadamard';
        span.textContent = gate.kind;
        td.append(span);
      }
      row.append(td);
    }

    const measureCell = document.createElement('td');
    const measureGate = document.createElement('span');
    measureGate.className = 'gate measure';
    measureGate.title = 'Measure';
    measureGate.textContent = 'M';
    measureCell.append(measureGate);
    row.append(measureCell);
    tbody.append(row);
  });

  table.append(tbody);

  const key = document.createElement('div');
  key.className = 'factor-key';
  factors.forEach((factor, index) => {
    const item = document.createElement('span');
    const badge = document.createElement('b');
    badge.textContent = `q${index}`;
    item.append(badge, ` ${factor.label}`);
    key.append(item);
  });
  const bitOrder = document.createElement('span');
  bitOrder.append('Bit order: ');
  const orderCode = document.createElement('b');
  orderCode.textContent = '|q2 q1 q0⟩';
  bitOrder.append(orderCode);
  key.append(bitOrder);

  element('circuit').replaceChildren(table, key);
}

function renderFactorSliders(current: Scenario) {
  factorsContainer.replaceChildren(...current.factors.map((factor, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'factor-control';

    const row = document.createElement('div');
    row.className = 'factor-row';

    const title = document.createElement('label');
    title.className = 'factor-title';
    title.htmlFor = `factor-slider-${index}`;
    const badge = document.createElement('b');
    badge.textContent = `q${index}`;
    const labelText = document.createElement('span');
    labelText.textContent = factor.label;
    labelText.title = factor.label;
    title.append(badge, labelText);

    const readout = document.createElement('span');
    readout.className = 'factor-value';
    readout.dataset.factorIndex = String(index);
    const pct = Math.round(current.likelihoods[index] * 100);
    readout.textContent = `${pct}%`;

    row.append(title, readout);

    const slider = document.createElement('input');
    slider.id = `factor-slider-${index}`;
    slider.type = 'range';
    slider.className = 'factor-slider';
    slider.min = '5';
    slider.max = '95';
    slider.step = '1';
    slider.value = String(Math.min(95, Math.max(5, pct)));
    slider.setAttribute('aria-label', `${factor.label} likelihood (${factor.lowLabel} to ${factor.highLabel})`);
    slider.addEventListener('input', () => {
      const value = Number(slider.value);
      readout.textContent = `${value}%`;
      const nextLikelihoods: [number, number, number] = [...scenario.likelihoods];
      nextLikelihoods[index] = value / 100;
      applyReweight(nextLikelihoods);
    });

    const poles = document.createElement('div');
    poles.className = 'factor-poles';
    const low = document.createElement('span');
    low.textContent = `0: ${factor.lowLabel}`;
    const high = document.createElement('span');
    high.textContent = `1: ${factor.highLabel}`;
    poles.append(low, high);

    wrapper.append(row, slider, poles);
    return wrapper;
  }));
}

function updateBranchProbabilities() {
  for (const button of branchList.querySelectorAll<HTMLButtonElement>('button.branch')) {
    const idx = Number(button.dataset.index);
    const branch = scenario.branches[idx];
    const probEl = button.querySelector('.probability');
    if (branch && probEl) {
      probEl.textContent = formatProbability(branch.probability);
    }
  }
}

function applyReweight(nextLikelihoods: [number, number, number]) {
  const wasSampled = Boolean(sampled);
  scenario = reweightScenario(scenario, nextLikelihoods);
  renderCircuit(scenario);
  updateBranchProbabilities();
  if (wasSampled) {
    resetMeasurement();
    space?.uncollapse(scenario.branches);
  } else {
    space?.updateWeights(scenario.branches);
  }
  selectBranch(selectedIndex);
}

function renderScenario(observation?: Branch) {
  element('phase').textContent = `Horizon ${scenario.depth + 1} · 8 basis states`;
  const sourceLabel = scenario.source === 'ai' ? 'AI-authored' : 'local template';
  element('setting').textContent = `${scenario.setting} · ${sourceLabel}`;
  renderCircuit(scenario);
  renderFactorSliders(scenario);
  branchList.replaceChildren(...scenario.branches.map(branch => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'branch';
    button.style.setProperty('--branch-color', colors[branch.index]);
    button.dataset.index = String(branch.index);

    const dot = document.createElement('span');
    dot.className = 'branch-dot';
    dot.setAttribute('aria-hidden', 'true');

    const bits = document.createElement('span');
    bits.className = 'bits';
    bits.textContent = branch.bits;

    const name = document.createElement('span');
    name.className = 'branch-name';
    name.textContent = branch.title;

    const probability = document.createElement('span');
    probability.className = 'probability';
    probability.textContent = formatProbability(branch.probability);

    button.append(dot, bits, name, probability);
    button.addEventListener('click', () => selectBranch(branch.index));
    return button;
  }));
  space?.setBranches(scenario.branches, observation?.index);
  const mostLikely = scenario.branches.reduce((a, b) => a.probability >= b.probability ? a : b);
  selectBranch(mostLikely.index);
}

function setLoading(loading: boolean) {
  submitButton.disabled = loading;
  submitButton.textContent = loading ? 'Building…' : 'Run what-if';
}

async function generate(input: string, useAi = true) {
  activeRequest?.abort();
  activeRequest = undefined;
  window.clearTimeout(pending);
  pending = undefined;
  observe.disabled = false;

  const normalized = normalizePrompt(input);
  prompt.value = normalized;

  if (!useAi || !getApiEndpoint()) {
    setLoading(false);
    scenario = generateScenario(normalized);
    resetMeasurement();
    renderScenario();
    setPromptStatus(
      getApiEndpoint()
        ? 'Drag factor sliders to reweight the 3-qubit circuit, or run any question with AI.'
        : 'Local template mode · drag factor sliders to reweight the 3-qubit circuit.',
      'idle',
    );
    return;
  }

  const controller = new AbortController();
  activeRequest = controller;
  setLoading(true);
  setPromptStatus('Generating 3 factors and 8 timeline stories with AI…', 'loading');

  try {
    const data = await requestAiScenario(normalized, { signal: controller.signal });
    if (controller.signal.aborted) return;
    scenario = createAiScenario(normalized, data);
    resetMeasurement();
    renderScenario();
    setPromptStatus('AI-built factors & 8 stories · drag sliders to reweight the circuit.', 'ai');
  } catch (error) {
    if (controller.signal.aborted) return;
    scenario = generateScenario(normalized);
    resetMeasurement();
    renderScenario();
    const reason = error instanceof Error ? error.message : 'request failed';
    setPromptStatus(`AI unavailable (${reason}) · showing local template. Drag sliders to reweight.`, 'fallback');
  } finally {
    if (activeRequest === controller) {
      activeRequest = undefined;
      setLoading(false);
    }
  }
}

function resetMeasurement() {
  sampled = undefined;
  observeAction.textContent = 'Measure';
  observationLabel.textContent = 'READY TO MEASURE';
  observationDetail.textContent = 'Inspect any timeline. Measure samples from all eight basis states.';
  observationStory.hidden = true;
  observationStory.textContent = '';
}

form.addEventListener('submit', event => {
  event.preventDefault();
  void generate(prompt.value, true);
});

prompt.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    form.requestSubmit();
  }
});

element('examples').replaceChildren(...examples.map(example => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = example.label;
  button.addEventListener('click', () => {
    void generate(example.prompt, true);
  });
  return button;
}));

observe.addEventListener('click', () => {
  if (pending !== undefined) return;
  if (!sampled) {
    sampled = scenario.branches[measure(scenario.branches.map(branch => branch.probability))];
    selectBranch(sampled.index);
    space?.collapseTo(sampled.index);
    observationLabel.textContent = `MEASURED |${sampled.bits}⟩ · ${formatProbability(sampled.probability)} BEFORE MEASUREMENT`;
    observationDetail.textContent = sampled.title;
    observationStory.textContent = sampled.narrative;
    observationStory.hidden = false;
    observeAction.textContent = 'Next circuit';
    return;
  }
  const previous = sampled;
  scenario = advanceScenario(scenario, previous.index);
  resetMeasurement();
  observe.disabled = true;
  renderScenario(previous);
  pending = window.setTimeout(() => {
    pending = undefined;
    observe.disabled = false;
  }, space && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 1120 : 0);
});

void generate(defaultPrompt, false);
