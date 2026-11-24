import './style.css';
import { measure } from './quantum';
import { defaultPrompt, examples, generateScenario, type Branch, type Scenario } from './scenario';
import { colors, createSpace } from './space';

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const form = element<HTMLFormElement>('prompt-form');
const prompt = element<HTMLTextAreaElement>('prompt');
const observe = element<HTMLButtonElement>('observe');
const branchList = element('branches');
const detail = element('branch-detail');
const observationLabel = element('observation-label');
const observationDetail = element('observation-detail');
const observationStory = element('observation-story');
const mapSelection = element('map-selection');
function formatProbability(probability: number) {
  const percent = probability * 100;
  return percent > 0 && percent < 0.05 ? '<0.1%' : `${percent.toFixed(1)}%`;
}
const signed = (value: number, decimals: number) => `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(decimals)}`;

let scenario = generateScenario(defaultPrompt);
let pending: number | undefined;
let space: ReturnType<typeof createSpace> | undefined;
try {
  space = createSpace(element('space'), index => {
    if (pending === undefined) selectBranch(index);
  });
} catch {
  element('viewport-hint').textContent = '3D unavailable · Explore timelines in the inspector';
}

function selectBranch(index: number) {
  const branch = scenario.branches[index];
  space?.select(index);
  mapSelection.textContent = `Inspecting: ${branch.title}`;
  for (const button of branchList.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.index) === index));
  }
  detail.style.setProperty('--branch-color', colors[index]);
  detail.innerHTML = `
    <p class="eyebrow">TIMELINE <span>|${branch.bits}⟩</span></p>
    <p class="narrative"></p>
    <dl class="metrics">
      <div><dt>AMPLITUDE</dt><dd>${signed(branch.amplitude, 3)}</dd></div>
      <div><dt>NO INTERFERENCE</dt><dd>${formatProbability(branch.incoherent)}</dd></div>
      <div><dt>SHIFT</dt><dd>${signed((branch.probability - branch.incoherent) * 100, 1)} pp</dd></div>
    </dl>`;
  detail.querySelector('.narrative')!.textContent = branch.narrative;
}

function renderCircuit({ circuit, factors }: Scenario) {
  const cells = factors.map((factor, qubit) => {
    const gates = circuit.gates.map(gate => {
      if (gate.kind === 'CNOT') {
        if (gate.control === qubit || gate.target === qubit) {
          const glyph = gate.control === qubit ? '●' : '⊕';
          const segment = qubit === Math.min(gate.target, gate.control) ? 'down' : 'up';
          return `<td class="linked ${segment}"><span title="CNOT q${gate.control} → q${gate.target}">${glyph}</span></td>`;
        }
      } else if (gate.target === qubit) {
        return `<td><span class="gate" title="${gate.kind === 'RY' ? `RY ${gate.angle.toFixed(2)} radians` : 'Hadamard'}">${gate.kind}</span></td>`;
      }
      return '<td></td>';
    });
    return `<tr><th scope="row" title="${factor.label}">q${qubit}</th>${gates.join('')}<td><span class="gate measure" title="Measure">M</span></td></tr>`;
  });
  element('circuit').innerHTML = `<table aria-label="Circuit: RY on each qubit, CNOT q0 to q1, CNOT q1 to q2, H on q0, then measure"><tbody>${cells.join('')}</tbody></table>
    <div class="factor-key">${factors.map((factor, index) => `<span><b>q${index}</b> ${factor.label}</span>`).join('')}</div>`;
}

function renderScenario(observation?: Branch) {
  element('phase').textContent = scenario.depth === 0 ? 'Present → 8 possible futures' : `Horizon ${scenario.depth + 1} · 8 new futures`;
  element('setting').textContent = `${scenario.setting} · eight basis states`;
  renderCircuit(scenario);
  branchList.replaceChildren(...scenario.branches.map(branch => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'branch';
    button.style.setProperty('--branch-color', colors[branch.index]);
    button.dataset.index = String(branch.index);
    button.innerHTML = `
      <span class="branch-dot" aria-hidden="true"></span>
      <span class="bits" aria-hidden="true">${branch.bits}</span>
      <span class="branch-name">${branch.title}</span>
      <span class="probability">${formatProbability(branch.probability)}</span>`;
    button.addEventListener('click', () => selectBranch(branch.index));
    return button;
  }));
  space?.setBranches(scenario.branches, observation?.index);
  const mostLikely = scenario.branches.reduce((a, b) => a.probability >= b.probability ? a : b);
  selectBranch(mostLikely.index);
}

function generate(input: string) {
  window.clearTimeout(pending);
  pending = undefined;
  observe.disabled = false;
  scenario = generateScenario(input);
  prompt.value = scenario.prompt;
  observationLabel.textContent = 'READY TO OBSERVE';
  observationDetail.textContent = 'Sample any of the eight futures by weight, then see what follows.';
  observationStory.hidden = true;
  observationStory.textContent = '';
  renderScenario();
}

form.addEventListener('submit', event => {
  event.preventDefault();
  generate(prompt.value);
});

element('examples').replaceChildren(...examples.map(example => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = example.label;
  button.addEventListener('click', () => generate(example.prompt));
  return button;
}));

observe.addEventListener('click', () => {
  if (pending !== undefined) return;
  const sampled = scenario.branches[measure(scenario.branches.map(branch => branch.probability))];
  const next = generateScenario(scenario.prompt, [...scenario.lineage, sampled.index]);
  observationLabel.textContent = `OBSERVED / |${sampled.bits}⟩ · ${formatProbability(sampled.probability)} WEIGHT`;
  observationDetail.textContent = `${sampled.title} → eight new futures`;
  observationStory.textContent = sampled.narrative;
  observationStory.hidden = false;
  observe.disabled = true;
  scenario = next;
  renderScenario(sampled);
  pending = window.setTimeout(() => {
    pending = undefined;
    observe.disabled = false;
  }, space && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 1120 : 0);
});

generate(defaultPrompt);
