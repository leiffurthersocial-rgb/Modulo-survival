import { SEASONS, SEASON_DAYS, type SeasonDef } from '@/content/seasons';
import { lerp } from '@/core/math';

/**
 * The centralized simulation clock. Game time is a single number of game
 * minutes since day 1, 00:00. Every time-dependent system reads from here.
 */
export const MIN_PER_DAY = 24 * 60;

export const dayOf = (t: number): number => Math.floor(t / MIN_PER_DAY) + 1;
export const minuteOfDay = (t: number): number => ((t % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
export const hourOf = (t: number): number => minuteOfDay(t) / 60;

export function seasonIndex(t: number): number {
  return Math.floor((dayOf(t) - 1) / SEASON_DAYS) % 4;
}
export function season(t: number): SeasonDef {
  return SEASONS[seasonIndex(t)];
}
/** 0..1 progress through the current season */
export function seasonProgress(t: number): number {
  return (((dayOf(t) - 1) % SEASON_DAYS) + hourOf(t) / 24) / SEASON_DAYS;
}
export const dayInSeason = (t: number): number => ((dayOf(t) - 1) % SEASON_DAYS) + 1;
export const year = (t: number): number => Math.floor((dayOf(t) - 1) / (SEASON_DAYS * 4)) + 1;

export function sunTimes(t: number): { rise: number; set: number } {
  const s = season(t);
  const p = seasonProgress(t);
  return { rise: lerp(s.sunrise[0], s.sunrise[1], p), set: lerp(s.sunset[0], s.sunset[1], p) };
}

/** 0 at night, 1 at full day, smooth twilight around sunrise/sunset. */
export function daylight(t: number): number {
  const h = hourOf(t);
  const { rise, set } = sunTimes(t);
  const tw = 0.75;
  if (h < rise - tw || h > set + tw) return 0;
  if (h < rise + tw) return (h - (rise - tw)) / (2 * tw);
  if (h > set - tw) return 1 - (h - (set - tw)) / (2 * tw);
  return 1;
}

export const isNight = (t: number): boolean => daylight(t) < 0.3;

/** Mean seasonal air temperature for this moment, before weather. */
export function baseTemperature(t: number): number {
  const s = season(t);
  const p = seasonProgress(t);
  const mean = lerp(s.tempStart, s.tempEnd, p);
  const h = hourOf(t);
  // coldest near sunrise, warmest mid-afternoon
  const diurnal = Math.cos(((h - 15) / 24) * Math.PI * 2);
  return mean + diurnal * s.swing;
}

export function formatClock(t: number): string {
  const m = Math.floor(minuteOfDay(t));
  const hh = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDate(t: number): string {
  return `${season(t).name}, day ${dayInSeason(t)}`;
}
