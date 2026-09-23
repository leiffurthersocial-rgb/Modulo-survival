export interface Settings {
  master: number;
  music: number;
  sfx: number;
  ambience: number;
  touchControls: boolean;
  uiScale: number;
  lowResolution: boolean;
  reducedEffects: boolean;
  showNames: boolean;
  autosaveMinutes: number;
}

const KEY = 'modulo-survival:settings';

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  ambience: 0.7,
  touchControls: false,
  uiScale: 1,
  lowResolution: false,
  reducedEffects: false,
  showNames: true,
  autosaveMinutes: 4,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable: settings last for this session only
  }
}

export const debugAllowed = (): boolean => import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
