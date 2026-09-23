import type { Character, Dir } from '@/sim/types';
import { makeCanvas, PixelPainter, shade } from './pixel';

export const CW = 16;
export const CH = 24;
export const FRAMES = ['idle', 'walk1', 'walk2', 'walk3', 'walk4', 'work1', 'work2', 'eat', 'sit'] as const;
export type FrameName = (typeof FRAMES)[number];
const DIRS: Dir[] = ['down', 'up', 'left'];

const OUTER_COLORS: Record<string, string> = {
  hoodie: '#5e6068',
  rain_jacket: '#a8402a',
  winter_jacket: '#2e3e5e',
  wool_sweater: '#7a5a3a',
};
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
}

function lookOf(c: Character): Look {
  const a = c.appearance;
  const eq = c.equipment;
  const outer = eq.outer?.id;
  const torso = outer ? OUTER_COLORS[outer] ?? a.shirtColor : a.shirtColor;
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
    beanie: eq.head?.id === 'beanie' ? '#8a3a2a' : undefined,
    glasses: a.glasses,
    goatee: a.facialHair === 'goatee',
    build: a.build,
    height: a.height,
    hood: outer === 'hoodie',
    gloves: !!eq.hands,
  };
}

export function lookSignature(c: Character): string {
  const e = c.equipment;
  return [c.id, e.outer?.id, e.head?.id, e.back?.id, e.legs?.id, e.feet?.id, e.hands?.id].join('|');
}

function drawFrame(p: PixelPainter, L: Look, dir: Dir, frame: FrameName, ox: number): void {
  const hOff = L.height === 'tall' ? -1 : L.height === 'short' ? 1 : 0;
  const sit = frame === 'sit';
  const bob = frame === 'walk2' || frame === 'walk4' ? 1 : 0;
  const headTop = 3 + hOff + bob + (sit ? 4 : 0);
  const torsoTop = headTop + 8;
  const legTop = torsoTop + 6;
  const skinS = shade(L.skin, -0.18);
  const hairD = shade(L.hair, -0.3);
  const hairL = shade(L.hair, 0.18);
  const P = (x: number, y: number, c: string) => p.px(ox + x, y, c);
  const R = (x: number, y: number, w: number, h: number, c: string) => p.rect(ox + x, y, w, h, c);

  // shadow
  p.ellipse(ox + 8, 22.5, 5, 1.5, 'rgba(0,0,0,0.3)');

  // --- legs ------------------------------------------------------------
  const wide = L.build === 'muscular' ? 1 : 0;
  if (sit) {
    R(5 - wide, legTop, 3, 3, L.legs);
    R(8, legTop, 3 + wide, 3, L.legs);
    R(5 - wide, legTop + 3, 3, 1, L.shoes);
    R(8, legTop + 3, 3 + wide, 1, L.shoes);
  } else if (dir === 'left') {
    const s = frame === 'walk1' ? 2 : frame === 'walk3' ? -2 : 0;
    const legH = 22 - legTop;
    R(6 + s, legTop, 3, legH, shade(L.legs, -0.15));
    R(7 - s, legTop, 3, legH, L.legs);
    R(5 + s, 22, 4, 2, shade(L.shoes, -0.1));
    R(6 - s, 22, 4, 2, L.shoes);
  } else {
    const liftL = frame === 'walk1' ? 1 : 0;
    const liftR = frame === 'walk3' ? 1 : 0;
    const legH = 22 - legTop;
    R(5 - wide, legTop, 3, legH - liftL, L.legs);
    R(8, legTop, 3 + wide, legH - liftR, dir === 'up' ? L.legs : shade(L.legs, -0.12));
    P(7, legTop, shade(L.legs, -0.3));
    R(5 - wide, 22 - liftL, 3, 2, L.shoes);
    R(8, 22 - liftR, 3 + wide, 2, shade(L.shoes, -0.1));
  }

  // --- torso -----------------------------------------------------------
  const tw = L.build === 'muscular' ? 10 : L.build === 'slim' ? 6 : 8;
  const tx = 8 - tw / 2;
  const sideW = dir === 'left' ? 6 : tw;
  const sx = dir === 'left' ? 5 : tx;
  R(sx, torsoTop, sideW, 6, L.torso);
  R(sx, torsoTop, 1, 6, shade(L.torso, 0.12));
  R(sx + sideW - 1, torsoTop, 1, 6, shade(L.torso, -0.25));
  P(sx, torsoTop + 5, shade(L.torso, -0.2));
  if (dir === 'down') {
    if (L.hood) R(tx + 2, torsoTop, tw - 4, 1, shade(L.torso, -0.25));
    else P(7, torsoTop, skinS);
  }
  // backpack
  if (L.pack) {
    if (dir === 'up') {
      R(5, torsoTop, 6, 6, L.pack);
      R(5, torsoTop, 6, 1, shade(L.pack, 0.2));
      R(6, torsoTop + 3, 4, 1, shade(L.pack, -0.3));
    } else if (dir === 'down') {
      P(tx + 1, torsoTop + 1, shade(L.pack, -0.2));
      P(tx + tw - 2, torsoTop + 1, shade(L.pack, -0.2));
      P(tx + 1, torsoTop + 2, shade(L.pack, -0.2));
      P(tx + tw - 2, torsoTop + 2, shade(L.pack, -0.2));
    } else {
      R(10, torsoTop, 3, 5, L.pack);
      P(12, torsoTop, shade(L.pack, 0.2));
    }
  }

  // --- arms -------------------------------------------------------------
  const armC = L.sleeves;
  const hand = L.gloves ? '#6a4a2c' : L.skin;
  const working = frame === 'work1' || frame === 'work2' || frame === 'eat';
  if (dir === 'left') {
    if (working) {
      const up = frame === 'work1';
      if (frame === 'eat') {
        R(5, torsoTop + 1, 2, 2, armC);
        P(5, headTop + 6, hand);
      } else if (up) {
        R(5, torsoTop - 3, 2, 4, armC);
        P(4, torsoTop - 4, hand);
        R(2, torsoTop - 7, 2, 4, '#8a8a8a');
        p.vline(ox + 4, torsoTop - 6, torsoTop - 3, '#6a4a2c');
      } else {
        R(3, torsoTop + 2, 3, 2, armC);
        P(2, torsoTop + 3, hand);
        R(0, torsoTop + 4, 2, 2, '#8a8a8a');
      }
    } else {
      const sw = frame === 'walk1' ? -1 : frame === 'walk3' ? 1 : 0;
      R(8 + sw, torsoTop + 1, 2, 4, shade(armC, -0.1));
      P(8 + sw, torsoTop + 5, hand);
    }
  } else {
    const al = tx - 1;
    const ar = tx + tw;
    const swL = frame === 'walk1' ? 1 : frame === 'walk3' ? -1 : 0;
    if (working && dir === 'down') {
      if (frame === 'eat') {
        R(al, torsoTop, 1, 5, armC);
        R(ar, torsoTop, 1, 2, armC);
        P(ar - 1, headTop + 6, hand);
      } else if (frame === 'work1') {
        R(al, torsoTop - 3, 1, 4, armC);
        R(ar, torsoTop - 3, 1, 4, armC);
        P(al, torsoTop - 4, hand);
        P(ar, torsoTop - 4, hand);
        R(al, torsoTop - 7, ar - al + 1, 2, '#8a8a8a');
      } else {
        R(al, torsoTop + 1, 1, 4, armC);
        R(ar, torsoTop + 1, 1, 4, armC);
        R(al + 1, torsoTop + 5, ar - al - 1, 1, hand);
        R(6, torsoTop + 6, 4, 1, '#8a8a8a');
      }
    } else {
      R(al, torsoTop + swL, 1, 5, armC);
      R(ar, torsoTop - swL, 1, 5, shade(armC, -0.2));
      if (armC !== L.skin) {
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
  const ht = headTop;
  if (dir === 'left') {
    R(5, ht, 7, 8, L.skin);
    P(5, ht, 'transparent');
    R(4, ht + 3, 1, 2, L.skin); // nose
    R(11, ht + 1, 1, 6, skinS);
    P(5, ht + 7, skinS);
    P(6, ht + 4, L.eyes);
    P(6, ht + 3, hairD);
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
    R(11, ht + 1, 1, 7, skinS);
    P(4, ht + 7, skinS);
    if (dir === 'down') {
      P(6, ht + 4, L.eyes);
      P(9, ht + 4, L.eyes);
      P(6, ht + 3, hairD);
      P(9, ht + 3, hairD);
      P(7, ht + 6, skinS);
      P(8, ht + 6, skinS);
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
    if (style === 'fluffy' || style === 'curly') {
      R(3, ht, 10, 6, H);
      P(5, ht - 2, H);
      P(9, ht - 2, H);
    }
    if (style === 'long' || style === 'curly') R(4, ht + 7, 8, 5, H);
    if (style === 'bob') R(3, ht + 4, 10, 4, H);
    if (style === 'ponytail') R(7, ht + 7, 2, 6, hairD);
    if (style === 'braid') for (let i = 0; i < 6; i++) P(7 + (i % 2), ht + 8 + i, i % 2 ? hairD : H);
    if (style === 'bun') R(6, ht - 3, 4, 3, hairD);
    if (style === 'buzz') R(4, ht - 1, 8, 6, shade(H, 0.1));
  } else if (dir === 'left') {
    R(5, ht - 1, 7, 3, H);
    R(8, ht + 2, 4, 4, H);
    R(5, ht - 1, 7, 1, hairL);
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
    }
    if (style === 'long' || style === 'curly') R(9, ht + 5, 3, 6, H);
    if (style === 'bob') R(8, ht + 5, 4, 2, H);
    if (style === 'ponytail') R(12, ht + 2, 1, 6, hairD);
    if (style === 'braid') for (let i = 0; i < 6; i++) P(11, ht + 6 + i, i % 2 ? hairD : H);
    if (style === 'bun') R(10, ht - 2, 3, 3, hairD);
    if (style === 'middlePart') R(9, ht + 5, 3, 1, H);
  } else {
    // down
    R(4, ht - 1, 8, 3, H);
    R(4, ht - 1, 8, 1, hairL);
    P(4, ht + 2, H);
    P(11, ht + 2, H);
    if (style === 'buzz') {
      R(4, ht - 1, 8, 2, shade(H, 0.1));
      P(4, ht + 2, L.skin);
      P(11, ht + 2, skinS);
    }
    if (style === 'short') P(5, ht + 2, H);
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
      R(3, ht, 1, style === 'bob' ? 7 : style === 'long' || style === 'curly' ? 11 : 5, H);
      R(12, ht, 1, style === 'bob' ? 7 : style === 'long' || style === 'curly' ? 11 : 5, hairD);
      R(4, ht + 2, 1, 3, H);
      R(11, ht + 2, 1, 3, hairD);
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
    P(bx + Math.floor(bw / 2), ht - 3, shade(L.beanie, 0.2));
  }
}

function drawSleeping(p: PixelPainter, L: Look): void {
  // lying on the side, head to the left, covered to the shoulders
  p.ellipse(12, 12, 11, 3, 'rgba(0,0,0,0.3)');
  p.rect(6, 6, 16, 6, L.torso);
  p.rect(6, 6, 16, 1, shade(L.torso, 0.15));
  p.rect(6, 11, 16, 1, shade(L.torso, -0.3));
  p.rect(20, 7, 3, 4, L.legs);
  p.rect(1, 5, 6, 6, L.skin);
  p.rect(1, 4, 6, 3, L.hair);
  p.px(0, 6, L.hair);
  p.px(3, 8, shade(L.skin, -0.35));
  if (['long', 'curly', 'braid', 'bob'].includes(L.style)) p.rect(5, 5, 3, 4, L.hair);
}

interface Atlas {
  img: HTMLCanvasElement;
  sleep: HTMLCanvasElement;
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
    });
  });
  const sl = makeCanvas(24, 14);
  drawSleeping(new PixelPainter(sl.g), L);
  a = { img, sleep: sl.c };
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
