import { SaveData } from '../types/game';
import { DEFAULT_SETTINGS, INITIAL_SAVE, STORAGE_KEY } from './constants';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const isArr3 = (v: unknown) => Array.isArray(v) && v.length === 3;

/** First-run defaults that follow the OS "reduce motion" accessibility setting. */
function freshSettings() {
  let reduce = false;
  try {
    reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    reduce = false;
  }
  return reduce ? { ...DEFAULT_SETTINGS, shake: 0, reduceFlash: true } : { ...DEFAULT_SETTINGS };
}

const freshSave = (): SaveData => ({ ...INITIAL_SAVE, settings: freshSettings() });

/** Keeps an unreadable save aside instead of silently overwriting the player's progress. */
function backupCorrupt(raw: string) {
  try {
    localStorage.setItem(`${STORAGE_KEY}.bak-${Date.now()}`, raw);
  } catch {
    // storage full / blocked: nothing more we can do
  }
}

export function loadGameSave(): SaveData {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return freshSave();
  }
  if (!raw) return freshSave();
  try {
    const parsed = JSON.parse(raw);
    if (!isObj(parsed as unknown)) {
      backupCorrupt(raw);
      return freshSave();
    }
    return {
      ...INITIAL_SAVE,
      ...parsed,
      upgrades: {
        ...INITIAL_SAVE.upgrades,
        ...(parsed.upgrades || {}),
      },
      unlockedShips: Array.isArray(parsed.unlockedShips) && parsed.unlockedShips.length > 0
        ? parsed.unlockedShips
        : ['striker'],
      unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
        ? parsed.unlockedAchievements
        : [],
      campaignUnlocked: typeof parsed.campaignUnlocked === 'number' ? parsed.campaignUnlocked : 0,
      campaignStars: Array.isArray(parsed.campaignStars) ? parsed.campaignStars : [],
      bestBossRush: typeof parsed.bestBossRush === 'number' ? parsed.bestBossRush : 0,
      bestBossRushTime: typeof parsed.bestBossRushTime === 'number' ? parsed.bestBossRushTime : 0,
      dailyQuests:
        isObj(parsed.dailyQuests) &&
        isArr3(parsed.dailyQuests.ids) &&
        isArr3(parsed.dailyQuests.progress) &&
        isArr3(parsed.dailyQuests.done)
          ? (parsed.dailyQuests as unknown as SaveData['dailyQuests'])
          : INITIAL_SAVE.dailyQuests,
      daily: { ...INITIAL_SAVE.daily, ...(isObj(parsed.daily) ? parsed.daily : {}) },
      shipXp: isObj(parsed.shipXp) ? parsed.shipXp : {},
      shipSkin: isObj(parsed.shipSkin) ? parsed.shipSkin : {},
      settings: { ...DEFAULT_SETTINGS, ...(isObj(parsed.settings) ? parsed.settings : {}) },
      totalElites: typeof parsed.totalElites === 'number' ? parsed.totalElites : 0,
      totalRevives: typeof parsed.totalRevives === 'number' ? parsed.totalRevives : 0,
    };
  } catch {
    backupCorrupt(raw);
    return freshSave();
  }
}

export function saveGameData(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Fail silently in private/restricted storage
  }
}
