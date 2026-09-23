import { clamp } from '@/core/math';
import { rand3, hashString } from '@/core/rng';
import type { Character, MemoryKind, Relationship, TraitId } from './types';
import type { Game } from './game';
import { dayOf } from './clock';

/** Conversation lines. Topics never concern anyone's physical appearance. */
const TOPICS: { opener: string; reply: string[] }[] = [
  { opener: 'Do you think anyone at home made it?', reply: ['I have to believe it.', 'I try not to think about it.', 'My parents always had a plan for everything.'] },
  { opener: 'Remember the class trip to Lucerne?', reply: ['That feels like a hundred years ago.', 'Best week of the year.', 'You got us lost twice.'] },
  { opener: 'We need more firewood before the cold comes.', reply: ['I can go tomorrow.', 'Agreed. Winter will be hard.', 'Let us look near the shed.'] },
  { opener: 'I keep thinking about hot showers.', reply: ['Do not remind me.', 'The stream will have to do.', 'One day again.'] },
  { opener: 'What do you miss most?', reply: ['Music. Just having music on.', 'My bed.', 'Knowing what tomorrow looks like.'] },
  { opener: 'The radio was silent again last night.', reply: ['Someone must still be out there.', 'Maybe the batteries.', 'Keep listening.'] },
  { opener: 'We are getting better at this.', reply: ['We have to.', 'Slowly.', 'Some days it feels like it.'] },
  { opener: 'I heard something in the trees last night.', reply: ['Probably a deer.', 'Boar, I think. Stay close to the fire.', 'I heard it too.'] },
  { opener: 'Do you think we should move further from the road?', reply: ['Nobody has come this way.', 'Maybe. It is quiet here.', 'Let us wait and see.'] },
  { opener: 'The garden might actually work.', reply: ['If the frost stays away.', 'My grandmother would laugh at us.', 'We need more seeds.'] },
];

const ARGUMENTS = [
  'argued about who ate the last of the rations',
  'argued about how the work is split',
  'argued about whether to leave the forest',
  'had a sharp disagreement about the water',
  'argued about a borrowed knife that was not returned',
];

function compat(a: TraitId[], b: TraitId[]): number {
  let v = 0;
  for (const t of a) {
    if (b.includes(t)) v += 6;
    if ((t === 'social' && b.includes('introverted')) || (t === 'introverted' && b.includes('social'))) v -= 3;
    if ((t === 'hardworking' && b.includes('lazy')) || (t === 'lazy' && b.includes('hardworking'))) v -= 6;
    if ((t === 'cautious' && b.includes('riskTaking')) || (t === 'riskTaking' && b.includes('cautious'))) v -= 4;
    if (t === 'stubborn' && b.includes('stubborn')) v -= 8;
    if (t === 'compassionate') v += 3;
  }
  return v;
}

export class Social {
  constructor(private game: Game) {}

  key(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  get(a: string, b: string): Relationship {
    const k = this.key(a, b);
    let r = this.game.state.relationships[k];
    if (!r) {
      r = { affinity: 0, trust: 40, romance: 0, partners: false, rivals: false, interactions: 0 };
      this.game.state.relationships[k] = r;
    }
    return r;
  }

  /** Attraction potential for a pair is fixed per world; many pairs have none. */
  attraction(a: string, b: string): number {
    const v = rand3(this.game.state.seed, hashString(this.key(a, b)), 3, 9);
    return v < 0.72 ? 0 : (v - 0.72) / 0.28;
  }

  initialise(): void {
    const chars = Object.values(this.game.state.characters);
    const rngSeed = this.game.state.seed;
    for (let i = 0; i < chars.length; i++)
      for (let j = i + 1; j < chars.length; j++) {
        const a = chars[i];
        const b = chars[j];
        const r = this.get(a.id, b.id);
        const base = (rand3(rngSeed, hashString(a.id), hashString(b.id), 1) - 0.4) * 50;
        r.affinity = clamp(Math.round(base + compat(a.traits, b.traits)), -30, 55);
        r.trust = clamp(Math.round(35 + r.affinity * 0.4), 10, 70);
      }
  }

  adjust(a: string, b: string, dAff: number, dTrust = 0): void {
    if (a === b) return;
    const r = this.get(a, b);
    r.affinity = clamp(r.affinity + dAff, -100, 100);
    r.trust = clamp(r.trust + dTrust, 0, 100);
    r.interactions++;
    if (r.affinity < -40 && !r.rivals) {
      r.rivals = true;
      this.game.journal(`${this.name(a)} and ${this.name(b)} can no longer stand each other.`, 'social');
    } else if (r.affinity > -20 && r.rivals) r.rivals = false;
    if (r.partners && r.affinity < 15) {
      r.partners = false;
      r.romance = 10;
      this.remember(a, 'breakup', b, -18, `broke up with ${this.name(b)}`);
      this.remember(b, 'breakup', a, -18, `broke up with ${this.name(a)}`);
      this.game.journal(`${this.name(a)} and ${this.name(b)} are no longer together.`, 'social');
    }
  }

  name(id: string): string {
    return this.game.state.characters[id]?.name ?? id;
  }

  remember(who: string, kind: MemoryKind, about: string | undefined, weight: number, text: string): void {
    const c = this.game.state.characters[who];
    if (!c || !c.alive) return;
    c.memories.push({ kind, who: about, day: dayOf(this.game.state.time), weight, text });
    if (c.memories.length > 30) c.memories.shift();
  }

  helped(helper: string, helped: string, text: string, amount: number): void {
    this.adjust(helper, helped, amount, amount * 0.6);
    this.remember(helped, 'helped', helper, amount, `${this.name(helper)} ${text}`);
  }

  friendsNearby(c: Character): number {
    let n = 0;
    for (const o of this.game.livingCharacters()) {
      if (o === c) continue;
      if (Math.abs(o.x - c.x) > 6 || Math.abs(o.y - c.y) > 6) continue;
      if (this.get(c.id, o.id).affinity > 30) n++;
    }
    return Math.min(n, 3);
  }

  opinionOfPlayer(c: Character): Relationship {
    return this.get(c.id, this.game.state.playerId);
  }

  /** Low-frequency social simulation: conversations, arguments, romance. */
  update(dt: number): void {
    const g = this.game;
    const people = g.livingCharacters().filter((c) => !c.sleeping);
    for (let i = 0; i < people.length; i++) {
      const a = people[i];
      if (g.isPlayer(a)) continue;
      for (let j = i + 1; j < people.length; j++) {
        const b = people[j];
        if (g.isPlayer(b)) continue;
        if (Math.abs(a.x - b.x) > 4 || Math.abs(a.y - b.y) > 4) continue;
        const r = this.get(a.id, b.id);
        // spending time near each other
        const busy = (a.action && a.action.type !== 'rest') || (b.action && b.action.type !== 'rest');
        const p = (busy ? 0.08 : 0.35) * (dt / 30) * (a.traits.includes('social') || b.traits.includes('social') ? 1.5 : 1);
        if (!g.rng.chance(p)) continue;
        const tension = (a.needs.stress + b.needs.stress) / 200 + (r.affinity < 0 ? 0.2 : 0) + (a.traits.includes('stubborn') ? 0.1 : 0) + (g.campFoodDays() < 0.5 ? 0.15 : 0);
        if (g.rng.chance(clamp(tension * 0.35, 0.02, 0.5))) this.argue(a, b);
        else this.talk(a, b);
      }
    }
    // romance evolves slowly among close pairs
    for (const k in g.state.relationships) {
      const r = g.state.relationships[k];
      const [a, b] = k.split('|');
      const ca = g.state.characters[a];
      const cb = g.state.characters[b];
      if (!ca?.alive || !cb?.alive || g.isPlayer(ca) || g.isPlayer(cb)) continue;
      const att = this.attraction(a, b);
      if (att <= 0) continue;
      if (r.affinity > 45 && r.trust > 45 && !r.partners) {
        r.romance = clamp(r.romance + att * 0.8 * (dt / 30), 0, 100);
        const taken = Object.entries(g.state.relationships).some(([k2, r2]) => r2.partners && k2 !== k && (k2.split('|').includes(a) || k2.split('|').includes(b)));
        if (r.romance > 70 && !taken) {
          r.partners = true;
          this.remember(a, 'partnered', b, 20, `grew close to ${cb.name}`);
          this.remember(b, 'partnered', a, 20, `grew close to ${ca.name}`);
          g.journal(`${ca.name} and ${cb.name} have become a couple.`, 'social');
        }
      } else if (!r.partners) r.romance = Math.max(0, r.romance - 0.2 * (dt / 30));
    }
  }

  talk(a: Character, b: Character): void {
    const g = this.game;
    const topic = g.rng.pick(TOPICS);
    g.say(a, topic.opener, 5);
    const reply = g.rng.pick(topic.reply);
    g.say(b, reply, 5, 3);
    const bonus = 1.5 + compat(a.traits, b.traits) * 0.08 + (a.traits.includes('social') ? 0.8 : 0);
    this.adjust(a.id, b.id, clamp(bonus, 0.5, 4), 0.8);
    a.needs.stress = Math.max(0, a.needs.stress - 3);
    b.needs.stress = Math.max(0, b.needs.stress - 3);
    a.needs.morale = Math.min(100, a.needs.morale + 1.5);
    b.needs.morale = Math.min(100, b.needs.morale + 1.5);
    if (g.rng.chance(0.15)) g.journal(`${a.name} and ${b.name} talked for a while.`, 'social');
  }

  argue(a: Character, b: Character): void {
    const g = this.game;
    const what = g.rng.pick(ARGUMENTS);
    this.adjust(a.id, b.id, -g.rng.range(4, 10), -3);
    this.remember(a.id, 'argued', b.id, -6, `${what} with ${b.name}`);
    this.remember(b.id, 'argued', a.id, -6, `${what} with ${a.name}`);
    a.needs.stress = Math.min(100, a.needs.stress + 8);
    b.needs.stress = Math.min(100, b.needs.stress + 8);
    g.say(a, g.rng.pick(['That is not fair.', 'You never listen.', 'Forget it.', 'We cannot keep doing this.']), 5);
    g.say(b, g.rng.pick(['Then do it yourself.', 'Calm down.', 'I am doing my part.', 'Leave me alone.']), 5, 3);
    g.journal(`${a.name} and ${b.name} ${what}.`, 'social');
  }

  onDeath(dead: Character): void {
    const g = this.game;
    for (const c of g.livingCharacters()) {
      const r = this.get(c.id, dead.id);
      const grief = 12 + Math.max(0, r.affinity) * 0.5 + (r.partners ? 40 : 0);
      this.remember(c.id, 'death', dead.id, -grief, `lost ${dead.name}`);
      c.needs.stress = Math.min(100, c.needs.stress + grief * 0.6);
      c.needs.morale = Math.max(0, c.needs.morale - grief * 0.5);
      if (r.partners) g.journal(`${c.name} is devastated by the loss of ${dead.name}.`, 'social');
    }
  }

  sharedExperience(ids: string[], amount: number, text: string): void {
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        this.adjust(ids[i], ids[j], amount, amount * 0.8);
        this.remember(ids[i], 'expedition', ids[j], amount, text);
        this.remember(ids[j], 'expedition', ids[i], amount, text);
      }
  }
}
