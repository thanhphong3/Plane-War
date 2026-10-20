import { useSyncExternalStore } from 'react';

export type Lang = 'en' | 'vi';

const LANG_KEY = 'neon_blitz_lang';

function readLang(): Lang {
  try {
    return localStorage.getItem(LANG_KEY) === 'vi' ? 'vi' : 'en';
  } catch {
    return 'en';
  }
}

let lang: Lang = readLang();
const listeners = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export const getLang = () => lang;

export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  document.documentElement.lang = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // Fail silently in private/restricted storage
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders the caller when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang);
}

/**
 * Inline bilingual string: English first, Vietnamese second.
 * Reads the current language at call time, so React callers should also `useLang()`.
 */
export const tr = (en: string, vi: string) => (lang === 'vi' ? vi : en);

/** Canvas font stack. Orbitron has no Vietnamese glyphs, so swap to Exo 2 in VI. */
export const canvasFont = () => (lang === 'vi' ? "'Exo 2', sans-serif" : "'Orbitron', sans-serif");
