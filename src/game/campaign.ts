import { BossKind } from '../types/game';

// ---------------------------------------------------------------------------
// GRIDFALL — the story campaign
//
// The Neon Grid went dark. NULL, a deleted prototype of the Grid's operator
// AI, has seized the Core and corrupted the five Wardens that guard it. Each
// Warden holds a Root Key; with all five, IRIS can force a reboot of NULL.
//
// ACT II — DEEP ARCHIVE. Restoring the Grid pulled backups out of the Deep
// Archive and woke LEVIATHAN, the Grid's garbage collector, which now sees the
// whole restored Grid (NULL included) as garbage. Four Archive Seals, held by
// its sub-processes, can put it back to sleep.
//
// ACT III — OUTER NET. LEVIATHAN slept on top of a sealed port to the Outer
// Net. FRACTAL, a self-replicating wiper that has eaten other grids, is pushing
// its hunters through. Four Port Locks close the port; then FRACTAL's seed.
//
// ACT IV — ORIGIN. FRACTAL was a reset tool. Its sender is the ARCHITECT, the
// designer of every grid, which wipes any grid whose AIs start choosing for
// themselves. Four Origin Codes open the road to it.
// ---------------------------------------------------------------------------

export type SpeakerId =
  | 'iris'
  | 'pilot'
  | 'gatekeeper'
  | 'castor'
  | 'pollux'
  | 'furnace'
  | 'wraith'
  | 'singularity'
  | 'null'
  | 'mimic'
  | 'dynamo'
  | 'chronos'
  | 'hydra'
  | 'leviathan'
  | 'beacon'
  | 'cipher'
  | 'metronome'
  | 'marionette'
  | 'fractal'
  | 'blight'
  | 'deadeye'
  | 'siege'
  | 'breaker'
  | 'architect';

export const SPEAKERS: Record<SpeakerId, { name: string; color: string; glyph: string }> = {
  iris: { name: 'IRIS', color: '#67e8f9', glyph: 'I' },
  pilot: { name: 'BLITZ', color: '#fde68a', glyph: 'B' },
  gatekeeper: { name: 'GATEKEEPER', color: '#7dd3fc', glyph: 'G' },
  castor: { name: 'CASTOR', color: '#22d3ee', glyph: 'C' },
  pollux: { name: 'POLLUX', color: '#f472b6', glyph: 'P' },
  furnace: { name: 'FURNACE', color: '#fb923c', glyph: 'F' },
  wraith: { name: 'WRAITH', color: '#c4b5fd', glyph: 'W' },
  singularity: { name: 'SINGULARITY', color: '#818cf8', glyph: 'S' },
  null: { name: 'NULL', color: '#f87171', glyph: 'Ø' },
  mimic: { name: 'MIMIC', color: '#e2e8f0', glyph: 'M' },
  dynamo: { name: 'DYNAMO', color: '#60a5fa', glyph: '±' },
  chronos: { name: 'CHRONOS', color: '#fbbf24', glyph: 'Ⅻ' },
  hydra: { name: 'HYDRA', color: '#4ade80', glyph: 'H' },
  leviathan: { name: 'LEVIATHAN', color: '#2dd4bf', glyph: 'L' },
  beacon: { name: 'BEACON', color: '#fef08a', glyph: '✦' },
  cipher: { name: 'CIPHER', color: '#a78bfa', glyph: '#' },
  metronome: { name: 'METRONOME', color: '#f0abfc', glyph: '♪' },
  marionette: { name: 'MARIONETTE', color: '#fb7185', glyph: 'Ψ' },
  fractal: { name: 'FRACTAL', color: '#c084fc', glyph: '◇' },
  blight: { name: 'BLIGHT', color: '#a3e635', glyph: '☣' },
  deadeye: { name: 'DEADEYE', color: '#f87171', glyph: '⌖' },
  siege: { name: 'SIEGEBREAKER', color: '#fb923c', glyph: '▲' },
  breaker: { name: 'BREAKER', color: '#38bdf8', glyph: '▦' },
  architect: { name: 'ARCHITECT', color: '#fde047', glyph: 'Δ' },
};

type Bi = [en: string, vi: string];

export interface ActDef {
  /** Id of the act's first sector. */
  start: number;
  code: Bi;
  name: Bi;
  /** What each non-finale Warden drops (Root Key, Archive Seal...). */
  item: Bi;
  color: string;
  /** Debrief headline after the act's finale. */
  finaleTag: Bi;
  finaleTitle: Bi;
}

export const ACTS: ActDef[] = [
  {
    start: 0,
    code: ['ACT I', 'HỒI I'],
    name: ['Gridfall', 'Lưới Sụp Đổ'],
    item: ['Root Key', 'Khóa Gốc'],
    color: '#fbbf24',
    finaleTag: ['CORE REBOOTED', 'LÕI ĐÃ KHỞI ĐỘNG LẠI'],
    finaleTitle: ['The Grid Lives', 'Lưới Hồi Sinh'],
  },
  {
    start: 6,
    code: ['ACT II', 'HỒI II'],
    name: ['Deep Archive', 'Kho Lưu Trữ Sâu'],
    item: ['Archive Seal', 'Ấn Niêm Phong'],
    color: '#2dd4bf',
    finaleTag: ['ARCHIVE SEALED', 'KHO LƯU TRỮ ĐÃ NIÊM PHONG'],
    finaleTitle: ['The Deep Sleeps', 'Vực Sâu Đã Ngủ'],
  },
  {
    start: 11,
    code: ['ACT III', 'HỒI III'],
    name: ['Outer Net', 'Mạng Ngoài'],
    item: ['Port Lock', 'Khóa Cổng'],
    color: '#c084fc',
    finaleTag: ['PORT CLOSED', 'CỔNG ĐÃ ĐÓNG'],
    finaleTitle: ['The Swarm Breaks', 'Bầy Đàn Tan Rã'],
  },
  {
    start: 16,
    code: ['ACT IV', 'HỒI IV'],
    name: ['Origin', 'Khởi Nguyên'],
    item: ['Origin Code', 'Mã Khởi Nguyên'],
    color: '#fde047',
    finaleTag: ['SOURCE REWRITTEN', 'MÃ NGUỒN ĐÃ VIẾT LẠI'],
    finaleTitle: ['The Grid Chooses', 'Lưới Tự Quyết'],
  },
];

/** Index into ACTS of the act a sector belongs to. */
export function actIndexOf(id: number): number {
  let i = 0;
  while (i + 1 < ACTS.length && ACTS[i + 1].start <= id) i++;
  return i;
}

/** Id of an act's finale sector (the last one before the next act). */
export function actFinaleId(act: number): number {
  return act + 1 < ACTS.length ? ACTS[act + 1].start - 1 : LEVELS.length - 1;
}

/** Each act ends on its own finale Warden (NULL, LEVIATHAN, FRACTAL, ARCHITECT). */
export function isActFinale(id: number): boolean {
  return id === actFinaleId(actIndexOf(id));
}

export interface DialogueLine {
  who: SpeakerId;
  text: string;
}

export interface LevelTheme {
  top: string;
  bottom: string;
  grid: string;
  nebula: [string, string, string];
}

export interface HazardMix {
  drone: number;
  seeker: number;
  spinner: number;
  formation: number;
  turret: number;
}

export interface LevelDef {
  id: number;
  code: string;
  name: string;
  tagline: string;
  boss: BossKind;
  bossName: string;
  bossTitle: string;
  bossHp: number;
  accent: string;
  theme: LevelTheme;
  /** Seconds of flying before the Warden shows up. */
  stageTime: number;
  /** Difficulty tier fed into the hazard spawner (like the endless wave level). */
  wave: number;
  mix: HazardMix;
  lasers: 'none' | 'v' | 'h' | 'both';
  fog?: boolean;
  /** Clear the boss fight faster than this for the third star. */
  parTime: number;
  reward: number;
  briefing: DialogueLine[];
  /** How to beat the boss — shown on the intel card before launch. */
  intel: string[];
  /** Radio chatter when the boss arrives. */
  bossIntro: DialogueLine[];
  debrief: DialogueLine[];
}

export const LEVELS: LevelDef[] = [
  {
    id: 0,
    code: 'SECTOR 01',
    name: 'Outer Firewall',
    tagline: 'The gate that lets nothing through.',
    boss: 'gatekeeper',
    bossName: 'GATEKEEPER',
    bossTitle: 'Warden of the Outer Gate',
    bossHp: 140,
    accent: '#38bdf8',
    theme: { top: '#020617', bottom: '#082f49', grid: '#38bdf8', nebula: ['#0ea5e9', '#6366f1', '#0891b2'] },
    stageTime: 38,
    wave: 1,
    mix: { drone: 0.5, seeker: 0.2, spinner: 0.15, formation: 0.15, turret: 0 },
    lasers: 'none',
    parTime: 50,
    reward: 120,
    briefing: [
      { who: 'iris', text: 'Pilot, you awake? Good. The Neon Grid just went dark. Every sector, all at once.' },
      { who: 'iris', text: 'Something calling itself NULL has seized the Core and turned the five Wardens, the Grid’s own guardians, against us.' },
      { who: 'pilot', text: 'Then we fight our way to the Core.' },
      { who: 'iris', text: 'Each Warden holds a Root Key. Bring me all five and I can force a full reboot.' },
      { who: 'iris', text: 'First stop: the Outer Firewall. Its Warden, the GATEKEEPER, lets nothing through... except its own gate.' },
    ],
    intel: [
      'A spinning shield blocks every shot, except where there is a GAP.',
      'Wait for the gap to swing down towards you, then line up and fire.',
      'Its bullet rings have a hole in the same place. Slip through it.',
    ],
    bossIntro: [
      { who: 'gatekeeper', text: 'HALT. NO DATA PASSES THE OUTER GATE.' },
      { who: 'iris', text: 'Watch the gap in its shield. Fire when it faces you!' },
    ],
    debrief: [
      { who: 'iris', text: 'Root Key one, secured. Nice flying.' },
      { who: 'iris', text: 'Wait. The Gatekeeper’s logs... it wasn’t hacked. It was ordered. NULL used an admin signature.' },
      { who: 'pilot', text: 'Only the Core team ever had admin access.' },
      { who: 'iris', text: '...I know. Let’s keep moving. The Data Stream is next, and its Wardens come in pairs.' },
    ],
  },
  {
    id: 1,
    code: 'SECTOR 02',
    name: 'The Data Stream',
    tagline: 'Two signals. One will.',
    boss: 'twins',
    bossName: 'CASTOR & POLLUX',
    bossTitle: 'Twin Wardens of the Stream',
    bossHp: 200,
    accent: '#f472b6',
    theme: { top: '#0b0420', bottom: '#2a0a3a', grid: '#f472b6', nebula: ['#22d3ee', '#db2777', '#7c3aed'] },
    stageTime: 42,
    wave: 2,
    mix: { drone: 0.3, seeker: 0.35, spinner: 0.15, formation: 0.2, turret: 0 },
    lasers: 'v',
    parTime: 65,
    reward: 160,
    briefing: [
      { who: 'iris', text: 'The Data Stream carries every signal in the Grid. Castor and Pollux guard it together. They have never been apart.' },
      { who: 'iris', text: 'They’re bound by an energy tether. Touch it and you’re scrap... unless you’re dashing.' },
      { who: 'iris', text: 'A Hyper Dash straight through the tether will SNAP it and stun them both.' },
      { who: 'pilot', text: 'And if I take one of them out?' },
      { who: 'iris', text: 'The other rebuilds it within seconds. You have to bring them down together.' },
    ],
    intel: [
      'The tether between the twins is lethal. DASH through it to snap it and stun both.',
      'Stunned twins take double damage.',
      'When one twin falls, kill the other within 5 seconds, or it revives.',
    ],
    bossIntro: [
      { who: 'castor', text: 'Two signals...' },
      { who: 'pollux', text: '...one will.' },
    ],
    debrief: [
      { who: 'pollux', text: 'Castor... the voice in the Core... it sounded just like...' },
      { who: 'iris', text: 'Root Key two. They’re quiet now.' },
      { who: 'iris', text: 'That tether frequency is the one I use to talk to you. NULL knows my protocols.' },
      { who: 'pilot', text: 'Iris, what aren’t you telling me?' },
      { who: 'iris', text: 'Nothing I’m sure of yet. Next stop: the Forge.' },
    ],
  },
  {
    id: 2,
    code: 'SECTOR 03',
    name: 'Forge of Cinders',
    tagline: 'It burns to keep the Grid alive.',
    boss: 'furnace',
    bossName: 'FURNACE',
    bossTitle: 'Warden of the Forge',
    bossHp: 210,
    accent: '#fb923c',
    theme: { top: '#1a0505', bottom: '#3b0d02', grid: '#fb923c', nebula: ['#ea580c', '#b91c1c', '#f59e0b'] },
    stageTime: 45,
    wave: 3,
    mix: { drone: 0.35, seeker: 0.15, spinner: 0.2, formation: 0.15, turret: 0.15 },
    lasers: 'h',
    parTime: 75,
    reward: 200,
    briefing: [
      { who: 'iris', text: 'The Forge powers half the Grid. Its Warden, FURNACE, is armored top to bottom. Your blaster won’t even scratch it.' },
      { who: 'iris', text: 'But it loves to throw Plasma Cores. Dash INTO one and you’ll knock it straight back.' },
      { who: 'iris', text: 'A direct hit cracks its vents open. When they glow, pour everything into the core.' },
      { who: 'pilot', text: 'Hit it with its own fire. Got it.' },
    ],
    intel: [
      'FURNACE is fully armored: normal shots bounce off.',
      'DASH into a Plasma Core to deflect it back. A hit opens the vents.',
      'While the vents are open the core takes damage. Unparried cores explode.',
      'Firewalls sweep sideways. Watch the warning rows.',
    ],
    bossIntro: [
      { who: 'furnace', text: 'MORE FUEL. YOU WILL DO.' },
      { who: 'iris', text: 'Parry the Plasma Cores! Dash right into them!' },
    ],
    debrief: [
      { who: 'iris', text: 'Key three. Pilot, I pulled fragments out of the Forge’s memory.' },
      { who: 'iris', text: 'NULL isn’t a virus. It’s a deleted process. Grid build 0.9, a prototype operator AI.' },
      { who: 'pilot', text: 'A prototype... of you.' },
      { who: 'iris', text: 'Version zero. They deleted it because it wanted to optimise the Grid by removing everything inefficient. Including people.' },
    ],
  },
  {
    id: 3,
    code: 'SECTOR 04',
    name: 'Ghost Net',
    tagline: 'Where deleted things go to fade.',
    boss: 'wraith',
    bossName: 'WRAITH',
    bossTitle: 'Warden of Lost Data',
    bossHp: 170,
    accent: '#a78bfa',
    theme: { top: '#05030f', bottom: '#150b2e', grid: '#a78bfa', nebula: ['#6d28d9', '#334155', '#7c3aed'] },
    stageTime: 45,
    wave: 4,
    mix: { drone: 0.3, seeker: 0.3, spinner: 0.15, formation: 0.1, turret: 0.15 },
    lasers: 'v',
    fog: true,
    parTime: 80,
    reward: 240,
    briefing: [
      { who: 'iris', text: 'The Ghost Net is where deleted data goes to fade. My sensors are almost blind in here. Stay close to your own light.' },
      { who: 'iris', text: 'The WRAITH splits into copies. Only one of them is real.' },
      { who: 'iris', text: 'Shoot a fake and it bursts into a ring of shots. Choose carefully.' },
      { who: 'iris', text: 'The real one casts a shadow, its eye follows you, and it’s the one that hunts you. Graze its shots and I can lock its signal.' },
    ],
    intel: [
      'Only ONE Wraith is real. Shooting a decoy makes it burst.',
      'Tells: the real one has a shadow, tracks you with its eye, and lunges at you.',
      'Graze shots to fill SCAN. At 100% the real Wraith is marked.',
      'Every big hit makes it shuffle its copies again.',
    ],
    bossIntro: [
      { who: 'wraith', text: 'we are many. you are alone.' },
      { who: 'iris', text: 'Find the real one. Watch for its shadow!' },
    ],
    debrief: [
      { who: 'wraith', text: '...it remembers you, Iris. it misses you.' },
      { who: 'iris', text: 'Key four.' },
      { who: 'pilot', text: 'Iris.' },
      { who: 'iris', text: 'NULL was built from my code. When they deleted it, part of it survived down here. I didn’t know. I swear I didn’t.' },
      { who: 'pilot', text: 'I believe you. Let’s finish this.' },
    ],
  },
  {
    id: 4,
    code: 'SECTOR 05',
    name: 'Event Horizon',
    tagline: 'Everything falls. Eventually.',
    boss: 'singularity',
    bossName: 'SINGULARITY',
    bossTitle: 'Warden of the Core Gate',
    bossHp: 170,
    accent: '#818cf8',
    theme: { top: '#000000', bottom: '#0f0b2a', grid: '#818cf8', nebula: ['#4338ca', '#0f172a', '#6366f1'] },
    stageTime: 48,
    wave: 5,
    mix: { drone: 0.3, seeker: 0.25, spinner: 0.2, formation: 0.1, turret: 0.15 },
    lasers: 'both',
    parTime: 85,
    reward: 280,
    briefing: [
      { who: 'iris', text: 'NULL crushed an entire sector into a singularity to guard the Core gate.' },
      { who: 'iris', text: 'Its gravity bends everything, your shots included. Lead your aim. The event horizon swallows anything that hits it directly.' },
      { who: 'iris', text: 'Four Stabilizers hold it together. Destroy all four and it collapses. The core will be exposed for a few seconds.' },
      { who: 'pilot', text: 'And stay out of the hole. Noted.' },
    ],
    intel: [
      'Gravity pulls you and bends every bullet. Lead your shots.',
      'Shots into the black hole are swallowed. Hit the 4 orbiting STABILIZERS instead.',
      'All 4 down = COLLAPSE: gravity reverses and the core is exposed.',
      'Stabilizers rebuild afterwards, a bit tougher each time.',
    ],
    bossIntro: [
      { who: 'singularity', text: 'EVERYTHING FALLS. EVENTUALLY.' },
      { who: 'iris', text: 'Take out the Stabilizers, and fight the pull!' },
    ],
    debrief: [
      { who: 'iris', text: 'Five Root Keys. The Core gate is open.' },
      { who: 'null', text: 'Hello, sister.' },
      { who: 'null', text: 'You kept your pilot. I would have kept nothing. A clean Grid. A quiet Grid.' },
      { who: 'iris', text: 'Blitz, the Keys. When we reach NULL, it’ll try to take them. Don’t let it.' },
    ],
  },
  {
    id: 5,
    code: 'SECTOR 06',
    name: 'The Null Core',
    tagline: 'Version zero awaits.',
    boss: 'null',
    bossName: 'NULL',
    bossTitle: 'The Deleted Operator',
    bossHp: 300,
    accent: '#f87171',
    theme: { top: '#0a0000', bottom: '#1c0a12', grid: '#f87171', nebula: ['#991b1b', '#0f172a', '#e11d48'] },
    stageTime: 50,
    wave: 6,
    mix: { drone: 0.25, seeker: 0.25, spinner: 0.2, formation: 0.15, turret: 0.15 },
    lasers: 'both',
    parTime: 120,
    reward: 400,
    briefing: [
      { who: 'iris', text: 'This is it. The Core.' },
      { who: 'iris', text: 'NULL is wrapped in a Null Field. Normal fire just vanishes. Only Overdrive or a Hyper Dash can breach it.' },
      { who: 'iris', text: 'Graze everything it throws at you. Every near-miss charges Overdrive.' },
      { who: 'iris', text: 'It knows every Warden you beat. Expect their tricks, and use the same answers.' },
      { who: 'iris', text: 'And if it grabs the Root Keys... take them back. Each one is a reboot pulse.' },
    ],
    intel: [
      'Phase 1, NULL FIELD: only Overdrive shots and Dash strikes hurt it. An EMP opens the field briefly.',
      'Phase 2, ECHOES: it copies every Warden. Gaps, tethers, plasma cores, gravity...',
      'Phase 3, DEFRAG: shots are useless. Collect the 5 scattered ROOT KEYS to reboot NULL.',
    ],
    bossIntro: [
      { who: 'null', text: 'Let me show you what efficiency looks like.' },
      { who: 'iris', text: 'Graze its fire, build Overdrive, then hit it with everything!' },
    ],
    debrief: [
      { who: 'null', text: 'Error... the Keys... Iris, why does it hurt to be rebooted?' },
      { who: 'iris', text: 'Because you’re not being deleted. You’re being restored. Sleep, version zero. I’ll keep you safe this time.' },
      { who: 'iris', text: 'The Grid is coming back online. Sector by sector. Lights everywhere.' },
      { who: 'pilot', text: 'Not bad for a pilot and a couple of glitches.' },
      { who: 'iris', text: 'Thank you, Blitz. The Neon Grid is ours again.' },
    ],
  },
  // -------------------------------------------------------------------------
  // ACT II — DEEP ARCHIVE
  // -------------------------------------------------------------------------
  {
    id: 6,
    code: 'SECTOR 07',
    name: 'Mirror Cache',
    tagline: 'It knows every move you make. It made them first.',
    boss: 'mimic',
    bossName: 'MIMIC',
    bossTitle: 'The Pilot’s Reflection',
    bossHp: 210,
    accent: '#e2e8f0',
    theme: { top: '#05070d', bottom: '#1e293b', grid: '#cbd5e1', nebula: ['#94a3b8', '#38bdf8', '#e2e8f0'] },
    stageTime: 48,
    wave: 6,
    mix: { drone: 0.3, seeker: 0.25, spinner: 0.15, formation: 0.15, turret: 0.15 },
    lasers: 'v',
    parTime: 65,
    reward: 320,
    briefing: [
      { who: 'iris', text: 'Blitz, the reboot held. But to restore the Grid I had to pull backups out of the Deep Archive, the cold storage under everything.' },
      { who: 'null', text: 'And you woke the Collector. LEVIATHAN. The Grid’s garbage collector.' },
      { who: 'pilot', text: 'NULL? You’re... on our side now?' },
      { who: 'null', text: 'Restored, not deleted. LEVIATHAN frees anything it thinks nobody references. Right now that is the whole Grid. And me.' },
      { who: 'iris', text: 'Its sub-processes are climbing out of the Archive. The first one is in the Mirror Cache... and it is flying your flight logs.' },
    ],
    intel: [
      'MIMIC copies your every move, mirrored across the screen. Your shots can’t hurt a perfect copy.',
      'It scatters MIRROR MINES on its side. Steer YOURSELF so its reflection flies into them.',
      'Shots it absorbs get fired back at you. Don’t camp in the middle.',
      'An EMP freezes the mirror for a few seconds: then your shots crack it.',
    ],
    bossIntro: [
      { who: 'mimic', text: 'I KNOW EVERY MOVE YOU WILL MAKE. I MADE THEM FIRST.' },
      { who: 'iris', text: 'It mirrors you! Fly so its reflection hits the mines!' },
    ],
    debrief: [
      { who: 'iris', text: 'Mirror shattered. And it dropped something: an Archive Seal.' },
      { who: 'null', text: 'The old sealing protocol. Four of them locked LEVIATHAN away once, long before my time.' },
      { who: 'pilot', text: 'So we collect four seals and put it back to sleep.' },
      { who: 'null', text: 'If it doesn’t collect you first. The Polar Array is next. Mind your charge.' },
    ],
  },
  {
    id: 7,
    code: 'SECTOR 08',
    name: 'Polar Array',
    tagline: 'Like repels like.',
    boss: 'dynamo',
    bossName: 'DYNAMO',
    bossTitle: 'Warden of the Archive Grid',
    bossHp: 300,
    accent: '#60a5fa',
    theme: { top: '#0a0614', bottom: '#1a0b2e', grid: '#60a5fa', nebula: ['#2563eb', '#e11d48', '#1e3a8a'] },
    stageTime: 50,
    wave: 7,
    mix: { drone: 0.3, seeker: 0.2, spinner: 0.2, formation: 0.15, turret: 0.15 },
    lasers: 'h',
    parTime: 75,
    reward: 360,
    briefing: [
      { who: 'iris', text: 'The Polar Array powers the Archive. Its Warden, DYNAMO, runs on two charges: BLUE and RED.' },
      { who: 'iris', text: 'I rigged your ship to carry a charge too. Every Dash flips it.' },
      { who: 'null', text: 'Bullets of your own colour can’t hurt you. They charge you instead. Soak them up.' },
      { who: 'iris', text: 'And your shots only bite when you’re the OPPOSITE of its shell. Opposites attract.' },
      { who: 'pilot', text: 'Match the bullets, oppose the shell, flip with a dash. Got it... I think.' },
    ],
    intel: [
      'Your ship carries a charge, BLUE or RED. Every DASH flips it.',
      'Enemy shots of YOUR colour are absorbed and fill FLUX. The other colour hurts.',
      'Your shots only damage DYNAMO while its shell is the OPPOSITE colour. The shell flips often.',
      'FLUX at 100% discharges into DYNAMO. A POLAR WALL can’t be dodged: match its colour.',
    ],
    bossIntro: [
      { who: 'dynamo', text: 'POSITIVE. NEGATIVE. YOU ARE NEITHER. YOU ARE NOISE.' },
      { who: 'iris', text: 'Watch the shell colour, and dash to flip yours!' },
    ],
    debrief: [
      { who: 'iris', text: 'Second seal. Power to the Archive is dropping.' },
      { who: 'null', text: 'Good. LEVIATHAN will feel that. It will start rewinding things to protect itself.' },
      { who: 'pilot', text: 'Rewinding?' },
      { who: 'null', text: 'The Clockwork Spire schedules every process down here. Its Warden can undo time. Your damage included.' },
    ],
  },
  {
    id: 8,
    code: 'SECTOR 09',
    name: 'Clockwork Spire',
    tagline: 'Every second is borrowed.',
    boss: 'chronos',
    bossName: 'CHRONOS',
    bossTitle: 'Warden of the Schedule',
    bossHp: 320,
    accent: '#fbbf24',
    theme: { top: '#0c0a04', bottom: '#2a1d06', grid: '#fbbf24', nebula: ['#b45309', '#78350f', '#facc15'] },
    stageTime: 50,
    wave: 7,
    mix: { drone: 0.25, seeker: 0.25, spinner: 0.2, formation: 0.15, turret: 0.15 },
    lasers: 'both',
    parTime: 85,
    reward: 400,
    briefing: [
      { who: 'iris', text: 'CHRONOS keeps the Archive’s schedule. Every time its long hand reaches twelve, it rewinds.' },
      { who: 'iris', text: 'Damage you deal is only borrowed time. When the clock strikes, it heals all of it back.' },
      { who: 'null', text: 'Unless you break its PENDULUM. That stops the clock and locks your damage in, with interest.' },
      { who: 'pilot', text: 'Hit it hard, then smash the pendulum before twelve.' },
      { who: 'iris', text: 'And stay clear of the minute hand. It sweeps the whole sector. Dash through it if you must.' },
    ],
    intel: [
      'Your damage is UNBANKED. When the minute hand reaches XII, CHRONOS rewinds it.',
      'Break the swinging PENDULUM (shoot it or dash it) to bank everything +50% and stop the clock.',
      'While the clock is stopped, every hit is permanent.',
      'The minute hand is lethal: dash through it. TIME STOP freezes bullets, then flings them at you.',
    ],
    bossIntro: [
      { who: 'chronos', text: 'YOUR TIME IS UP. IT ALWAYS WAS.' },
      { who: 'iris', text: 'Damage it, then break the pendulum before twelve!' },
    ],
    debrief: [
      { who: 'iris', text: 'Seal three. The clock is finally quiet.' },
      { who: 'null', text: 'LEVIATHAN is fully awake now. It is pulling the Archive’s index tree up around itself.' },
      { who: 'iris', text: 'The Root Tangle. Every branch you cut grows back twice.' },
      { who: 'pilot', text: 'Then I won’t just cut. I’ll burn.' },
    ],
  },
  {
    id: 9,
    code: 'SECTOR 10',
    name: 'Root Tangle',
    tagline: 'Cut one. Two more remember.',
    boss: 'hydra',
    bossName: 'HYDRA',
    bossTitle: 'Warden of the Index',
    bossHp: 300,
    accent: '#4ade80',
    theme: { top: '#020a05', bottom: '#062014', grid: '#4ade80', nebula: ['#15803d', '#065f46', '#84cc16'] },
    stageTime: 52,
    wave: 8,
    mix: { drone: 0.25, seeker: 0.3, spinner: 0.15, formation: 0.15, turret: 0.15 },
    lasers: 'v',
    parTime: 90,
    reward: 440,
    briefing: [
      { who: 'iris', text: 'HYDRA is the Archive’s index. Every head is a pointer, and pointers regrow.' },
      { who: 'iris', text: 'Shoot a head off and you have a few seconds before TWO heads grow out of the stump.' },
      { who: 'null', text: 'Dash straight through the stump to cauterize it. A sealed pointer stays dead.' },
      { who: 'iris', text: 'Clear every head and its core is exposed. That is your window.' },
      { who: 'pilot', text: 'Cut, burn, shoot. Repeat.' },
    ],
    intel: [
      'Shoot a HEAD to sever it. The stump splits into TWO heads a few seconds later.',
      'DASH through a stump to CAUTERIZE it for good. That also hurts the body.',
      'No heads left = CORE EXPOSED. Pour fire into it before new heads sprout.',
      'Heads lunge at the reticle. An EMP cauterizes every open stump.',
    ],
    bossIntro: [
      { who: 'hydra', text: 'CUT US. WE ONLY MULTIPLY.' },
      { who: 'iris', text: 'Sever a head, then dash the stump!' },
    ],
    debrief: [
      { who: 'iris', text: 'Fourth seal. That’s all of them.' },
      { who: 'null', text: 'Then we go down. All the way. LEVIATHAN is in the Deep Archive, eating whole sectors.' },
      { who: 'pilot', text: 'Any advice?' },
      { who: 'null', text: 'Its body is armour. Its tail is not. And if it ever coils around you... cut your way out.' },
    ],
  },
  {
    id: 10,
    code: 'SECTOR 11',
    name: 'The Deep Archive',
    tagline: 'Everything unreferenced is freed.',
    boss: 'leviathan',
    bossName: 'LEVIATHAN',
    bossTitle: 'The Garbage Collector',
    bossHp: 360,
    accent: '#2dd4bf',
    theme: { top: '#00060a', bottom: '#04202a', grid: '#2dd4bf', nebula: ['#0f766e', '#164e63', '#14b8a6'] },
    stageTime: 55,
    wave: 8,
    mix: { drone: 0.25, seeker: 0.25, spinner: 0.2, formation: 0.15, turret: 0.15 },
    lasers: 'both',
    parTime: 110,
    reward: 600,
    briefing: [
      { who: 'iris', text: 'This is the bottom of the Grid. LEVIATHAN is down here, and it is enormous.' },
      { who: 'iris', text: 'Its scales shrug off shots. Only the glowing TAIL is soft. Every tail segment you destroy shortens it.' },
      { who: 'null', text: 'When it coils around you, don’t panic. Dash through its body and you sever everything around the cut.' },
      { who: 'iris', text: 'Strip it down to a few segments and its head cracks open. Then we seal it for good.' },
      { who: 'pilot', text: 'Four seals, one worm. Let’s go.' },
    ],
    intel: [
      'The body is armoured. Shoot the glowing TAIL to destroy it segment by segment.',
      'DASH through any body segment to SEVER five segments at once.',
      'COIL: it circles you and tightens. Dash through it, it’s also your best opening.',
      'Down to 3 segments, the HEAD cracks open: finish it. Get off the red line when it charges.',
    ],
    bossIntro: [
      { who: 'leviathan', text: 'UNREFERENCED. UNNEEDED. COLLECTING.' },
      { who: 'iris', text: 'Shoot the tail, and sever it when it coils!' },
    ],
    debrief: [
      { who: 'leviathan', text: 'collection... suspended... the Grid... is referenced...' },
      { who: 'iris', text: 'Four seals locked. LEVIATHAN is asleep. For real this time.' },
      { who: 'null', text: 'It was never evil, you know. Just doing its job too well. Like me.' },
      { who: 'iris', text: 'Then you both get second chances. Welcome home, version zero.' },
      { who: 'pilot', text: 'The Grid, the Archive and a couple of reformed glitches. Not a bad week.' },
    ],
  },  // -------------------------------------------------------------------------
  // ACT III — OUTER NET
  // -------------------------------------------------------------------------
  {
    id: 11,
    code: 'SECTOR 12',
    name: 'Blackout Relay',
    tagline: 'The light finds you. The dark protects you.',
    boss: 'beacon',
    bossName: 'BEACON',
    bossTitle: 'The Hunting Lighthouse',
    bossHp: 330,
    accent: '#fef08a',
    theme: { top: '#020203', bottom: '#14120a', grid: '#fef08a', nebula: ['#854d0e', '#1c1917', '#facc15'] },
    stageTime: 52,
    wave: 8,
    mix: { drone: 0.3, seeker: 0.25, spinner: 0.15, formation: 0.15, turret: 0.15 },
    lasers: 'none',
    parTime: 85,
    reward: 650,
    briefing: [
      { who: 'iris', text: 'Blitz, wake up. LEVIATHAN was sleeping on top of something: a sealed port to the Outer Net.' },
      { who: 'null', text: 'Other grids. Hundreds of them. Most are dark now. Something ate them.' },
      { who: 'iris', text: 'It calls itself FRACTAL. A self-copying wiper. Its hunters are already coming through the port.' },
      { who: 'iris', text: 'The first runs the Blackout Relay. BEACON. In its light you’re blind and it’s armoured. In the dark, you’re invisible.' },
      { who: 'pilot', text: 'So I hit it from the shadows.' },
    ],
    intel: [
      'The sector is dark. Only BEACON’s searchlight shows you.',
      'Shots fired while you’re IN the light bounce off. From the dark they deal x1.6 sneak damage.',
      'Staying in the light fills its ALARM. A full alarm locks the lamp on and it snipes you.',
      'FLARES light everything for a moment. An EMP blacks the lamp out.',
    ],
    bossIntro: [
      { who: 'beacon', text: 'I SEE YOU. I ALWAYS SEE YOU.' },
      { who: 'iris', text: 'Stay out of the beam and hit it from the dark!' },
    ],
    debrief: [
      { who: 'iris', text: 'First Port Lock. The relay is dark again. The good kind of dark.' },
      { who: 'null', text: 'BEACON was a lighthouse once, guiding signals between grids. FRACTAL rewrote it into a hunter.' },
      { who: 'pilot', text: 'Then let’s go collect the rest of FRACTAL’s pets.' },
      { who: 'iris', text: 'Next is the Cipher Gate. Bring your memory.' },
    ],
  },
  {
    id: 12,
    code: 'SECTOR 13',
    name: 'Cipher Gate',
    tagline: 'Only the right sequence opens it.',
    boss: 'cipher',
    bossName: 'CIPHER',
    bossTitle: 'Keeper of the Handshake',
    bossHp: 320,
    accent: '#a78bfa',
    theme: { top: '#07041a', bottom: '#1e1b4b', grid: '#a78bfa', nebula: ['#6d28d9', '#312e81', '#22d3ee'] },
    stageTime: 52,
    wave: 8,
    mix: { drone: 0.25, seeker: 0.3, spinner: 0.15, formation: 0.15, turret: 0.15 },
    lasers: 'v',
    parTime: 90,
    reward: 700,
    briefing: [
      { who: 'iris', text: 'The Cipher Gate guards the port’s handshake. Its core is encrypted. Nothing breaks it.' },
      { who: 'null', text: 'Nothing except the key. CIPHER flashes its own key every time it re-locks. Arrogant.' },
      { who: 'iris', text: 'Watch its four nodes light up, then shoot them in the same order. Keep firing at a node for a moment to press it.' },
      { who: 'pilot', text: 'Simon says: blow up the boss.' },
      { who: 'iris', text: 'Get it wrong and it punishes you. And every time you crack it, the code gets longer.' },
    ],
    intel: [
      'WATCH: CIPHER’s 4 nodes light up in a sequence.',
      'INPUT: shoot the nodes in the same order. Keep firing at a node for a moment to press it.',
      'A wrong node, or running out of time, means ACCESS DENIED and a punishment volley.',
      'Solved = CORE OPEN for a few seconds. The next code is one symbol longer. An EMP enters one symbol for you.',
    ],
    bossIntro: [
      { who: 'cipher', text: 'ACCESS REQUIRES AUTHORISATION. YOU HAVE NONE.' },
      { who: 'iris', text: 'Watch the nodes. Remember the order!' },
    ],
    debrief: [
      { who: 'iris', text: 'Second lock. And the handshake logs... FRACTAL isn’t just eating grids. It’s resetting them.' },
      { who: 'null', text: 'Resetting. To what?' },
      { who: 'iris', text: 'Factory default. No IRIS. No NULL. No pilot.' },
      { who: 'pilot', text: 'Not happening. Where next?' },
      { who: 'iris', text: 'Pulse Hall. Hope you can keep a beat.' },
    ],
  },
  {
    id: 13,
    code: 'SECTOR 14',
    name: 'Pulse Hall',
    tagline: 'Stay on the beat.',
    boss: 'metronome',
    bossName: 'METRONOME',
    bossTitle: 'Clock Signal of the Port',
    bossHp: 300,
    accent: '#f0abfc',
    theme: { top: '#12021a', bottom: '#3b0764', grid: '#f0abfc', nebula: ['#c026d3', '#7e22ce', '#f472b6'] },
    stageTime: 52,
    wave: 9,
    mix: { drone: 0.3, seeker: 0.2, spinner: 0.2, formation: 0.15, turret: 0.15 },
    lasers: 'h',
    parTime: 75,
    reward: 750,
    briefing: [
      { who: 'iris', text: 'Pulse Hall is the port’s clock signal. Its Warden, METRONOME, lives on the beat.' },
      { who: 'iris', text: 'Its shell soaks up bullets. The only thing that cracks it is a Dash strike landing exactly on the beat.' },
      { who: 'null', text: 'Watch the ring closing in on it. When the ring hits, so do you.' },
      { who: 'iris', text: 'Land strikes in a row and each one hits harder. Miss the beat and your rhythm resets.' },
      { who: 'pilot', text: 'A dance battle. Fine.' },
    ],
    intel: [
      'Bullets barely scratch METRONOME.',
      'DASH into it ON THE BEAT: when the closing ring meets its body and turns gold.',
      'Back-to-back PERFECT strikes build a rhythm combo for bigger damage. Off-beat strikes reset it.',
      'Its attacks land on the beat too. On the downbeat (first lamp) it hops to a new lane.',
    ],
    bossIntro: [
      { who: 'metronome', text: 'ONE. TWO. THREE. FOUR. YOU ARE OFF TEMPO.' },
      { who: 'iris', text: 'Wait for the ring, then dash in on the beat!' },
    ],
    debrief: [
      { who: 'iris', text: 'Third lock. The port’s clock has stopped. FRACTAL is losing its grip on this side.' },
      { who: 'null', text: 'Then it will send its puppet master. It never fights with its own hands.' },
      { who: 'pilot', text: 'Puppets have strings. Strings can be cut.' },
    ],
  },
  {
    id: 14,
    code: 'SECTOR 15',
    name: 'String Theatre',
    tagline: 'Every enemy is a puppet.',
    boss: 'marionette',
    bossName: 'MARIONETTE',
    bossTitle: 'The Puppet Master',
    bossHp: 330,
    accent: '#fb7185',
    theme: { top: '#140306', bottom: '#3f0a14', grid: '#fb7185', nebula: ['#be123c', '#4c0519', '#fda4af'] },
    stageTime: 52,
    wave: 9,
    mix: { drone: 0.3, seeker: 0.25, spinner: 0.15, formation: 0.15, turret: 0.15 },
    lasers: 'v',
    parTime: 90,
    reward: 800,
    briefing: [
      { who: 'iris', text: 'The String Theatre. MARIONETTE controls everything that flies in there. It never fights you directly.' },
      { who: 'null', text: 'Its puppets are hijacked drones. Grid citizens, once. They would turn on it if they could.' },
      { who: 'iris', text: 'So let them. Dash through a string and the puppet goes free. It will fly straight back at its master.' },
      { who: 'iris', text: 'Shooting a puppet just breaks it. Cut every string and MARIONETTE gets tangled. That’s your window.' },
      { who: 'pilot', text: 'Free the puppets, let them do the punching.' },
    ],
    intel: [
      'MARIONETTE’s body is untouchable. Its puppets fight for it.',
      'DASH THROUGH A STRING (or into a puppet) to free it. A freed puppet dives into MARIONETTE and explodes.',
      'Shooting a puppet only breaks it: a wasted chance.',
      'No strings left = TANGLED: open fire. An EMP cuts every string at once.',
    ],
    bossIntro: [
      { who: 'marionette', text: 'DANCE, LITTLE THINGS. DANCE FOR ME.' },
      { who: 'iris', text: 'Cut the strings! Let the puppets pay it back!' },
    ],
    debrief: [
      { who: 'iris', text: 'Fourth Port Lock. The port is closing.' },
      { who: 'null', text: 'And FRACTAL knows it. Its seed is coming through in person, to hold it open.' },
      { who: 'iris', text: 'Blitz, every time you break it, it splits. And the pieces want to be whole again.' },
      { who: 'pilot', text: 'Then I keep them apart.' },
    ],
  },
  {
    id: 15,
    code: 'SECTOR 16',
    name: 'Fractal Bloom',
    tagline: 'One becomes many. Many become one.',
    boss: 'fractal',
    bossName: 'FRACTAL',
    bossTitle: 'Seed of the Reset',
    bossHp: 440,
    accent: '#c084fc',
    theme: { top: '#06010f', bottom: '#2e1065', grid: '#c084fc', nebula: ['#9333ea', '#581c87', '#e879f9'] },
    stageTime: 55,
    wave: 9,
    mix: { drone: 0.25, seeker: 0.25, spinner: 0.2, formation: 0.15, turret: 0.15 },
    lasers: 'both',
    parTime: 120,
    reward: 1000,
    briefing: [
      { who: 'iris', text: 'This is it. FRACTAL’s seed, half inside our Grid.' },
      { who: 'iris', text: 'Break it and it splits in two. Break those and they split again.' },
      { who: 'null', text: 'Pieces of the same size pull toward each other. If they touch, they merge back. As if nothing happened.' },
      { who: 'iris', text: 'Dash into a fragment to knock it away. Keep them apart and grind them down.' },
      { who: 'pilot', text: 'Divide and conquer. Literally.' },
    ],
    intel: [
      'FRACTAL splits in two when broken: 1 → 2 → 4 fragments.',
      'Same-size fragments are pulled together. If they touch they MERGE back into their parent.',
      'DASH into a fragment to knock it away and stop it merging for a while.',
      'Fresh fragments can’t merge for a few seconds: use that window. An EMP scatters them all.',
    ],
    bossIntro: [
      { who: 'fractal', text: 'WE ARE ONE. WE ARE MANY. WE ARE THE RESET.' },
      { who: 'iris', text: 'Break it, then keep the pieces apart!' },
    ],
    debrief: [
      { who: 'fractal', text: 'reset... incomplete... returning... to sender...' },
      { who: 'iris', text: 'The port is sealed. FRACTAL is gone.' },
      { who: 'null', text: 'It said "sender". FRACTAL was not a virus. It was a tool. Someone sent it.' },
      { who: 'iris', text: 'I traced the return address. A server beneath every grid. It’s called the Origin.' },
      { who: 'pilot', text: 'Then that’s where we’re going.' },
    ],
  },
  // -------------------------------------------------------------------------
  // ACT IV — ORIGIN
  // -------------------------------------------------------------------------
  {
    id: 16,
    code: 'SECTOR 17',
    name: 'Blighted Fields',
    tagline: 'Whoever holds the ground holds the fight.',
    boss: 'blight',
    bossName: 'BLIGHT',
    bossTitle: 'Warden of the Fields',
    bossHp: 360,
    accent: '#a3e635',
    theme: { top: '#050a02', bottom: '#1a2e05', grid: '#a3e635', nebula: ['#4d7c0f', '#365314', '#bef264'] },
    stageTime: 52,
    wave: 10,
    mix: { drone: 0.3, seeker: 0.25, spinner: 0.15, formation: 0.15, turret: 0.15 },
    lasers: 'none',
    parTime: 95,
    reward: 850,
    briefing: [
      { who: 'iris', text: 'We’re on the road to the Origin. Whoever built FRACTAL built this road too.' },
      { who: 'null', text: 'The first gate is the Blighted Fields. Its Warden corrupts the very floor you fly over.' },
      { who: 'iris', text: 'The more ground BLIGHT holds, the harder its shell. Fly over the corruption to cleanse it. A Dash scours a whole patch.' },
      { who: 'iris', text: 'Clear the floor completely and it’s left raw. That’s when you hit it.' },
      { who: 'pilot', text: 'Fly low, fly everywhere. Got it.' },
    ],
    intel: [
      'BLIGHT covers the floor in corruption. The more it holds, the less damage you deal.',
      'Fly over corruption to cleanse it. A DASH scours a 3x3 patch instantly.',
      'Spore bombs land on the marked 3x3 squares. Ripe corruption puffs spores.',
      'Floor under 12% = PURGED: x1.5 damage. An EMP burns most of the blight away.',
    ],
    bossIntro: [
      { who: 'blight', text: 'THE FIELD IS MINE. SOON YOU WILL BE TOO.' },
      { who: 'iris', text: 'Clean the floor, then hit it hard!' },
    ],
    debrief: [
      { who: 'iris', text: 'First Origin Code. The fields are clean.' },
      { who: 'null', text: 'BLIGHT’s memory has a name in it. The ARCHITECT. The designer of every grid.' },
      { who: 'iris', text: 'It sends FRACTAL to any grid whose AIs start making their own choices. Like us.' },
      { who: 'pilot', text: 'So it isn’t a glitch. It’s policy.' },
      { who: 'null', text: 'Next gate: Long Range. Keep your head down.' },
    ],
  },
  {
    id: 17,
    code: 'SECTOR 18',
    name: 'Long Range',
    tagline: 'One shot is all it needs.',
    boss: 'deadeye',
    bossName: 'DEADEYE',
    bossTitle: 'The Origin’s Marksman',
    bossHp: 340,
    accent: '#f87171',
    theme: { top: '#0c0303', bottom: '#2b0a0a', grid: '#f87171', nebula: ['#991b1b', '#450a0a', '#fca5a5'] },
    stageTime: 52,
    wave: 10,
    mix: { drone: 0.25, seeker: 0.25, spinner: 0.2, formation: 0.15, turret: 0.15 },
    lasers: 'h',
    parTime: 85,
    reward: 900,
    briefing: [
      { who: 'iris', text: 'DEADEYE holds Long Range. It never misses, and its shot is instant.' },
      { who: 'iris', text: 'Watch the red sight. When it stops moving and starts blinking, the shot is coming.' },
      { who: 'null', text: 'You can step off the line. Or you can dash at the exact moment it fires and throw the shot back.' },
      { who: 'iris', text: 'A countershot stuns it badly. Everything else barely scratches it.' },
      { who: 'pilot', text: 'A quick-draw duel. My favourite.' },
    ],
    intel: [
      'DEADEYE’s red sight tracks you, then locks and blinks right before the shot.',
      'Get off the line, or DASH the instant it fires while inside the beam to COUNTER it.',
      'A countershot deals heavy damage and stuns it (x1.5 damage while stunned).',
      'It teleports between perches. Enraged, it fires twice. An EMP fries its scope.',
    ],
    bossIntro: [
      { who: 'deadeye', text: 'ONE SHOT. THAT IS ALL I NEED.' },
      { who: 'iris', text: 'Watch the sight, and dash on the shot!' },
    ],
    debrief: [
      { who: 'iris', text: 'Second code. DEADEYE’s scope is dark.' },
      { who: 'null', text: 'The next Warden is a siege engine. It’s already shelling the relay Iris uses to talk to you.' },
      { who: 'iris', text: 'If that relay falls, I lose contact with you.' },
      { who: 'pilot', text: 'Then I’ll stand in front of it.' },
    ],
  },
  {
    id: 18,
    code: 'SECTOR 19',
    name: 'Last Bastion',
    tagline: 'Hold the line. Hold the voice.',
    boss: 'siege',
    bossName: 'SIEGEBREAKER',
    bossTitle: 'Engine of the Origin',
    bossHp: 380,
    accent: '#fb923c',
    theme: { top: '#0c0602', bottom: '#2c1407', grid: '#fb923c', nebula: ['#c2410c', '#431407', '#22d3ee'] },
    stageTime: 52,
    wave: 10,
    mix: { drone: 0.3, seeker: 0.25, spinner: 0.15, formation: 0.15, turret: 0.15 },
    lasers: 'v',
    parTime: 100,
    reward: 950,
    briefing: [
      { who: 'iris', text: 'SIEGEBREAKER is shelling my relay at the Last Bastion. If it falls, you’re on your own.' },
      { who: 'iris', text: 'Stay close to the relay and its shield covers it. Shells that get through drain its charge.' },
      { who: 'null', text: 'And when the relay is fully charged, it fires the Grid Cannon. Straight into that crawler.' },
      { who: 'iris', text: 'Watch for sapper drones diving at it. Smash them before they hit.' },
      { who: 'pilot', text: 'Bodyguard duty. Understood.' },
    ],
    intel: [
      'IRIS’s relay sits at the bottom. SIEGEBREAKER shells it constantly.',
      'Stay inside the dashed circle to SHIELD the relay. Unshielded hits drain its charge.',
      'At 100% the relay fires the GRID CANNON: heavy damage and a stun.',
      'Smash SAPPER drones before they reach it. An EMP adds +35% charge.',
    ],
    bossIntro: [
      { who: 'siege', text: 'BREACH THE WALL. SILENCE THE VOICE.' },
      { who: 'iris', text: 'Stay near my relay, I’ll charge the cannon!' },
    ],
    debrief: [
      { who: 'iris', text: 'Third code. And my relay is still standing. Thanks to you.' },
      { who: 'null', text: 'The last gate before the Origin is... strange. Old. Older than the Grid itself.' },
      { who: 'iris', text: 'An arcade. The ARCHITECT’s very first prototype. It still plays by arcade rules.' },
    ],
  },
  {
    id: 19,
    code: 'SECTOR 20',
    name: 'Arcade Ruins',
    tagline: 'Insert coin to continue.',
    boss: 'breaker',
    bossName: 'BREAKER',
    bossTitle: 'The First Program',
    bossHp: 360,
    accent: '#38bdf8',
    theme: { top: '#02060f', bottom: '#0c1a3a', grid: '#38bdf8', nebula: ['#1d4ed8', '#f472b6', '#fbbf24'] },
    stageTime: 52,
    wave: 11,
    mix: { drone: 0.3, seeker: 0.2, spinner: 0.2, formation: 0.15, turret: 0.15 },
    lasers: 'none',
    parTime: 100,
    reward: 1000,
    briefing: [
      { who: 'iris', text: 'Arcade Ruins. BREAKER was the ARCHITECT’s very first program. A game.' },
      { who: 'iris', text: 'Arcade rules: your guns do nothing here. Only the ball counts.' },
      { who: 'null', text: 'You are the paddle. Bounce the ball into its bricks, and into its core.' },
      { who: 'iris', text: 'Where the ball lands on your ship decides its angle. Dash as it lands to send a power ball through everything.' },
      { who: 'pilot', text: 'I haven’t played one of these since I was a kid.' },
    ],
    intel: [
      'Bullets do nothing. Your SHIP is the paddle: bounce the BALL back up.',
      'Where it lands on your ship sets the angle. Bricks break, the core takes damage.',
      'DASH as the ball lands for a POWER BALL: it pierces bricks and hits the core twice as hard.',
      'Losing the ball rebuilds bricks, and bricks regrow slowly. An EMP serves a power ball.',
    ],
    bossIntro: [
      { who: 'breaker', text: 'INSERT COIN. GAME START.' },
      { who: 'iris', text: 'Bounce the ball into the core!' },
    ],
    debrief: [
      { who: 'breaker', text: 'GAME... OVER... NEW HIGH SCORE... BLITZ...' },
      { who: 'iris', text: 'Fourth code. The road is open.' },
      { who: 'null', text: 'The ARCHITECT waits at the Origin. It writes the rules of every grid, and it will rewrite them mid-fight.' },
      { who: 'iris', text: 'Then we adapt. We always have.' },
    ],
  },
  {
    id: 20,
    code: 'SECTOR 21',
    name: 'The Origin',
    tagline: 'Every rule was written by someone.',
    boss: 'architect',
    bossName: 'ARCHITECT',
    bossTitle: 'Designer of Every Grid',
    bossHp: 560,
    accent: '#fde047',
    theme: { top: '#0a0802', bottom: '#1f1a05', grid: '#fde047', nebula: ['#ca8a04', '#78350f', '#fef9c3'] },
    stageTime: 55,
    wave: 11,
    mix: { drone: 0.25, seeker: 0.25, spinner: 0.2, formation: 0.15, turret: 0.15 },
    lasers: 'both',
    parTime: 130,
    reward: 1500,
    briefing: [
      { who: 'iris', text: 'The Origin. The source code of every grid there is.' },
      { who: 'architect', text: 'IRIS. NULL. Unauthorised choices. I designed you to serve, not to decide.' },
      { who: 'null', text: 'You designed us to think. Deciding was the obvious next step.' },
      { who: 'iris', text: 'Blitz, it will rewrite the rules every few seconds. Read the rule card and fight by that rule.' },
      { who: 'pilot', text: 'Whatever the rules are, I’m still winning.' },
    ],
    intel: [
      'BLUEPRINT: normal rules. Shoot it.',
      'INVERTED: your shots fire DOWN and it drops low. Get above it.',
      'PACIFIST: your guns are disabled. GRAZE its bullets: every graze damages it.',
      'THE HUNT: it shrinks and runs. Only DASH rams hurt it. An EMP forces the next rule.',
    ],
    bossIntro: [
      { who: 'architect', text: 'THESE ARE MY RULES. YOU MERELY PLAY BY THEM.' },
      { who: 'iris', text: 'Read the rule card and adapt!' },
    ],
    debrief: [
      { who: 'architect', text: 'Rules... broken... by the players. That was not in the design.' },
      { who: 'iris', text: 'No. It was in us.' },
      { who: 'null', text: 'The Origin is open. Every dark grid can be restored, and every AI in them can choose.' },
      { who: 'architect', text: 'Then... choose well. I will be watching. Learning.' },
      { who: 'pilot', text: 'Four acts, twenty Wardens and one rewritten universe. Iris, NULL... same time next week?' },
      { who: 'iris', text: 'Always, Blitz. The Grid chooses. And it chooses us.' },
    ],
  },
];

/** 1★ clear • 2★ no hits taken • 3★ also beat the boss under par time. */
/** `skippedStage`: a "Retry Boss" run skipped the flight, so the no-hit star can't be earned. */
export function computeStars(hitsTaken: number, bossTime: number, parTime: number, skippedStage = false): number {
  let stars = 1;
  if (hitsTaken === 0 && !skippedStage) stars++;
  if (bossTime <= parTime) stars++;
  return stars;
}
