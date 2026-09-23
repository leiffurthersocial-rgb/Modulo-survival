import { describe, expect, it } from 'vitest';
import { generateRoster, ATTRIBUTE_BUDGET } from '@/gen/characters';
import { KNOWN_BOYS, KNOWN_GIRLS, TRAIT_CONFLICTS } from '@/content/characters';
import { ATTR_IDS } from '@/content/skills';

describe('character generation', () => {
  it('creates exactly sixteen 18-year-old students: the eight known boys and eight fixed girls', () => {
    const r = generateRoster(99, 'normal');
    expect(r).toHaveLength(16);
    expect(r.every((c) => c.age === 18)).toBe(true);
    expect(r.filter((c) => c.sex === 'm').map((c) => c.name)).toEqual(KNOWN_BOYS.map((b) => b.name));
    expect(r.filter((c) => c.sex === 'f').map((c) => c.name)).toEqual(KNOWN_GIRLS.map((g) => g.name));
    expect(new Set(r.map((c) => c.id)).size).toBe(16);
    expect(r.map((c) => c.name)).not.toContain('Emma');
    expect(r.map((c) => c.name)).not.toContain('Lina');
  });

  it('keeps everyone identical across worlds: looks, traits, stats, skills and background', () => {
    const a = generateRoster(5, 'normal');
    const b = generateRoster(6, 'hardcore');
    const pick = (c: (typeof a)[number]) => [c.name, c.appearance, c.traits, c.attributes, c.skills, c.background];
    expect(a.map(pick)).toEqual(b.map(pick));
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
      expect(sum).toBe(ATTRIBUTE_BUDGET);
      expect(c.traits.length).toBe(3);
      for (const [x, y] of TRAIT_CONFLICTS) expect(c.traits.includes(x) && c.traits.includes(y)).toBe(false);
      for (const a of ATTR_IDS) expect(c.attributes[a]).toBeGreaterThanOrEqual(2);
      for (const a of ATTR_IDS) expect(c.attributes[a]).toBeLessThanOrEqual(9);
    }
  });
});
