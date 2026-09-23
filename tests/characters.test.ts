import { describe, expect, it } from 'vitest';
import { generateRoster, ATTRIBUTE_BUDGET } from '@/gen/characters';
import { KNOWN_BOYS } from '@/content/characters';
import { ATTR_IDS } from '@/content/skills';

describe('character generation', () => {
  it('creates exactly sixteen 18-year-old students with the eight known boys', () => {
    const r = generateRoster(99, 'normal');
    expect(r).toHaveLength(16);
    expect(r.every((c) => c.age === 18)).toBe(true);
    expect(r.filter((c) => c.fixed).map((c) => c.name)).toEqual(KNOWN_BOYS.map((b) => b.name));
    expect(r.filter((c) => !c.fixed && c.sex === 'f')).toHaveLength(8);
  });

  it('generates the girls deterministically per world seed, differently between worlds', () => {
    const a = generateRoster(5, 'normal').filter((c) => !c.fixed);
    const b = generateRoster(5, 'normal').filter((c) => !c.fixed);
    const c = generateRoster(6, 'normal').filter((c) => !c.fixed);
    expect(a.map((x) => x.name)).toEqual(b.map((x) => x.name));
    expect(a.map((x) => x.appearance)).toEqual(b.map((x) => x.appearance));
    expect(a.map((x) => x.name).join()).not.toEqual(c.map((x) => x.name).join());
    expect(new Set(a.map((x) => x.name)).size).toBe(8);
  });

  it('keeps the fixed appearance of the known boys', () => {
    const r = generateRoster(1, 'normal');
    const erim = r.find((c) => c.id === 'erim')!;
    expect(erim.appearance.glasses).toBe(true);
    expect(erim.appearance.facialHair).toBe('goatee');
    const leif = r.find((c) => c.id === 'leif')!;
    expect(leif.appearance.hairStyle).toBe('fluffy');
    expect(leif.appearance.shirtColor).toBe('#1c1c20');
    expect(leif.equipment.outer).toBeUndefined();
  });

  it('balances attributes so nobody is universally superior', () => {
    for (const c of generateRoster(42, 'normal')) {
      const sum = ATTR_IDS.reduce((s, a) => s + c.attributes[a], 0);
      expect(Math.abs(sum - ATTRIBUTE_BUDGET)).toBeLessThanOrEqual(4);
      expect(c.traits.length).toBe(3);
    }
  });
});
