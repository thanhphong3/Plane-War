import { SaveData } from '../types/game';
import { INITIAL_SAVE, STORAGE_KEY } from './constants';

export function loadGameSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...INITIAL_SAVE };
    const parsed = JSON.parse(raw);
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
    };
  } catch {
    return { ...INITIAL_SAVE };
  }
}

export function saveGameData(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Fail silently in private/restricted storage
  }
}
