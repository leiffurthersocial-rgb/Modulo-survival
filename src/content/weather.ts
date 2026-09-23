import type { WeatherId } from '@/sim/types';

export interface WeatherDef {
  id: WeatherId;
  name: string;
  /** precipitation intensity 0..1 */
  precip: number;
  /** temperature offset C */
  tempMod: number;
  /** wind m/s range */
  wind: [number, number];
  visibility: number;
  /** darkening of daylight 0..1 */
  gloom: number;
  /** hours this weather tends to last */
  duration: [number, number];
  /** fire ignition success multiplier */
  fireMod: number;
}

export const WEATHER: Record<WeatherId, WeatherDef> = {
  clear: { id: 'clear', name: 'Clear', precip: 0, tempMod: 1.5, wind: [0.5, 3], visibility: 1, gloom: 0, duration: [4, 14], fireMod: 1 },
  cloudy: { id: 'cloudy', name: 'Overcast', precip: 0, tempMod: -0.5, wind: [1, 5], visibility: 0.95, gloom: 0.12, duration: [3, 10], fireMod: 0.95 },
  lightRain: { id: 'lightRain', name: 'Light Rain', precip: 0.35, tempMod: -1.5, wind: [1, 5], visibility: 0.85, gloom: 0.22, duration: [2, 6], fireMod: 0.6 },
  heavyRain: { id: 'heavyRain', name: 'Heavy Rain', precip: 0.85, tempMod: -3, wind: [3, 9], visibility: 0.65, gloom: 0.35, duration: [1, 4], fireMod: 0.25 },
  fog: { id: 'fog', name: 'Fog', precip: 0.02, tempMod: -1, wind: [0, 1.5], visibility: 0.45, gloom: 0.18, duration: [2, 6], fireMod: 0.85 },
  snow: { id: 'snow', name: 'Snow', precip: 0.5, tempMod: -2, wind: [1, 6], visibility: 0.6, gloom: 0.25, duration: [2, 8], fireMod: 0.5 },
  thunderstorm: { id: 'thunderstorm', name: 'Thunderstorm', precip: 1, tempMod: -4, wind: [6, 14], visibility: 0.55, gloom: 0.5, duration: [1, 3], fireMod: 0.15 },
};
