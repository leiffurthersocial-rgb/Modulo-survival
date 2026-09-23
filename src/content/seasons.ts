import type { SeasonId, WeatherId } from '@/sim/types';

export interface SeasonDef {
  id: SeasonId;
  name: string;
  /** mean daily air temperature C at start and end of season */
  tempStart: number;
  tempEnd: number;
  /** daily temperature swing (half amplitude) */
  swing: number;
  /** sunrise / sunset hours at season start and end */
  sunrise: [number, number];
  sunset: [number, number];
  /** weather transition weights */
  weather: Partial<Record<WeatherId, number>>;
  /** foraging multiplier */
  forage: number;
  /** can crops grow */
  growing: boolean;
  /** berries available */
  berries: boolean;
  nuts: boolean;
  garlic: boolean;
  mushrooms: number;
}

/** Days per season. Kept modest so that the full cycle can be experienced. */
export const SEASON_DAYS = 14;

export const SEASONS: SeasonDef[] = [
  {
    id: 'spring', name: 'Spring', tempStart: 7, tempEnd: 15, swing: 6, sunrise: [6.5, 5.6], sunset: [19.6, 21.1],
    weather: { clear: 3, cloudy: 4, lightRain: 3, heavyRain: 1.2, fog: 1.2, thunderstorm: 0.3 },
    forage: 0.7, growing: true, berries: false, nuts: false, garlic: true, mushrooms: 0.3,
  },
  {
    id: 'summer', name: 'Summer', tempStart: 17, tempEnd: 20, swing: 7, sunrise: [5.5, 6.2], sunset: [21.4, 20.5],
    weather: { clear: 6, cloudy: 3, lightRain: 1.5, heavyRain: 0.8, fog: 0.4, thunderstorm: 1.2 },
    forage: 1, growing: true, berries: true, nuts: false, garlic: false, mushrooms: 0.5,
  },
  {
    id: 'autumn', name: 'Autumn', tempStart: 14, tempEnd: 5, swing: 5, sunrise: [6.6, 7.4], sunset: [19.9, 17.2],
    weather: { clear: 3, cloudy: 5, lightRain: 3, heavyRain: 1.5, fog: 3, thunderstorm: 0.2, snow: 0.2 },
    forage: 1.1, growing: false, berries: true, nuts: true, garlic: false, mushrooms: 1,
  },
  {
    id: 'winter', name: 'Winter', tempStart: 2, tempEnd: 1, swing: 4, sunrise: [7.6, 7.3], sunset: [16.8, 17.8],
    weather: { clear: 3, cloudy: 5, lightRain: 1, heavyRain: 0.4, fog: 2.5, snow: 3.5 },
    forage: 0.2, growing: false, berries: false, nuts: false, garlic: false, mushrooms: 0,
  },
];
