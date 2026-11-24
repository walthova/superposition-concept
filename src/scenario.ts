import { statevector, type Circuit, type QuantumBackend } from './quantum';

export const defaultPrompt = 'What if my city made public transit free by 2035?';
export const examples = [
  { label: 'Free transit', prompt: defaultPrompt },
  { label: 'Second bakery', prompt: 'What if I took out a loan to open a second location for my bakery?' },
  { label: 'Lunar base', prompt: 'What if a crew launched the first permanent lunar research base?' },
  { label: 'Four-day week', prompt: 'What if our company shifted to a four-day workweek?' },
];

interface Factor {
  label: string;
  outcomes: [string, string];
}

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
      { label: 'Public adoption', outcomes: ['Residents change their habits slowly.', 'Residents embrace the change faster than expected.'] },
      { label: 'System capacity', outcomes: ['Existing infrastructure strains under new demands.', 'Operators adapt service and capacity to meet demand.'] },
      { label: 'Political support', outcomes: ['Uneven gains spark a backlash over funding.', 'A broad coalition commits to a second phase.'] },
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
      { label: 'Crew momentum', outcomes: ['The crew narrows its mission to essential operations.', 'The crew completes its first objectives ahead of schedule.'] },
      { label: 'Supply reliability', outcomes: ['Delays force engineers to ration critical supplies.', 'Reliable deliveries make experiments and expansion possible.'] },
      { label: 'Program support', outcomes: ['Sponsors insist on a pause to review the risks.', 'Partners commit resources for a second expedition.'] },
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
      { label: 'Team adoption', outcomes: ['Teams keep the old habits that feel safest.', 'Teams redesign their routines around the change.'] },
      { label: 'Operational capacity', outcomes: ['Coordination costs absorb the early gains.', 'New routines free up time for the work that matters most.'] },
      { label: 'Sponsor support', outcomes: ['Leaders roll back the rollout to a small pilot.', 'Leaders fund a wider rollout based on early results.'] },
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
      { label: 'Customer demand', outcomes: ['Sales at the new location start slowly, and some buyers are regulars switching from the original shop.', 'The new location attracts new customers without drawing sales away from the original shop.'] },
      { label: 'Staffing coverage', outcomes: ['Splitting staff between locations leaves rush hours short-handed.', 'A new shift lead keeps both locations covered without pulling you away from the original shop.'] },
      { label: 'Cash flow', outcomes: ['Upfront costs and overlapping bills drain the cash reserve before the new location breaks even.', 'The new location covers its recurring costs while the original shop retains a cash buffer.'] },
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
      { label: 'Adoption', outcomes: ['Most people wait for stronger evidence before committing.', 'Early adopters turn the change into a visible movement.'] },
      { label: 'Capacity', outcomes: ['Limited resources keep the change local.', 'New resources allow the change to spread.'] },
      { label: 'External support', outcomes: ['Outside pressures force a reset.', 'Allies make the next phase easier to sustain.'] },
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

const expansionPrompt = /\b(?:second|third|another|additional|new) (?:physical |retail |coffee )?(?:location|storefront|shop|store|restaurant|caf[eé]|bakery)(?![\p{L}\p{N}_])/u;

export interface Branch {
  index: number;
  bits: string;
  title: string;
  narrative: string;
  amplitude: number;
  probability: number;
  incoherent: number;
}

export interface Scenario {
  prompt: string;
  setting: string;
  depth: number;
  lineage: number[];
  factors: Factor[];
  circuit: Circuit;
  branches: Branch[];
}

function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.codePointAt(0)!, 16777619);
  return value >>> 0;
}

export function generateScenario(
  input: string,
  lineage: readonly number[] = [],
  backend: QuantumBackend = statevector,
): Scenario {
  const prompt = input.trim().replace(/\s+/g, ' ') || defaultPrompt;
  const normalized = prompt.toLowerCase();
  const setting: Setting = expansionPrompt.test(normalized) ? settings.expansion :
    /\b(city|cities|transit|fare|transport|urban|housing)\b/.test(normalized) ? settings.city :
    /\b(orbit|lunar|moon|mars|space|expedition|planet)\b/.test(normalized) ? settings.space :
    /\b(company|office|workweek|team|work|business|organization)\b/.test(normalized) ? settings.work :
    settings.general;
  const angles = setting.factors.map(({ label }, i) => {
    const seeded = 0.78 + (hash(`${normalized}:${label}:${lineage.join('.')}`) % 85) / 100;
    const previous = lineage.at(-1);
    return previous === undefined ? seeded : seeded + (previous & (1 << i) ? 0.25 : -0.25);
  });
  const circuit: Circuit = {
    qubits: 3,
    gates: [
      ...angles.map((angle, target) => ({ kind: 'RY' as const, target, angle })),
      { kind: 'CNOT', control: 0, target: 1 },
      { kind: 'CNOT', control: 1, target: 2 },
      { kind: 'H', target: 0 },
    ],
  };
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
  return { prompt, setting: setting.name, depth, lineage: [...lineage], factors: setting.factors, circuit, branches };
}
