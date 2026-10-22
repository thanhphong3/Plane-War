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
  | 'leviathan';

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
};

/** First sector of Act II (the Deep Archive). */
export const ACT_II_START = 6;

/** NULL closes Act I; LEVIATHAN closes Act II. */
export function isActFinale(id: number): boolean {
  return id === ACT_II_START - 1 || id === LEVELS.length - 1;
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
