import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { newGame } from './helpers';
import { serialize, deserialize, toJSON, fromJSON } from '@/save/serialize';
import { saveGame, loadGame, listSaves } from '@/save/storage';
import { Game } from '@/sim/game';
import { isTree } from '@/content/objects';
import { startAction } from '@/sim/actions';
import { makeStack } from '@/gen/characters';

describe('saving and world persistence', () => {
  it('round-trips the full state without resetting the world', () => {
    const g = newGame();
    g.advance(180);
    const s = g.state;
    const back = deserialize(serialize(s, 'slot1'));
    expect(back.time).toBe(s.time);
    expect(back.seed).toBe(s.seed);
    expect(Object.keys(back.objects).length).toBe(Object.keys(s.objects).length);
    expect(back.terrain).toEqual(s.terrain);
    expect(back.characters).toEqual(s.characters);
    expect(back.relationships).toEqual(s.relationships);
    expect(back.weather).toEqual(s.weather);
  });

  it('keeps a felled tree felled after save and load', () => {
    const g = newGame();
    g.settings.aiEnabled = false;
    const p = g.player;
    const tree = g.index.nearestObjectRing(p.x, p.y, 30, (o) => isTree(o.type))!;
    p.inventory[12] = makeStack('hatchet');
    p.x = tree.x + 0.5;
    p.y = tree.y + 1.4;
    startAction(g, p, 'chop', 20, { targetId: tree.id });
    g.advance(30);
    expect(g.state.objects[tree.id].type).toBe('stump');
    const again = new Game(deserialize(fromJSON(toJSON(serialize(g.state, 'x')))));
    expect(again.state.objects[tree.id].type).toBe('stump');
    expect(again.index.objAt(tree.x, tree.y)?.type).toBe('stump');
  });

  it('persists NPC state, needs, inventory and dead characters', () => {
    const g = newGame();
    g.advance(240);
    const npc = g.npcs()[3];
    g.killCharacter(npc, 'a test');
    const back = deserialize(serialize(g.state, 'x'));
    const c = back.characters[npc.id];
    expect(c.alive).toBe(false);
    expect(c.death?.cause).toBe('a test');
    const other = g.npcs()[0];
    expect(back.characters[other.id].needs).toEqual(other.needs);
    expect(back.characters[other.id].ai.task).toBe(other.ai.task);
    expect(Object.values(back.objects).some((o) => o.type === 'corpse' && o.label === npc.name)).toBe(true);
  });

  it('stores saves in IndexedDB with metadata', async () => {
    const g = newGame();
    const meta = await saveGame(g.state, 'slot2');
    expect(meta.playerName).toBe(g.player.name);
    const list = await listSaves();
    expect(list.some((m) => m.slot === 'slot2')).toBe(true);
    const loaded = await loadGame('slot2');
    expect(loaded.time).toBe(g.state.time);
    expect(loaded.characters[g.state.playerId].name).toBe(g.player.name);
  });

  it('rejects invalid and foreign save files with a clear error', () => {
    expect(() => deserialize(null)).toThrow();
    expect(() => deserialize({ format: 'something-else' })).toThrow(/not a Modulo/);
    expect(() => fromJSON('{not json')).toThrow(/valid JSON/);
  });
});
