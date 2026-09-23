import type { SeasonId } from '@/sim/types';

export interface CropDef {
  id: string;
  name: string;
  /** days to maturity under good conditions */
  days: number;
  yield: [string, number, number];
  seasons: SeasonId[];
  /** min temperature before frost damage */
  frost: number;
  /** water need per day (0..1 of soil moisture) */
  thirst: number;
}

export const CROPS: Record<string, CropDef> = {
  potato: { id: 'potato', name: 'Potatoes', days: 10, yield: ['potato', 4, 8], seasons: ['spring', 'summer'], frost: 0, thirst: 0.35 },
  bean: { id: 'bean', name: 'Beans', days: 8, yield: ['beans_dry', 4, 7], seasons: ['spring', 'summer'], frost: 2, thirst: 0.45 },
  carrot: { id: 'carrot', name: 'Carrots', days: 7, yield: ['carrot', 3, 6], seasons: ['spring', 'summer', 'autumn'], frost: -2, thirst: 0.4 },
};
