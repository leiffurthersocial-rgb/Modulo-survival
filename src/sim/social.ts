import { clamp } from '@/core/math';
import { rand3, hashString } from '@/core/rng';
import type { Character, ItemStack, MemoryKind, Relationship, TraitId } from './types';
import { itemDef } from '@/content/items';
import type { Game } from './game';
import { dayOf, hourOf } from './clock';
import { addItem } from './inventory';

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

function foodCount(c: Character): number {
  return c.inventory.reduce((n, s) => n + (s && itemDef(s.id).food ? s.qty : 0), 0);
}

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
    this.careForEachOther(people, dt);
    this.fireEvenings(people);
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

  /** Friends look after each other: comfort, shared food, making up. */
  private careForEachOther(people: Character[], dt: number): void {
    const g = this.game;
    for (const a of people) {
      if (g.isPlayer(a) || a.action?.type === 'sleep') continue;
      for (const b of people) {
        if (a === b || g.isPlayer(b)) continue;
        if (Math.abs(a.x - b.x) > 5 || Math.abs(a.y - b.y) > 5) continue;
        const r = this.get(a.id, b.id);
        const kind = a.traits.includes('compassionate') ? 1.6 : 1;
        // comfort a friend who is struggling
        if (b.needs.morale < 30 && r.affinity > 25 && a.needs.morale > 40 && g.rng.chance(0.25 * kind * (dt / 30))) {
          b.needs.morale = Math.min(100, b.needs.morale + 8);
          b.needs.stress = Math.max(0, b.needs.stress - 8);
          this.adjust(a.id, b.id, 3, 2);
          this.remember(b.id, 'comforted', a.id, 6, `${a.name} sat with me when I was low`);
          g.say(a, g.rng.pick(['Hey. We will get through this.', 'Talk to me. What is going on?', 'You are not alone out here.']), 5);
          g.say(b, g.rng.pick(['Thanks. I needed that.', 'I know. It is just hard.', '...Thank you.']), 5, 3);
          continue;
        }
        // share food with a hungry friend
        if (b.needs.satiety < 15 && r.affinity > 20 && a.needs.satiety > 45 && g.rng.chance(0.3 * kind * (dt / 30))) {
          const i = a.inventory.findIndex((s) => !!s && !!itemDef(s.id).food && (itemDef(s.id).food!.risk ?? 0) < 0.3);
          if (i >= 0 && foodCount(a) > 2) {
            const s = a.inventory[i]!;
            const one = { ...s, qty: 1 };
            s.qty -= 1;
            if (s.qty <= 0) a.inventory[i] = null;
            const left = addItem(b.inventory, one);
            if (left) addItem(a.inventory, left);
            else {
              this.helped(a.id, b.id, `shared ${itemDef(one.id).name.toLowerCase()} with me`, 6);
              g.say(a, 'Here, take this. You look like you need it.', 5);
            }
            continue;
          }
        }
        // rivals sometimes make up, especially the kind or optimistic
        if ((r.rivals || r.affinity < -15) && a.needs.stress < 40 && g.rng.chance(0.02 * kind * (a.traits.includes('optimistic') ? 1.5 : 1) * (a.traits.includes('stubborn') ? 0.3 : 1) * (dt / 30))) {
          this.adjust(a.id, b.id, 14, 8);
          this.remember(b.id, 'apology', a.id, 5, `${a.name} apologised to me`);
          g.say(a, g.rng.pick(['Look, I am sorry about before.', 'Can we start over?', 'I was out of line. Sorry.']), 5);
          g.say(b, g.rng.pick(['...Alright. Me too.', 'Yeah. Let us move on.', 'Thanks for saying that.']), 5, 3);
          g.journal(`${a.name} and ${b.name} patched things up.`, 'social');
        }
      }
    }
    // friendships worth mentioning
    for (const k in g.state.relationships) {
      const r = g.state.relationships[k];
      if (r.friends || r.affinity < 65 || r.trust < 55) continue;
      const [a, b] = k.split('|');
      const ca = g.state.characters[a];
      const cb = g.state.characters[b];
      if (!ca?.alive || !cb?.alive) continue;
      r.friends = true;
      if (!g.isPlayer(ca) && !g.isPlayer(cb)) g.journal(`${ca.name} and ${cb.name} have become close friends.`, 'social');
      else g.journal(`${g.isPlayer(ca) ? cb.name : ca.name} counts you as a close friend now.`, 'social');
    }
  }

  /** Evenings around a lit fire: songs, stories and plans lift everyone. */
  private fireEvenings(people: Character[]): void {
    const g = this.game;
    const h = hourOf(g.state.time);
    if (h < 19 || h > 23) return;
    const day = dayOf(g.state.time);
    if ((g.state.lastFireEvening ?? -1) >= day) return;
    const fire = g.index.nearestOfType(['campfire', 'fire_pit'], g.home.x, g.home.y, 20, (o) => !!o.lit);
    if (!fire) return;
    const circle = people.filter((c) => Math.hypot(c.x - fire.x, c.y - fire.y) < 5 && !c.sleeping);
    if (circle.length < 4 || !g.rng.chance(0.35)) return;
    g.state.lastFireEvening = day;
    const moments = [
      { text: 'sang songs around the fire until late', line: 'Everyone knows this one. Come on.' },
      { text: 'told stories about home around the fire', line: 'Remember the first day of school?' },
      { text: 'made plans for the coming weeks by the fire', line: 'If we store enough wood now, winter will be fine.' },
      { text: 'laughed together by the fire for the first time in days', line: 'I cannot believe you did that.' },
      { text: 'sat quietly by the fire, remembering the ones who are gone', line: 'To the ones we lost.' },
    ];
    const lost = Object.values(g.state.characters).some((c) => !c.alive);
    const m = lost && g.rng.chance(0.3) ? moments[4] : g.rng.pick(moments.slice(0, 4));
    const teller = g.rng.pick(circle.filter((c) => !g.isPlayer(c)));
    if (teller) g.say(teller, m.line, 6);
    for (const c of circle) {
      c.needs.morale = Math.min(100, c.needs.morale + 7);
      c.needs.stress = Math.max(0, c.needs.stress - 6);
      this.remember(c.id, 'campEvent', undefined, 4, `we ${m.text}`);
    }
    for (let i = 0; i < circle.length; i++) for (let j = i + 1; j < circle.length; j++) this.adjust(circle[i].id, circle[j].id, 1.5, 1);
    g.journal(`The group ${m.text}.`, 'social');
  }

  /**
   * Player social actions on a classmate. Each returns what they say; all
   * have cooldowns so they cannot be repeated for easy affection.
   */
  playerSocial(player: Character, npc: Character, act: 'comfort' | 'praise' | 'ask' | 'apologise'): void {
    const g = this.game;
    const r = this.get(npc.id, player.id);
    const cool = (r.cool ??= {});
    if ((cool[act] ?? 0) > g.state.time) {
      g.say(npc, act === 'ask' ? 'You already asked me that.' : g.rng.pick(['Thanks, but I am alright for now.', 'Mm.']), 4);
      return;
    }
    cool[act] = g.state.time + (act === 'ask' ? 1440 * 3 : act === 'apologise' ? 1440 : 240);
    if (act === 'comfort') {
      const low = npc.needs.morale < 45 || npc.needs.stress > 55;
      npc.needs.morale = Math.min(100, npc.needs.morale + (low ? 12 : 3));
      npc.needs.stress = Math.max(0, npc.needs.stress - (low ? 10 : 2));
      this.adjust(npc.id, player.id, low ? 5 : 1, low ? 3 : 0.5);
      if (low) this.remember(npc.id, 'comforted', player.id, 6, `${player.name} was there for me`);
      g.say(npc, low ? g.rng.pick(['Thank you. It helps to hear that.', 'I did not want to say it, but I am scared.', 'Sorry. It has been a bad day.']) : g.rng.pick(['I am okay, really.', 'Thanks. You too.']), 5);
    } else if (act === 'praise') {
      const worked = npc.ai.task !== 'idle' && npc.ai.task !== 'socialise';
      npc.needs.morale = Math.min(100, npc.needs.morale + (worked ? 6 : 2));
      this.adjust(npc.id, player.id, worked ? 3 : 0.5, 1);
      if (worked) this.remember(npc.id, 'praised', player.id, 3, `${player.name} said I was doing good work`);
      g.say(npc, worked ? g.rng.pick(['Someone has to do it.', 'Thanks. That means something.', 'We all do our part.']) : 'For what, exactly?', 4);
    } else if (act === 'ask') {
      this.adjust(npc.id, player.id, 3, 3);
      g.say(npc, `${npc.background} ${traitLine(npc.traits)}`, 8);
    } else {
      const grudges = npc.memories.filter((m) => m.who === player.id && m.weight < 0);
      if (!grudges.length) {
        g.say(npc, 'Sorry for what? We are fine.', 4);
        return;
      }
      const accept = g.rng.chance(0.4 + r.trust / 200 + (npc.traits.includes('compassionate') ? 0.2 : 0) - (npc.traits.includes('stubborn') ? 0.25 : 0));
      if (accept) {
        for (const m of grudges) m.weight = Math.round(m.weight * 0.3);
        this.adjust(npc.id, player.id, 8, 6);
        this.remember(npc.id, 'apology', player.id, 4, `${player.name} apologised to me`);
        g.say(npc, g.rng.pick(['Alright. Thanks for saying it.', 'Okay. Let us put it behind us.']), 5);
      } else g.say(npc, g.rng.pick(['Words are cheap.', 'I am not ready to hear that yet.']), 5);
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

  /**
   * The player takes something out of a classmate's bag. Friends shrug it off;
   * others mind, refuse if it is something they need, and remember it. Taking
   * from a sleeper is theft if they notice. Returns false when refused.
   */
  takeFromPerson(taker: Character, owner: Character, slot: number): boolean {
    const g = this.game;
    const s = owner.inventory[slot];
    if (!s) return false;
    const r = this.get(owner.id, taker.id);
    const d = itemDef(s.id);
    const name = d.name.toLowerCase();
    const friend = r.partners || r.affinity >= 35;
    if (owner.sleeping) {
      if (g.rng.chance(0.35)) {
        this.adjust(owner.id, taker.id, -10, -18);
        this.remember(owner.id, 'stolen', taker.id, -14, `${taker.name} took my ${name} while I slept`);
        g.journal(`${owner.name} noticed ${taker.name} going through their things at night.`, 'social');
      }
      return true;
    }
    const needsIt =
      (d.food && owner.needs.satiety < 30 && foodCount(owner) <= 2) ||
      (d.category === 'water' && owner.needs.hydration < 35) ||
      (d.medical === 'bandage' && owner.health.injuries.some((i) => !i.bandaged));
    if (r.rivals || r.affinity < -25) {
      this.adjust(owner.id, taker.id, -2, -2);
      g.say(owner, g.rng.pick(['Keep your hands off my things.', 'Not a chance.', 'Get out of my bag.']), 5);
      return false;
    }
    if (needsIt && !r.partners) {
      g.say(owner, g.rng.pick(['I need that. Sorry.', 'No, I need that one.', 'Please, not that. I need it.']), 5);
      return false;
    }
    if (friend) {
      this.adjust(owner.id, taker.id, -0.5);
      g.say(owner, g.rng.pick(['Sure, take it.', 'Go ahead.', 'It is yours.']), 4);
    } else {
      this.adjust(owner.id, taker.id, -4, -4);
      this.remember(owner.id, 'tookFrom', taker.id, -4, `${taker.name} took my ${name}`);
      g.say(owner, g.rng.pick(['Hey. Fine, take it.', 'You could have asked.', 'That was mine.']), 4);
    }
    return true;
  }

  /** The player puts something into a classmate's bag. */
  giveToPerson(giver: Character, owner: Character, s: ItemStack): void {
    const g = this.game;
    const d = itemDef(s.id);
    const wanted = (d.food && owner.needs.satiety < 40) || (d.category === 'water' && owner.needs.hydration < 45) || (d.category === 'clothing' && owner.needs.bodyTemp < 36.5);
    const amount = wanted ? 7 : d.food || d.medical ? 3 : 1.5;
    this.adjust(giver.id, owner.id, amount, amount * 0.7);
    this.remember(owner.id, 'gift', giver.id, amount, `${giver.name} gave me ${d.name.toLowerCase()}`);
    g.say(owner, wanted ? g.rng.pick(['You have no idea how much I needed this.', 'Thank you. Really.']) : g.rng.pick(['Thanks.', 'Oh, thank you.', 'That is kind.']), 4);
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

function traitLine(traits: TraitId[]): string {
  if (traits.includes('anxious')) return 'Honestly, all this scares me more than I let on.';
  if (traits.includes('brave')) return 'I think we can make it out here, if we keep our heads.';
  if (traits.includes('curious')) return 'I keep wondering what actually happened back there.';
  if (traits.includes('introverted')) return 'I do better with a job to do than with a crowd.';
  if (traits.includes('optimistic')) return 'Somehow I still think it will turn out alright.';
  if (traits.includes('stubborn')) return 'I do things my own way. You will get used to it.';
  return 'We will see how it goes.';
}
