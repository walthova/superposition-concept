import { statevector, type Circuit, type QuantumBackend } from './quantum';

export const defaultPrompt = 'What if my city made public transit free by 2035?';
export const examples = [
  { label: 'Free transit', prompt: defaultPrompt },
  { label: 'Second bakery', prompt: 'What if I took out a loan to open a second location for my bakery?' },
  { label: 'Lunar base', prompt: 'What if a crew launched the first permanent lunar research base?' },
  { label: 'Four-day week', prompt: 'What if our company shifted to a four-day workweek?' },
];

export interface Factor {
  label: string;
  lowLabel: string;
  highLabel: string;
  outcomes: [string, string];
}

export interface AiFactorInput {
  label: string;
  lowLabel: string;
  highLabel: string;
  likelihood: number;
}

export interface AiBranchInput {
  bits: string;
  title: string;
  narrative: string;
}

export interface AiScenarioData {
  setting: string;
  factors: [AiFactorInput, AiFactorInput, AiFactorInput];
  branches: AiBranchInput[];
}

export type ScenarioSource = 'ai' | 'local';

type Events = [Factor['outcomes'], Factor['outcomes'], Factor['outcomes']];

interface Setting {
  name: string;
  factors: [Factor, Factor, Factor];
  continuations: [Events, Events, Events];
  titles?: [string, string, string, string, string, string, string, string];
  consequences?: [string, string, string, string];
}

const settings = {
  city: {
    name: 'Civic systems',
    factors: [
      { label: 'Public adoption', lowLabel: 'Slow shift', highLabel: 'Rapid uptake', outcomes: ['Residents change their habits slowly.', 'Residents embrace the change faster than expected.'] },
      { label: 'System capacity', lowLabel: 'Strained fleet', highLabel: 'Adaptive service', outcomes: ['Existing infrastructure strains under new demands.', 'Operators adapt service and capacity to meet demand.'] },
      { label: 'Political support', lowLabel: 'Funding backlash', highLabel: 'Broad coalition', outcomes: ['Uneven gains spark a backlash over funding.', 'A broad coalition commits to a second phase.'] },
    ],
    continuations: [
      [
        ['Riders make fewer discretionary trips.', 'Daily routines re-form around transit.'],
        ['Maintenance backlogs limit new routes.', 'A redesigned network reaches underserved neighborhoods.'],
        ['The city scales back the program at its next budget vote.', 'Neighboring districts agree to share the costs.'],
      ],
      [
        ['Displaced riders buy cars to regain reliable access.', 'More households choose to live without a second car.'],
        ['Crowding pushes wait times past the service target.', 'Dedicated lanes make bus journeys more reliable.'],
        ['A legal challenge delays the next funding package.', 'A regional ballot measure funds service improvements.'],
      ],
      [
        ['Employers return to subsidizing parking.', 'Employers stagger shifts around the most frequent routes.'],
        ['An aging fleet forces operators to shorten service hours.', 'A new depot supports overnight service.'],
        ['The council moves expansion funds to road repairs.', 'A regional board adopts a permanent funding formula.'],
      ],
    ],
  },
  space: {
    name: 'Exploration systems',
    factors: [
      { label: 'Crew momentum', lowLabel: 'Essential ops', highLabel: 'Ahead of plan', outcomes: ['The crew narrows its mission to essential operations.', 'The crew completes its first objectives ahead of schedule.'] },
      { label: 'Supply reliability', lowLabel: 'Rationed cargo', highLabel: 'Steady resupply', outcomes: ['Delays force engineers to ration critical supplies.', 'Reliable deliveries make experiments and expansion possible.'] },
      { label: 'Program support', lowLabel: 'Risk pause', highLabel: 'Second mission', outcomes: ['Sponsors insist on a pause to review the risks.', 'Partners commit resources for a second expedition.'] },
    ],
    continuations: [
      [
        ['The crew suspends fieldwork to keep the habitat running.', 'The crew sets up a remote science station.'],
        ['A missed delivery delays the next rotation.', 'Local production reduces reliance on shipments.'],
        ['Funders redirect the program to shorter missions.', 'A joint mission brings a second crew and new equipment.'],
      ],
      [
        ['The crew shifts to remote experiments after equipment failures.', 'The crew charts a route to an unexplored ridge.'],
        ['Replacement parts sit on the ground awaiting transport.', 'A common docking standard opens a second supply route.'],
        ['Mission control cancels a planned habitat wing.', 'A university consortium funds a shared laboratory.'],
      ],
      [
        ['The crew packs up an aging outpost.', 'A new crew takes over the long-running field studies.'],
        ['Power shortages ground the surface vehicles.', 'A new storage system keeps the base running through outages.'],
        ['Partners consolidate the program into a single site.', 'The partners sign a long-term agreement to maintain several sites.'],
      ],
    ],
  },
  work: {
    name: 'Organizational systems',
    factors: [
      { label: 'Team adoption', lowLabel: 'Old habits', highLabel: 'New routines', outcomes: ['Teams keep the old habits that feel safest.', 'Teams redesign their routines around the change.'] },
      { label: 'Operational capacity', lowLabel: 'Coordination drag', highLabel: 'Focused time', outcomes: ['Coordination costs absorb the early gains.', 'New routines free up time for the work that matters most.'] },
      { label: 'Sponsor support', lowLabel: 'Small pilot', highLabel: 'Wider rollout', outcomes: ['Leaders roll back the rollout to a small pilot.', 'Leaders fund a wider rollout based on early results.'] },
    ],
    continuations: [
      [
        ['Some teams return to their previous schedule.', 'Teams agree on a shared schedule that protects focus time.'],
        ['Customer handoffs get slower as coverage gaps appear.', 'Cross-training helps teams cover the gaps.'],
        ['Leaders keep the experiment limited to one department.', 'Leaders make the new routines the company-wide default.'],
      ],
      [
        ['New hires struggle to learn the split schedule.', 'Teams write a common handbook for newcomers.'],
        ['Urgent requests pile up between shifts.', 'A rotating duty team takes urgent requests without interrupting everyone.'],
        ['Managers restore old performance targets.', 'Leaders tie evaluations to delivered outcomes rather than hours.'],
      ],
      [
        ['Experienced staff move to teams with predictable hours.', 'Experienced staff mentor teams trying the new routine.'],
        ['Busy periods lead to unplanned overtime.', 'Forecasting helps teams schedule extra coverage before busy periods.'],
        ['Leadership replaces the program with smaller trials.', 'Leadership makes the flexible schedule part of new contracts.'],
      ],
    ],
  },
  expansion: {
    name: 'Business expansion',
    titles: [
      'A Cash Squeeze', 'Busy but Stretched', 'Ready but Quiet', 'Busy Without a Buffer',
      'A Slow, Funded Start', 'A Capacity Crunch', 'Room to Build', 'A Sustainable Start',
    ],
    consequences: [
      '',
      'You review both locations before committing to another lease.',
      'You revisit which hours each location can afford to stay open.',
      'You compare operating costs across both locations before replacing equipment.',
    ],
    factors: [
      { label: 'Customer demand', lowLabel: 'Slow traffic', highLabel: 'New buyers', outcomes: ['Sales at the new location start slowly, and some buyers are regulars switching from the original shop.', 'The new location attracts new customers without drawing sales away from the original shop.'] },
      { label: 'Staffing coverage', lowLabel: 'Short-handed', highLabel: 'Covered shifts', outcomes: ['Splitting staff between locations leaves rush hours short-handed.', 'A new shift lead keeps both locations covered without pulling you away from the original shop.'] },
      { label: 'Cash flow', lowLabel: 'Reserve squeeze', highLabel: 'Cash buffer', outcomes: ['Upfront costs and overlapping bills drain the cash reserve before the new location breaks even.', 'The new location covers its recurring costs while the original shop retains a cash buffer.'] },
    ],
    continuations: [
      [
        ['Opening-week traffic fades and weekday sales stay low.', 'Repeat visits make weekday sales steadier.'],
        ['Last-minute absences force shorter opening hours.', 'Cross-training lets staff cover absences at either location.'],
        ['Payroll and rent come due before enough sales come in.', 'The new location starts contributing cash after payroll and rent.'],
      ],
      [
        ['A nearby competitor draws customers away from the new location.', 'Local partnerships bring a steady stream of orders to the new location.'],
        ['The original shop loses service capacity when its experienced staff cover the new one.', 'Promoting a second shift lead frees up time to run both locations.'],
        ['Supplier bills eat into the money set aside for operating costs.', 'Better supplier terms leave cash available for unexpected bills.'],
      ],
      [
        ['Customers keep choosing the original shop because the new location is less convenient.', 'The new location builds a customer base of its own.'],
        ['Hiring delays leave both locations relying on overtime.', 'Predictable schedules reduce overtime across both locations.'],
        ['An equipment replacement forces you to postpone other spending.', 'Cash reserves cover an equipment replacement without disrupting payroll.'],
      ],
    ],
  },
  general: {
    name: 'Open scenario',
    factors: [
      { label: 'Adoption', lowLabel: 'Wait and see', highLabel: 'Early momentum', outcomes: ['Most people wait for stronger evidence before committing.', 'Early adopters turn the change into a visible movement.'] },
      { label: 'Capacity', lowLabel: 'Tight limits', highLabel: 'Room to scale', outcomes: ['Limited resources keep the change local.', 'New resources allow the change to spread.'] },
      { label: 'External support', lowLabel: 'Outside pushback', highLabel: 'Allied backing', outcomes: ['Outside pressures force a reset.', 'Allies make the next phase easier to sustain.'] },
    ],
    continuations: [
      [
        ['Participants return to familiar routines.', 'The first participants bring in a second wave.'],
        ['The group narrows its effort to what it can sustain.', 'The group builds enough capacity to try a larger version.'],
        ['Supporters ask how the changes can be reversed.', 'A new partner takes responsibility for the next phase.'],
      ],
      [
        ['Disagreements drive some participants to leave.', 'Participants form a group to resolve disputes.'],
        ['The organizers put a new project on hold.', 'The organizers finish a project that frees up shared resources.'],
        ['A partner withdraws from a planned commitment.', 'Several partners pool their resources instead of acting alone.'],
      ],
      [
        ['Newcomers opt out after the first setbacks.', 'Newcomers adapt the approach to a different setting.'],
        ['The work comes to depend on a few overextended people.', 'The group distributes responsibilities so more people can contribute.'],
        ['Supporters fund only the smallest version.', 'Supporters establish a shared fund to carry the work forward.'],
      ],
    ],
  },
} satisfies Record<string, Setting>;

const defaultTitles = [
  'The Slow Drift', 'The Early Spark', 'The Quiet Pivot', 'The Breakaway',
  'The Patient Build', 'The Uneven Wave', 'The Long Arc', 'The New Equilibrium',
];

const defaultConsequences = [
  '',
  'An independent review tests whether the changes can hold up under stress.',
  'The people most affected organize a public process to challenge the next decision.',
  'Another group tries to reproduce the results under different conditions.',
];

const siteEnd = String.raw`(?![\p{L}\p{N}_])`;
const businessSite = String.raw`(?:(?:business |physical |retail )?location|(?:(?!(?:at|in|of|to) )[\p{L}-]+ ){0,2}(?:storefront|shop|store|restaurant|caf[eé]|bakery))${siteEnd}`;
const openingSite = new RegExp(
  String.raw`\b(?:open(?:s|ed|ing)?(?: up)?|add(?:s|ed|ing)?) (?:a |an |my |our |its |their |the )?(second|another|additional|new) ${businessSite}`, 'gu',
);
const keepingSite = new RegExp(
  String.raw`^ (?:alongside|in addition to) (?:my |our |its |their |the )?(?:existing|current|original|first) (?:one${siteEnd}|${businessSite})`, 'u',
);

function isSecondSiteOpening(prompt: string): boolean {
  for (const opening of prompt.matchAll(openingSite)) {
    if (opening[1] !== 'new' || keepingSite.test(prompt.slice(opening.index + opening[0].length))) return true;
  }
  return false;
}

export interface Branch {
  index: number;
  bits: string;
  title: string;
  narrative: string;
  baseNarrative?: string;
  amplitude: number;
  probability: number;
  incoherent: number;
}

export interface Scenario {
  prompt: string;
  setting: string;
  source: ScenarioSource;
  depth: number;
  lineage: number[];
  factors: [Factor, Factor, Factor];
  likelihoods: [number, number, number];
  circuit: Circuit;
  branches: Branch[];
}

export function clampLikelihood(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

export function angleFromLikelihood(likelihood: number): number {
  return 2 * Math.asin(Math.sqrt(clampLikelihood(likelihood)));
}

export function likelihoodFromAngle(angle: number): number {
  const s = Math.sin(angle / 2);
  return clampLikelihood(s * s);
}

export function buildCircuitFromAngles(angles: readonly [number, number, number]): Circuit {
  return {
    qubits: 3,
    gates: [
      ...angles.map((angle, target) => ({ kind: 'RY' as const, target, angle })),
      { kind: 'CNOT', control: 0, target: 1 },
      { kind: 'CNOT', control: 1, target: 2 },
      { kind: 'H', target: 0 },
    ],
  };
}

export function buildCircuitFromLikelihoods(likelihoods: readonly [number, number, number]): Circuit {
  return buildCircuitFromAngles([
    angleFromLikelihood(likelihoods[0]),
    angleFromLikelihood(likelihoods[1]),
    angleFromLikelihood(likelihoods[2]),
  ]);
}

function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.codePointAt(0)!, 16777619);
  return value >>> 0;
}

export function normalizePrompt(input: string): string {
  return input.trim().replace(/\s+/g, ' ') || defaultPrompt;
}

export function generateScenario(
  input: string,
  lineage: readonly number[] = [],
  backend: QuantumBackend = statevector,
): Scenario {
  const prompt = normalizePrompt(input);
  const normalized = prompt.toLowerCase();
  const setting: Setting = isSecondSiteOpening(normalized) ? settings.expansion :
    /\b(city|cities|transit|fare|transport|urban|housing)\b/.test(normalized) ? settings.city :
    /\b(orbit|lunar|moon|mars|space|expedition|planet)\b/.test(normalized) ? settings.space :
    /\b(company|office|workweek|team|work|business|organization)\b/.test(normalized) ? settings.work :
    settings.general;
  const angles = setting.factors.map(({ label }, i) => {
    const seeded = 0.78 + (hash(`${normalized}:${label}:${lineage.join('.')}`) % 85) / 100;
    const previous = lineage.at(-1);
    return previous === undefined ? seeded : seeded + (previous & (1 << i) ? 0.25 : -0.25);
  }) as [number, number, number];
  const likelihoods = angles.map(likelihoodFromAngle) as [number, number, number];
  const circuit = buildCircuitFromAngles(angles);
  const { amplitudes, probabilities, incoherent } = backend.run(circuit);
  const prior = lineage.at(-1);
  const depth = lineage.length;
  const variants = setting.continuations.length;
  const combinations = variants ** setting.factors.length;
  const step = Math.max(0, depth - 1);
  const beat = (step * (combinations - 2) + hash(`${normalized}:${lineage[0]}`)) % combinations;
  const outcomes = setting.factors.map((factor, i) =>
    depth === 0 ? factor.outcomes : setting.continuations[Math.floor(beat / variants ** i) % variants][i],
  );
  const consequences = setting.consequences ?? defaultConsequences;
  const consequence = consequences[Math.floor(step / combinations) % consequences.length];
  const titles = setting.titles ?? defaultTitles;
  const branches = amplitudes.map((amplitude, index) => ({
    index,
    bits: index.toString(2).padStart(circuit.qubits, '0'),
    title: titles[index],
    narrative: `${prior === undefined ? '' : `After ${titles[prior]}: `}${[...outcomes.map((pair, i) => pair[(index >> i) & 1]), consequence].filter(Boolean).join(' ')}`,
    amplitude,
    probability: probabilities[index],
    incoherent: incoherent[index],
  }));
  return {
    prompt,
    setting: setting.name,
    source: 'local',
    depth,
    lineage: [...lineage],
    factors: setting.factors,
    likelihoods,
    circuit,
    branches,
  };
}

export function createAiScenario(
  input: string,
  data: AiScenarioData,
  lineage: readonly number[] = [],
  backend: QuantumBackend = statevector,
): Scenario {
  const prompt = normalizePrompt(input);
  const factors = data.factors.map(factor => ({
    label: factor.label.trim(),
    lowLabel: factor.lowLabel.trim(),
    highLabel: factor.highLabel.trim(),
    outcomes: [factor.lowLabel.trim(), factor.highLabel.trim()] as [string, string],
  })) as [Factor, Factor, Factor];
  const likelihoods = data.factors.map(factor =>
    Math.min(0.95, Math.max(0.05, clampLikelihood(factor.likelihood))),
  ) as [number, number, number];
  const circuit = buildCircuitFromLikelihoods(likelihoods);
  const { amplitudes, probabilities, incoherent } = backend.run(circuit);
  const byBits = new Map(data.branches.map(branch => [branch.bits, branch]));
  const branches = amplitudes.map((amplitude, index) => {
    const bits = index.toString(2).padStart(circuit.qubits, '0');
    const authored = byBits.get(bits) ?? data.branches[index];
    const baseNarrative = authored?.narrative.trim() || '';
    return {
      index,
      bits,
      title: authored?.title.trim() || defaultTitles[index],
      narrative: baseNarrative,
      baseNarrative,
      amplitude,
      probability: probabilities[index],
      incoherent: incoherent[index],
    };
  });
  return {
    prompt,
    setting: data.setting.trim() || 'AI scenario',
    source: 'ai',
    depth: lineage.length,
    lineage: [...lineage],
    factors,
    likelihoods,
    circuit,
    branches,
  };
}

export function reweightScenario(
  scenario: Scenario,
  nextLikelihoods: readonly [number, number, number],
  backend: QuantumBackend = statevector,
): Scenario {
  const likelihoods = nextLikelihoods.map(clampLikelihood) as [number, number, number];
  const circuit = buildCircuitFromLikelihoods(likelihoods);
  const { amplitudes, probabilities, incoherent } = backend.run(circuit);
  const branches = scenario.branches.map((branch, index) => ({
    ...branch,
    amplitude: amplitudes[index],
    probability: probabilities[index],
    incoherent: incoherent[index],
  }));
  return { ...scenario, likelihoods, circuit, branches };
}

export function advanceScenario(
  scenario: Scenario,
  observedIndex: number,
  backend: QuantumBackend = statevector,
): Scenario {
  const lineage = [...scenario.lineage, observedIndex];
  if (scenario.source === 'local') {
    return generateScenario(scenario.prompt, lineage, backend);
  }
  const previous = scenario.branches[observedIndex];
  const nudged = scenario.likelihoods.map((value, i) => {
    const delta = observedIndex & (1 << i) ? 0.12 : -0.12;
    return Math.min(0.95, Math.max(0.05, clampLikelihood(value + delta)));
  }) as [number, number, number];
  const reweighted = reweightScenario(scenario, nudged, backend);
  const prefix = previous ? `After ${previous.title}: ` : '';
  return {
    ...reweighted,
    depth: lineage.length,
    lineage,
    branches: reweighted.branches.map(branch => {
      const base = branch.baseNarrative ?? branch.narrative;
      return {
        ...branch,
        baseNarrative: base,
        narrative: prefix ? `${prefix}${base}` : base,
      };
    }),
  };
}
