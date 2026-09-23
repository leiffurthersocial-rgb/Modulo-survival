import { describe, expect, it } from 'vitest';
import { newGame } from './helpers';
import { makeStack } from '@/gen/characters';

describe('taking from and giving to classmates', () => {
  it('friends let you take things; strangers mind; nobody gives up what they need', () => {
    const g = newGame();
    g.settings.aiEnabled = false;
    const p = g.player;
    const [a, b] = g.livingCharacters().filter((c) => c !== p);
    a.inventory[10] = makeStack('stone', 3);
    b.inventory[10] = makeStack('stone', 3);
    g.social.get(a.id, p.id).affinity = 60;
    g.social.get(b.id, p.id).affinity = 0;
    const trustB = g.social.get(b.id, p.id).trust;
    expect(g.social.takeFromPerson(p, a, 10)).toBe(true);
    expect(g.social.takeFromPerson(p, b, 10)).toBe(true);
    expect(g.social.get(b.id, p.id).trust).toBeLessThan(trustB);
    expect(b.memories.some((m) => m.kind === 'tookFrom')).toBe(true);

    // a starving classmate keeps their last food
    b.needs.satiety = 10;
    b.inventory = b.inventory.map((s) => (s && s.id === 'ration' ? null : s));
    b.inventory[11] = makeStack('ration', 1);
    expect(g.social.takeFromPerson(p, b, 11)).toBe(false);

    // rivals refuse outright
    g.social.get(b.id, p.id).affinity = -50;
    b.inventory[12] = makeStack('stone', 1);
    expect(g.social.takeFromPerson(p, b, 12)).toBe(false);
  });

  it('gifts improve how someone feels about you', () => {
    const g = newGame();
    const p = g.player;
    const a = g.livingCharacters().find((c) => c !== p)!;
    a.needs.satiety = 20;
    const before = g.social.get(p.id, a.id).affinity;
    g.social.giveToPerson(p, a, makeStack('ration', 1));
    expect(g.social.get(p.id, a.id).affinity).toBeGreaterThan(before + 5);
  });
});

describe('player social actions', () => {
  it('comforting helps someone who is low, and cannot be spammed', () => {
    const g = newGame();
    const p = g.player;
    const a = g.livingCharacters().find((c) => c !== p)!;
    a.needs.morale = 20;
    const before = g.social.get(a.id, p.id).affinity;
    g.social.playerSocial(p, a, 'comfort');
    expect(a.needs.morale).toBeGreaterThan(25);
    const after = g.social.get(a.id, p.id).affinity;
    expect(after).toBeGreaterThan(before);
    g.social.playerSocial(p, a, 'comfort');
    expect(g.social.get(a.id, p.id).affinity).toBe(after);
  });

  it('an accepted apology softens old grudges', () => {
    const g = newGame();
    const p = g.player;
    const a = g.livingCharacters().find((c) => c !== p && !c.traits.includes('stubborn'))!;
    a.memories.push({ kind: 'tookFrom', who: p.id, day: 1, weight: -10, text: 'took my knife' });
    g.social.get(a.id, p.id).trust = 100;
    for (let i = 0; i < 20 && a.memories[a.memories.length - 1].kind !== 'apology'; i++) {
      g.social.get(a.id, p.id).cool = {};
      g.social.playerSocial(p, a, 'apologise');
    }
    expect(a.memories.find((m) => m.kind === 'tookFrom')!.weight).toBeGreaterThan(-10);
  });
});
