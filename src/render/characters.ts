import type { Character, Dir } from '@/sim/types';
import { makeCanvas, PixelPainter, shade } from './pixel';
import { hashString } from '@/core/rng';

export const CW = 16;
export const CH = 24;
export const FRAMES = ['idle', 'walk1', 'walk2', 'walk3', 'walk4', 'work1', 'work2', 'eat', 'sit', 'idle2', 'blink', 'chop1', 'chop2', 'crouch1', 'crouch2', 'fish', 'talk', 'sit2'] as const;
export type FrameName = (typeof FRAMES)[number];
const DIRS: Dir[] = ['down', 'up', 'left'];

// several variants per garment so a group in the same kind of jacket still reads apart
const OUTER_COLORS: Record<string, string[]> = {
  hoodie: ['#5e6068', '#3e4a5e', '#6a4a5a', '#4a5a4a', '#2e2e34'],
  rain_jacket: ['#a8402a', '#2e5a7a', '#c89a2a', '#3e6a4a', '#6a3a6a'],
  winter_jacket: ['#2e3e5e', '#1e1e24', '#6a2e2e', '#3e4e3a'],
  wool_sweater: ['#7a5a3a', '#a89a7a', '#4a3a5a', '#5e2e2e'],
};
const BEANIE_COLORS = ['#8a3a2a', '#2e3e5e', '#4a5a3a', '#6a6a6a', '#c8a03a'];
const LEG_COLORS: Record<string, string> = { jeans: '#3a4a6a', hiking_pants: '#4a4a3e' };
const SHOE_COLORS: Record<string, string> = { sneakers: '#e2ded4', hiking_boots: '#5a3e26' };

interface Look {
  skin: string;
  hair: string;
  eyes: string;
  style: string;
  torso: string;
  sleeves: string;
  legs: string;
  shoes: string;
  pack?: string;
  beanie?: string;
  glasses: boolean;
  goatee: boolean;
  build: string;
  height: string;
  hood: boolean;
  gloves: boolean;
  /** garment ids that change the drawn details */
  outer?: string;
  legsType?: string;
  feetType?: string;
}

function lookOf(c: Character): Look {
  const a = c.appearance;
  const eq = c.equipment;
  const outer = eq.outer?.id;
  const h = hashString(c.id);
  const variants = outer ? OUTER_COLORS[outer] : undefined;
  const torso = variants ? variants[h % variants.length] : a.shirtColor;
  return {
    skin: a.skin,
    hair: a.hairColor,
    eyes: a.eyeColor,
    style: a.hairStyle,
    torso,
    sleeves: outer ? torso : a.skin,
    legs: eq.legs ? (LEG_COLORS[eq.legs.id] ?? a.pantsColor) : a.pantsColor,
    shoes: eq.feet ? (SHOE_COLORS[eq.feet.id] ?? a.shoeColor) : '#8a7060',
    pack: eq.back ? (eq.back.id === 'hiking_backpack' ? '#3e5a3a' : '#2e3a5a') : undefined,
    beanie: eq.head?.id === 'beanie' ? BEANIE_COLORS[(h >>> 3) % BEANIE_COLORS.length] : undefined,
    glasses: a.glasses,
    goatee: a.facialHair === 'goatee',
    build: a.build,
    height: a.height,
    hood: outer === 'hoodie',
    gloves: !!eq.hands,
    outer,
    legsType: eq.legs?.id,
    feetType: eq.feet?.id,
  };
}

export function lookSignature(c: Character): string {
  const e = c.equipment;
  return [c.id, e.outer?.id, e.head?.id, e.back?.id, e.legs?.id, e.feet?.id, e.hands?.id].join('|');
}

const STEEL = '#9aa0a6';
const STEEL_L = '#d0d4d8';
const HANDLE = '#6a4a2c';
const EYE_DARK = '#1c1612';
const WHITE = '#ece8de';

function drawFrame(p: PixelPainter, L: Look, dir: Dir, frame: FrameName, ox: number): void {
  const hOff = L.height === 'tall' ? -1 : L.height === 'short' ? 1 : 0;
  const sit = frame === 'sit' || frame === 'sit2';
  const crouch = frame === 'crouch1' || frame === 'crouch2';
  const bob = frame === 'walk2' || frame === 'walk4' || frame === 'idle2' || frame === 'sit2' ? 1 : 0;
  const headTop = 3 + hOff + bob + (sit ? 4 : crouch ? 3 : 0);
  const torsoTop = headTop + 8;
  const legTop = torsoTop + 6;
  const skinS = shade(L.skin, -0.18);
  const skinL = shade(L.skin, 0.1);
  const hairD = shade(L.hair, -0.3);
  const hairL = shade(L.hair, 0.22);
  const P = (x: number, y: number, c: string) => p.px(ox + x, y, c);
  const R = (x: number, y: number, w: number, h: number, c: string) => p.rect(ox + x, y, w, h, c);
  const V = (x: number, y0: number, y1: number, c: string) => p.vline(ox + x, y0, y1, c);
  const Ln = (x0: number, y0: number, x1: number, y1: number, c: string) => p.line(ox + x0, y0, ox + x1, y1, c);

  // shadow
  p.ellipse(ox + 8, 22.5, 5, 1.5, 'rgba(0,0,0,0.3)');

  // --- legs ------------------------------------------------------------
  const wide = L.build === 'muscular' ? 1 : 0;
  const legD = shade(L.legs, -0.15);
  const soleC = L.feetType === 'sneakers' ? '#f4f2ec' : shade(L.shoes, -0.35);
  if (sit) {
    R(5 - wide, legTop, 3, 3, L.legs);
    R(8, legTop, 3 + wide, 3, legD);
    R(5 - wide, legTop + 3, 3, 1, L.shoes);
    R(8, legTop + 3, 3 + wide, 1, L.shoes);
  } else if (crouch) {
    // kneeling: one knee down, one foot planted
    if (dir === 'left') {
      R(5, legTop, 5, 2, L.legs);
      R(4, 22, 3, 2, L.shoes);
      R(9, 22, 3, 1, legD);
      P(4, 23, soleC);
    } else {
      R(5 - wide, legTop, 3, 22 - legTop, L.legs);
      R(8, legTop, 3 + wide, 22 - legTop, legD);
      R(5 - wide, 22, 3, 2, L.shoes);
      R(8, 22, 3 + wide, 2, shade(L.shoes, -0.1));
    }
  } else if (dir === 'left') {
    const s = frame === 'walk1' ? 2 : frame === 'walk3' ? -2 : 0;
    const legH = 22 - legTop;
    R(6 + s, legTop, 3, legH, legD);
    R(7 - s, legTop, 3, legH, L.legs);
    if (L.legsType === 'jeans') V(7 - s, legTop + 1, 21, shade(L.legs, 0.12));
    R(5 + s, 22, 4, 2, shade(L.shoes, -0.1));
    R(6 - s, 22, 4, 2, L.shoes);
    R(5 + s, 23, 4, 1, soleC);
    R(6 - s, 23, 4, 1, soleC);
  } else {
    const liftL = frame === 'walk1' ? 1 : 0;
    const liftR = frame === 'walk3' ? 1 : 0;
    const legH = 22 - legTop;
    R(5 - wide, legTop, 3, legH - liftL, L.legs);
    R(8, legTop, 3 + wide, legH - liftR, dir === 'up' ? L.legs : legD);
    P(7, legTop, shade(L.legs, -0.3));
    // seams and knees
    if (L.legsType === 'jeans') {
      V(6 - wide, legTop + 1, 20 - liftL, shade(L.legs, 0.12));
      V(9, legTop + 1, 20 - liftR, shade(L.legs, 0.06));
    }
    P(6 - wide, legTop + 3, shade(L.legs, -0.12));
    R(5 - wide, 22 - liftL, 3, 2, L.shoes);
    R(8, 22 - liftR, 3 + wide, 2, shade(L.shoes, -0.1));
    R(5 - wide, 23 - liftL, 3, 1, soleC);
    R(8, 23 - liftR, 3 + wide, 1, soleC);
    if (dir === 'down' && L.feetType === 'sneakers') {
      P(6 - wide, 22 - liftL, WHITE);
      P(9, 22 - liftR, WHITE);
    }
  }

  // --- torso -----------------------------------------------------------
  const tw = L.build === 'muscular' ? 10 : L.build === 'slim' ? 6 : 8;
  const tx = 8 - tw / 2;
  const sideW = dir === 'left' ? 6 : tw;
  const sx = dir === 'left' ? 5 : tx;
  const tD = shade(L.torso, -0.25);
  R(sx, torsoTop, sideW, 6, L.torso);
  R(sx, torsoTop, 1, 6, shade(L.torso, 0.12));
  R(sx + sideW - 1, torsoTop, 1, 6, tD);
  // hem and belt line
  R(sx, torsoTop + 5, sideW, 1, shade(L.torso, -0.15));
  if (!sit) R(dir === 'left' ? 6 : 5 - wide, legTop, dir === 'left' ? 4 : 6 + wide * 2, 1, shade(L.legs, -0.4));
  if (dir === 'down' && !sit && L.legsType === 'jeans') P(7, legTop, '#c8b070');
  if (dir === 'down') {
    if (L.outer === 'hoodie') {
      R(tx + 2, torsoTop, tw - 4, 1, tD);
      P(7, torsoTop + 1, WHITE);
      P(8, torsoTop + 1, WHITE);
      P(7, torsoTop + 2, shade(WHITE, -0.2));
      R(tx + 2, torsoTop + 3, tw - 4, 1, shade(L.torso, -0.18)); // pouch pocket
    } else if (L.outer === 'rain_jacket' || L.outer === 'winter_jacket') {
      V(8, torsoTop, torsoTop + 5, shade(L.torso, -0.35));
      P(8, torsoTop + 1, STEEL_L);
      P(tx + 1, torsoTop, shade(L.torso, 0.25));
      P(tx + tw - 2, torsoTop, shade(L.torso, 0.25));
      if (L.outer === 'winter_jacket') R(tx, torsoTop + 2, tw, 1, shade(L.torso, -0.12)); // quilting
    } else if (L.outer === 'wool_sweater') {
      for (let y = 1; y < 5; y++) for (let x = tx + (y % 2); x < tx + tw; x += 2) P(x, torsoTop + y, shade(L.torso, -0.1));
      R(tx + 2, torsoTop, tw - 4, 1, shade(L.torso, 0.15));
    } else {
      // t-shirt neckline
      P(7, torsoTop, skinS);
      P(8, torsoTop, skinS);
      P(6, torsoTop, shade(L.torso, -0.3));
      P(9, torsoTop, shade(L.torso, -0.3));
    }
  } else if (dir === 'up' && L.hood) {
    R(5, torsoTop, 6, 2, shade(L.torso, -0.12));
    R(5, torsoTop + 2, 6, 1, tD);
  } else if (dir === 'left' && L.hood) {
    R(9, torsoTop - 1, 2, 2, shade(L.torso, -0.1));
  }
  // backpack
  if (L.pack) {
    if (dir === 'up') {
      R(5, torsoTop, 6, 6, L.pack);
      R(5, torsoTop, 6, 1, shade(L.pack, 0.2));
      R(6, torsoTop + 3, 4, 1, shade(L.pack, -0.3));
      P(7, torsoTop + 3, STEEL_L);
    } else if (dir === 'down') {
      V(tx + 1, torsoTop, torsoTop + 4, shade(L.pack, -0.15));
      V(tx + tw - 2, torsoTop, torsoTop + 4, shade(L.pack, -0.25));
    } else {
      R(10, torsoTop, 3, 5, L.pack);
      P(12, torsoTop, shade(L.pack, 0.2));
      V(12, torsoTop + 1, torsoTop + 4, shade(L.pack, -0.25));
      V(7, torsoTop, torsoTop + 3, shade(L.pack, -0.15));
    }
  }

  // --- arms -------------------------------------------------------------
  const armC = L.sleeves;
  const armD = shade(armC, -0.2);
  const hand = L.gloves ? '#6a4a2c' : L.skin;
  const al = tx - 1;
  const ar = tx + tw;
  const ht = headTop;
  if (dir === 'left') {
    if (frame === 'eat') {
      R(5, torsoTop + 1, 2, 2, armC);
      P(5, ht + 6, hand);
    } else if (frame === 'work1') {
      R(5, torsoTop - 3, 2, 4, armC);
      P(4, torsoTop - 4, hand);
      R(2, torsoTop - 7, 2, 4, STEEL);
      V(4, torsoTop - 6, torsoTop - 3, HANDLE);
    } else if (frame === 'work2') {
      R(3, torsoTop + 2, 3, 2, armC);
      P(2, torsoTop + 3, hand);
      R(0, torsoTop + 4, 2, 2, STEEL);
    } else if (frame === 'chop1') {
      // tool raised back over the shoulder
      R(8, ht + 1, 2, torsoTop - ht + 1, armC);
      P(9, ht, hand);
      Ln(9, ht, 12, Math.max(0, ht - 3), HANDLE);
      R(12, Math.max(0, ht - 4), 3, 2, STEEL);
      P(14, Math.max(0, ht - 4), STEEL_L);
    } else if (frame === 'chop2') {
      // swung down in front
      R(3, torsoTop + 1, 3, 2, armC);
      P(2, torsoTop + 2, hand);
      Ln(2, torsoTop + 2, 0, torsoTop + 5, HANDLE);
      R(0, torsoTop + 5, 2, 3, STEEL);
    } else if (crouch) {
      const down = frame === 'crouch2' ? 1 : 0;
      R(4, torsoTop + 1, 2, 3 + down, armC);
      P(3, torsoTop + 4 + down, hand);
    } else if (frame === 'fish') {
      R(4, torsoTop + 1, 3, 2, armC);
      P(3, torsoTop + 2, hand);
      Ln(3, torsoTop + 2, 0, Math.max(0, torsoTop - 7), '#8a6a42');
    } else if (frame === 'talk') {
      R(4, torsoTop + 1, 3, 1, armC);
      P(3, torsoTop, hand);
    } else {
      const sw = frame === 'walk1' ? -1 : frame === 'walk3' ? 1 : 0;
      R(8 + sw, torsoTop + 1, 2, 4, armD);
      P(8 + sw, torsoTop + 5, hand);
    }
  } else {
    const swL = frame === 'walk1' ? 1 : frame === 'walk3' ? -1 : 0;
    const down = dir === 'down';
    if (frame === 'chop1' || (frame === 'work1' && down)) {
      // both hands up over the head, tool above
      R(al, ht + 1, 1, torsoTop - ht, armC);
      R(ar, ht + 1, 1, torsoTop - ht, armD);
      P(al, ht, hand);
      P(ar, ht, hand);
      if (frame === 'chop1') {
        V(7, 0, ht - 1, HANDLE);
        V(8, 0, ht - 1, shade(HANDLE, -0.2));
        R(5, 0, 6, 2, STEEL);
        R(5, 0, 6, 1, STEEL_L);
      } else R(al, ht - 2, ar - al + 1, 2, STEEL);
    } else if (frame === 'chop2' || (frame === 'work2' && down)) {
      R(al, torsoTop + 1, 1, 4, armC);
      R(ar, torsoTop + 1, 1, 4, armD);
      R(al + 1, torsoTop + 5, ar - al - 1, 1, hand);
      if (down) {
        V(7, torsoTop + 5, torsoTop + 7, HANDLE);
        R(6, torsoTop + 7, 4, 2, STEEL);
      }
    } else if (frame === 'eat' && down) {
      R(al, torsoTop, 1, 5, armC);
      R(ar, torsoTop, 1, 2, armD);
      P(ar - 1, ht + 6, hand);
    } else if (crouch) {
      const d2 = frame === 'crouch2' ? 1 : 0;
      R(al, torsoTop + 1, 1, 5 + d2, armC);
      R(ar, torsoTop + 1, 1, 6 - d2, armD);
      P(al, torsoTop + 6 + d2, hand);
      P(ar, torsoTop + 7 - d2, hand);
    } else if (frame === 'fish') {
      R(al, torsoTop + 1, 1, 3, armC);
      R(ar, torsoTop + 1, 1, 3, armD);
      P(al + 1, torsoTop + 4, hand);
      P(ar - 1, torsoTop + 4, hand);
      if (down) Ln(ar - 1, torsoTop + 4, 15, torsoTop + 10, '#8a6a42');
      else Ln(ar - 1, torsoTop + 3, 14, Math.max(0, ht - 3), '#8a6a42');
    } else if (frame === 'talk' && down) {
      R(al, torsoTop, 1, 5, armC);
      R(ar, torsoTop - 2, 1, 4, armD);
      P(al, torsoTop + 5, hand);
      P(ar, torsoTop - 3, hand);
    } else {
      R(al, torsoTop + swL, 1, 5, armC);
      R(ar, torsoTop - swL, 1, 5, armD);
      if (armC !== L.skin) {
        // cuffs
        P(al, torsoTop + 4 + swL, shade(armC, -0.3));
        P(ar, torsoTop + 4 - swL, shade(armC, -0.4));
        P(al, torsoTop + 5 + swL, hand);
        P(ar, torsoTop + 5 - swL, hand);
      } else {
        P(al, torsoTop + swL, L.torso);
        P(ar, torsoTop - swL, L.torso);
        P(al, torsoTop + 5 + swL, hand);
        P(ar, torsoTop + 5 - swL, hand);
      }
    }
  }

  // --- head --------------------------------------------------------------
  const blink = frame === 'blink';
  if (dir === 'left') {
    R(5, ht, 7, 8, L.skin);
    R(5, ht, 1, 1, skinL);
    R(4, ht + 3, 1, 2, L.skin); // nose
    P(4, ht + 4, skinS);
    R(11, ht + 1, 1, 6, skinS);
    P(5, ht + 7, skinS);
    P(9, ht + 4, skinS); // ear
    P(9, ht + 5, shade(L.skin, -0.28));
    if (blink) P(6, ht + 5, EYE_DARK);
    else {
      P(6, ht + 4, EYE_DARK);
      P(6, ht + 5, L.eyes);
    }
    P(6, ht + 3, hairD);
    P(5, ht + 6, shade(L.skin, -0.3)); // mouth
    if (L.glasses) {
      P(5, ht + 4, '#2a2a2a');
      P(7, ht + 4, '#2a2a2a');
      p.hline(ox + 7, ox + 9, ht + 3, '#2a2a2a');
    }
    if (L.goatee) {
      P(5, ht + 7, L.hair);
      P(6, ht + 7, hairD);
    }
  } else {
    R(4, ht, 8, 8, L.skin);
    R(4, ht, 1, 7, skinL);
    R(11, ht + 1, 1, 7, skinS);
    P(4, ht + 7, skinS);
    P(3, ht + 4, skinS); // ears
    P(12, ht + 4, shade(L.skin, -0.28));
    if (dir === 'down') {
      if (blink) {
        P(6, ht + 5, EYE_DARK);
        P(9, ht + 5, EYE_DARK);
      } else {
        P(6, ht + 4, EYE_DARK);
        P(9, ht + 4, EYE_DARK);
        P(6, ht + 5, L.eyes);
        P(9, ht + 5, L.eyes);
      }
      P(6, ht + 3, hairD);
      P(9, ht + 3, hairD);
      P(5, ht + 6, mixBlush(L.skin));
      P(10, ht + 6, mixBlush(L.skin));
      P(7, ht + 6, shade(L.skin, -0.3)); // mouth
      P(8, ht + 6, shade(L.skin, -0.22));
      if (L.glasses) {
        P(5, ht + 4, '#2a2a2a');
        P(7, ht + 4, '#2a2a2a');
        P(8, ht + 4, '#2a2a2a');
        P(10, ht + 4, '#2a2a2a');
        p.hline(ox + 5, ox + 10, ht + 3, '#3a3a3a');
      }
      if (L.goatee) {
        P(7, ht + 7, L.hair);
        P(8, ht + 7, L.hair);
        P(7, ht + 6, hairD);
      }
    }
  }

  // --- hair -----------------------------------------------------------
  const H = L.hair;
  const style = L.style;
  const longStyles = ['long', 'bob', 'curly', 'braid', 'ponytail', 'bun'];
  if (dir === 'up') {
    R(4, ht - 1, 8, 9, H);
    R(4, ht - 1, 8, 1, hairL);
    R(11, ht, 1, 8, hairD);
    // strands
    V(6, ht + 1, ht + 5, hairD);
    V(9, ht, ht + 4, shade(H, -0.15));
    P(5, ht, hairL);
    if (style === 'fluffy' || style === 'curly') {
      R(3, ht, 10, 6, H);
      P(5, ht - 2, H);
      P(9, ht - 2, H);
      P(4, ht + 1, hairL);
      P(10, ht + 2, hairD);
    }
    if (style === 'long' || style === 'curly') {
      R(4, ht + 7, 8, 5, H);
      V(7, ht + 7, ht + 11, hairD);
    }
    if (style === 'bob') R(3, ht + 4, 10, 4, H);
    if (style === 'ponytail') {
      R(7, ht + 7, 2, 6, hairD);
      P(7, ht + 7, '#3a2a2a');
    }
    if (style === 'braid') for (let i = 0; i < 6; i++) P(7 + (i % 2), ht + 8 + i, i % 2 ? hairD : H);
    if (style === 'bun') {
      R(6, ht - 3, 4, 3, hairD);
      P(7, ht - 3, H);
    }
    if (style === 'buzz') R(4, ht - 1, 8, 6, shade(H, 0.1));
  } else if (dir === 'left') {
    R(5, ht - 1, 7, 3, H);
    R(8, ht + 2, 4, 4, H);
    R(5, ht - 1, 7, 1, hairL);
    P(7, ht, hairL);
    P(10, ht + 3, hairD);
    P(5, ht + 2, H);
    if (style === 'buzz') {
      R(5, ht - 1, 7, 2, H);
      R(9, ht + 1, 3, 2, H);
    }
    if (style === 'fluffy' || style === 'curly') {
      R(4, ht - 2, 8, 3, H);
      P(12, ht + 1, H);
      P(6, ht - 3, H);
      P(9, ht - 3, H);
      P(8, ht - 2, hairL);
    }
    if (style === 'long' || style === 'curly') R(9, ht + 5, 3, 6, H);
    if (style === 'bob') R(8, ht + 5, 4, 2, H);
    if (style === 'ponytail') R(12, ht + 2, 1, 6, hairD);
    if (style === 'braid') for (let i = 0; i < 6; i++) P(11, ht + 6 + i, i % 2 ? hairD : H);
    if (style === 'bun') R(10, ht - 2, 3, 3, hairD);
    if (style === 'middlePart') R(9, ht + 5, 3, 1, H);
    P(9, ht + 4, skinS); // keep the ear visible
  } else {
    // down
    R(4, ht - 1, 8, 3, H);
    R(4, ht - 1, 8, 1, hairL);
    P(4, ht + 2, H);
    P(11, ht + 2, H);
    // strand highlights
    P(6, ht, hairL);
    P(9, ht, shade(H, 0.1));
    P(10, ht + 1, hairD);
    if (style === 'buzz') {
      R(4, ht - 1, 8, 2, shade(H, 0.1));
      P(4, ht + 2, L.skin);
      P(11, ht + 2, skinS);
    }
    if (style === 'short') {
      P(5, ht + 2, H);
      P(8, ht + 2, hairD);
    }
    if (style === 'fluffy') {
      R(3, ht - 2, 10, 4, H);
      P(5, ht - 3, H);
      P(8, ht - 3, H);
      P(10, ht - 3, hairL);
      P(5, ht + 2, H);
      P(7, ht + 2, H);
      P(10, ht + 2, H);
      P(3, ht + 3, H);
      P(12, ht + 3, hairD);
      P(6, ht - 1, hairL);
      P(9, ht - 2, hairL);
    }
    if (style === 'curly') {
      R(3, ht - 2, 10, 4, H);
      for (let i = 0; i < 5; i++) P(3 + i * 2, ht - 2 + (i % 2), hairL);
    }
    if (style === 'middlePart') {
      P(7, ht - 1, L.skin);
      P(8, ht, L.skin);
      R(4, ht + 2, 1, 4, H);
      R(11, ht + 2, 1, 4, hairD);
      P(5, ht + 2, H);
      P(10, ht + 2, H);
    }
    if (longStyles.includes(style)) {
      const len = style === 'bob' ? 7 : style === 'long' || style === 'curly' ? 11 : 5;
      R(3, ht, 1, len, H);
      R(12, ht, 1, len, hairD);
      R(4, ht + 2, 1, 3, H);
      R(11, ht + 2, 1, 3, hairD);
      P(3, ht + 1, hairL);
    }
    if (style === 'braid') for (let i = 0; i < 6; i++) P(12, ht + 5 + i, i % 2 ? hairD : H);
    if (style === 'bun') R(6, ht - 3, 4, 2, hairD);
    if (style === 'ponytail') P(12, ht + 5, hairD);
  }
  if (L.beanie) {
    const bx = dir === 'left' ? 5 : 4;
    const bw = dir === 'left' ? 7 : 8;
    R(bx, ht - 2, bw, 3, L.beanie);
    R(bx, ht, bw, 1, shade(L.beanie, -0.25));
    for (let x = bx + 1; x < bx + bw; x += 2) P(x, ht - 1, shade(L.beanie, -0.1));
    P(bx + Math.floor(bw / 2), ht - 3, shade(L.beanie, 0.2));
  }
}

/** A touch of warmth on the cheeks. */
function mixBlush(skin: string): string {
  const n = parseInt(skin.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 14);
  const g = Math.max(0, ((n >> 8) & 255) - 8);
  const b = Math.max(0, (n & 255) - 6);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function drawSleeping(p: PixelPainter, L: Look, breathe = 0): void {
  // lying on the side, head to the left, covered to the shoulders
  p.ellipse(12, 12, 11, 3, 'rgba(0,0,0,0.3)');
  p.rect(6, 6 - breathe, 16, 6 + breathe, L.torso);
  p.rect(6, 6 - breathe, 16, 1, shade(L.torso, 0.15));
  for (let x = 8; x < 20; x += 3) p.px(x, 8, shade(L.torso, -0.12));
  p.rect(6, 11, 16, 1, shade(L.torso, -0.3));
  p.rect(20, 7, 3, 4, L.legs);
  p.rect(1, 5, 6, 6, L.skin);
  p.rect(1, 4, 6, 3, L.hair);
  p.px(2, 4, shade(L.hair, 0.2));
  p.px(0, 6, L.hair);
  p.px(3, 8, shade(L.skin, -0.35));
  p.px(4, 8, shade(L.skin, -0.35));
  if (['long', 'curly', 'braid', 'bob'].includes(L.style)) p.rect(5, 5, 3, 4, L.hair);
}

/** Dark 1px outline around everything opaque in a region, so figures read on any ground. */
function outline(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number): void {
  const img = g.getImageData(x0, y0, w, h);
  const d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200;
  const add: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 200) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push(y * w + x);
    }
  for (const i of add) {
    d[i * 4] = 26;
    d[i * 4 + 1] = 20;
    d[i * 4 + 2] = 16;
    d[i * 4 + 3] = 215;
  }
  g.putImageData(img, x0, y0);
}

interface Atlas {
  img: HTMLCanvasElement;
  sleep: HTMLCanvasElement;
  sleep2: HTMLCanvasElement;
}
const atlases = new Map<string, Atlas>();

export function characterAtlas(c: Character): Atlas {
  const sig = lookSignature(c);
  let a = atlases.get(sig);
  if (a) return a;
  const L = lookOf(c);
  const { c: img, g } = makeCanvas(CW * FRAMES.length, CH * 3);
  const p = new PixelPainter(g);
  DIRS.forEach((dir, row) => {
    FRAMES.forEach((f, col) => {
      g.save();
      g.translate(0, row * CH);
      drawFrame(p, L, dir, f, col * CW);
      g.restore();
      outline(g, col * CW, row * CH, CW, CH);
    });
  });
  const sl = makeCanvas(24, 14);
  drawSleeping(new PixelPainter(sl.g), L);
  outline(sl.g, 0, 0, 24, 14);
  const sl2 = makeCanvas(24, 14);
  drawSleeping(new PixelPainter(sl2.g), L, 1);
  outline(sl2.g, 0, 0, 24, 14);
  a = { img, sleep: sl.c, sleep2: sl2.c };
  atlases.set(sig, a);
  if (atlases.size > 200) atlases.clear();
  return a;
}

/** Draw one frame of a character. Right-facing frames mirror the left row. */
export function drawCharacterFrame(g: CanvasRenderingContext2D, c: Character, frame: FrameName, x: number, y: number): void {
  const atlas = characterAtlas(c);
  const col = FRAMES.indexOf(frame);
  const row = c.facing === 'up' ? 1 : c.facing === 'down' ? 0 : 2;
  if (c.facing === 'right') {
    g.save();
    g.translate(Math.round(x) + CW, Math.round(y));
    g.scale(-1, 1);
    g.drawImage(atlas.img, col * CW, row * CH, CW, CH, 0, 0, CW, CH);
    g.restore();
  } else g.drawImage(atlas.img, col * CW, row * CH, CW, CH, Math.round(x), Math.round(y), CW, CH);
}

/** Standalone portrait canvas (front facing) for UI. */
export function portrait(c: Character, scale = 4): HTMLCanvasElement {
  const atlas = characterAtlas(c);
  const { c: out, g } = makeCanvas(CW * scale, CH * scale);
  g.drawImage(atlas.img, 0, 0, CW, CH, 0, 0, CW * scale, CH * scale);
  return out;
}
