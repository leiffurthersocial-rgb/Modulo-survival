import { WEATHER } from '@/content/weather';
import { clamp, lerp } from '@/core/math';
import type { WeatherId } from './types';
import type { Game } from './game';
import { baseTemperature, season } from './clock';

const VALID: WeatherId[] = ['clear', 'cloudy', 'lightRain', 'heavyRain', 'fog', 'snow', 'thunderstorm'];

/**
 * Weather is a Markov chain over weather types, weighted by season, with
 * a slowly drifting multi-day temperature anomaly (cold and warm periods).
 * Updated at low frequency from the central clock.
 */
export function updateWeather(game: Game, dt: number): void {
  const w = game.state.weather;
  if (!VALID.includes(w.current)) {
    // corrupted or unknown weather state: recover gracefully
    game.warn('weather', `unknown weather "${w.current}", resetting`);
    w.current = 'cloudy';
  }
  const t = game.state.time;
  const def = WEATHER[w.current];
  const s = season(t);

  // anomaly random walk (cold snaps and warm spells over several days)
  w.anomaly = clamp(w.anomaly + game.rng.gauss(0, 0.05) * Math.sqrt(dt) - w.anomaly * 0.0004 * dt, -7, 7);

  // weather transitions
  const hours = (t - w.since) / 60;
  const minH = def.duration[0];
  const maxH = def.duration[1];
  if (hours > minH) {
    const p = (dt / 60) * (hours > maxH ? 0.6 : 0.12);
    if (game.rng.chance(p)) {
      const weights = Object.entries(s.weather) as [WeatherId, number][];
      let next = game.rng.weighted(weights);
      // rain tends to follow clouds, storms follow warmth
      if (next === 'thunderstorm' && w.temp < 12) next = 'heavyRain';
      if ((next === 'lightRain' || next === 'heavyRain') && w.temp < 0.5) next = 'snow';
      if (next === 'snow' && w.temp > 3) next = 'lightRain';
      if (next !== w.current) {
        setWeather(game, next);
      }
    }
  }

  const cur = WEATHER[w.current];
  const targetTemp = baseTemperature(t) + cur.tempMod + w.anomaly;
  w.temp = lerp(w.temp, targetTemp, Math.min(1, 0.02 * dt));
  // precipitation and visibility ease toward targets for smooth transitions
  w.precipitation = lerp(w.precipitation, cur.precip, Math.min(1, 0.03 * dt));
  w.visibility = lerp(w.visibility, cur.visibility, Math.min(1, 0.03 * dt));
  const targetWind = (cur.wind[0] + cur.wind[1]) / 2 + Math.sin(t / 37) * (cur.wind[1] - cur.wind[0]) * 0.4;
  w.wind = lerp(w.wind, targetWind, Math.min(1, 0.02 * dt));
  w.windDir += game.rng.gauss(0, 0.01) * dt;

  // ground dryness drives fire risk
  if (w.precipitation > 0.1) w.dryness -= w.precipitation * 0.004 * dt;
  else w.dryness += (0.0004 + Math.max(0, w.temp - 15) * 0.00006) * dt * (s.id === 'summer' ? 1.5 : s.id === 'winter' ? 0.2 : 1);
  w.dryness = clamp(w.dryness, 0, 1);

  // snow cover
  if (w.current === 'snow') w.snowDepth += w.precipitation * 0.02 * dt;
  else if (w.temp > 1) w.snowDepth -= (w.temp - 1) * 0.004 * dt * (w.precipitation > 0.1 ? 2 : 1);
  w.snowDepth = clamp(w.snowDepth, 0, 60);

  // lightning
  if (w.current === 'thunderstorm' && t >= w.nextLightning) {
    w.nextLightning = t + game.rng.range(2, 9);
    game.bus.emit('lightning', { intensity: game.rng.range(0.5, 1) });
  }
}

export function setWeather(game: Game, next: WeatherId): void {
  const w = game.state.weather;
  const prev = w.current;
  w.current = next;
  w.since = game.state.time;
  game.bus.emit('weatherChanged', { from: prev, to: next });
  const important: WeatherId[] = ['heavyRain', 'thunderstorm', 'snow', 'fog'];
  if (important.includes(next)) game.journal(`The weather turned: ${WEATHER[next].name.toLowerCase()}.`, 'event');
}
