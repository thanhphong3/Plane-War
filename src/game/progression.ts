import { DailyModifierId, DailyQuestState, QuestDef, SaveData } from '../types/game';
import { DAILY_MODIFIERS, QUESTS } from '../utils/constants';

// ---------------------------------------------------------------------------
// Day keys, seeded randomness, Daily Challenge rules and daily missions
// ---------------------------------------------------------------------------

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d = new Date()): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${day < 10 ? '0' : ''}${day}`;
}

/** The day before `key`. */
export function prevDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

/** Milliseconds until local midnight. */
export function msUntilTomorrow(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for spawn tables. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed shared by every pilot on the same day. */
export const daySeed = (key = dayKey()) => hashString(`neon-blitz:${key}`);

/**
 * Gameplay randomness for spawners. Plain Math.random normally; the Daily Challenge swaps in
 * a seeded stream so everyone faces the same spawn sequence that day.
 */
let spawnRand: () => number = Math.random;
export const rand = () => spawnRand();
export function setSpawnSeed(seed: number | null) {
  spawnRand = seed === null ? Math.random : seededRng(seed);
}

function shuffled<T>(list: T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Today's two Daily Challenge modifiers. */
export function dailyModifiers(key = dayKey()): DailyModifierId[] {
  const rng = seededRng(daySeed(key) ^ 0x9e3779b9);
  return shuffled(DAILY_MODIFIERS.map((m) => m.id), rng).slice(0, 2);
}

/** Three missions of different types, the same for everyone on a given day. */
function rollDailyQuests(key: string): string[] {
  const rng = seededRng(daySeed(key) ^ 0x51ed27);
  const picked: QuestDef[] = [];
  for (const q of shuffled(QUESTS, rng)) {
    if (picked.some((p) => p.type === q.type)) continue;
    picked.push(q);
    if (picked.length === 3) break;
  }
  return picked.map((q) => q.id);
}

export const questById = (id: string): QuestDef => QUESTS.find((q) => q.id === id) || QUESTS[0];

/** Today's missions, re-rolled when the date changed since they were last saved. */
export function currentDailyQuests(save: SaveData, key = dayKey()): DailyQuestState {
  const dq = save.dailyQuests;
  if (dq && dq.date === key && dq.ids.length === 3) return dq;
  const ids = rollDailyQuests(key);
  return { date: key, ids, progress: [0, 0, 0], done: [false, false, false], bonusPaid: false };
}

/** Daily Challenge record for today, reset when the day rolled over. */
export function currentDaily(save: SaveData, key = dayKey()): SaveData['daily'] {
  const d = save.daily;
  if (d.date === key) return d;
  return { ...d, date: key, best: 0, attempts: 0, rewarded: false };
}
