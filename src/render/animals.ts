import { makeCanvas, PixelPainter, shade } from './pixel';

/** Side-view animal frames (facing left); 2 walk frames + 1 rest frame. */
interface AnimalLook {
  w: number;
  h: number;
  body: string;
  belly: string;
  draw: (p: PixelPainter, f: number, L: AnimalLook) => void;
}

const LOOKS: Record<string, AnimalLook> = {
  deer: {
    w: 22, h: 20, body: '#8a5a34', belly: '#c8a47a',
    draw: (p, f, L) => {
      p.ellipse(11, 18.5, 8, 1.5, 'rgba(0,0,0,0.3)');
      const lg = f === 1 ? 1 : f === 2 ? -1 : 0;
      if (f === 3) {
        p.ellipse(12, 15, 8, 3.5, L.body);
        p.rect(3, 9, 4, 5, L.body);
        p.rect(2, 8, 4, 3, shade(L.body, 0.1));
        p.px(2, 9, '#1a1a1a');
        return;
      }
      for (const [x, o] of [[6, lg], [8, -lg], [15, -lg], [17, lg]] as const) p.rect(x + o, 13, 1, 6, shade(L.body, -0.3));
      p.ellipse(12, 11, 7, 3.5, L.body);
      p.hline(7, 16, 13, L.belly);
      p.rect(18, 9, 2, 2, '#e8e0d0');
      p.rect(5, 4, 2, 6, L.body);
      p.rect(2, 3, 5, 3, shade(L.body, 0.1));
      p.px(2, 4, '#1a1a1a');
      p.px(4, 3, '#1a1a1a');
      p.px(5, 1, shade(L.body, -0.2));
      p.px(6, 2, shade(L.body, -0.2));
    },
  },
  boar: {
    w: 20, h: 14, body: '#3e3228', belly: '#5a4a3a',
    draw: (p, f, L) => {
      p.ellipse(10, 12.5, 8, 1.5, 'rgba(0,0,0,0.3)');
      const lg = f === 1 ? 1 : f === 2 ? -1 : 0;
      if (f !== 3) for (const [x, o] of [[5, lg], [7, -lg], [13, -lg], [15, lg]] as const) p.rect(x + o, 9, 2, 3, '#2a2018');
      p.ellipse(11, 7, 8, 4, L.body);
      for (let i = 0; i < 8; i++) p.px(6 + i * 1.5, 3, shade(L.body, -0.3));
      p.rect(1, 5, 4, 4, shade(L.body, 0.1));
      p.px(0, 7, '#8a6a5a');
      p.px(2, 5, '#1a1a1a');
      p.px(1, 8, '#e8e0d0');
    },
  },
  fox: {
    w: 18, h: 12, body: '#c0602a', belly: '#f0e0d0',
    draw: (p, f, L) => {
      p.ellipse(9, 10.5, 7, 1.2, 'rgba(0,0,0,0.3)');
      const lg = f === 1 ? 1 : f === 2 ? -1 : 0;
      if (f !== 3) for (const [x, o] of [[5, lg], [7, -lg], [11, -lg], [13, lg]] as const) p.rect(x + o, 7, 1, 4, '#3a2218');
      p.ellipse(9, 6, 5, 2.5, L.body);
      p.hline(6, 11, 8, L.belly);
      p.ellipse(15, 5, 3, 1.5, L.body);
      p.px(17, 5, '#f0f0f0');
      p.rect(1, 3, 4, 3, L.body);
      p.px(1, 2, '#3a2218');
      p.px(3, 2, '#3a2218');
      p.px(0, 5, '#1a1a1a');
      p.px(2, 4, '#1a1a1a');
    },
  },
  hare: {
    w: 12, h: 10, body: '#8a7a62', belly: '#c8baa0',
    draw: (p, f, L) => {
      p.ellipse(6, 9, 4, 1, 'rgba(0,0,0,0.3)');
      const hop = f === 1 ? -1 : 0;
      p.ellipse(7, 6 + hop, 4, 2.5, L.body);
      p.rect(2, 4 + hop, 3, 3, L.body);
      p.vline(3, 0 + hop, 3 + hop, shade(L.body, -0.1));
      p.vline(4, 1 + hop, 3 + hop, shade(L.body, -0.2));
      p.px(2, 5 + hop, '#1a1a1a');
      p.px(11, 6 + hop, '#f0f0f0');
      p.hline(5, 9, 8 + hop, L.belly);
    },
  },
};

const cache = new Map<string, HTMLCanvasElement>();

/** frame: 0 idle, 1-2 walk, 3 resting */
export function animalSprite(species: string, frame: number): { img: HTMLCanvasElement; w: number; h: number } | null {
  const L = LOOKS[species];
  if (!L) return null;
  const key = `${species}:${frame}`;
  let c = cache.get(key);
  if (!c) {
    const m = makeCanvas(L.w, L.h);
    L.draw(new PixelPainter(m.g), frame, L);
    c = m.c;
    cache.set(key, c);
  }
  return { img: c, w: L.w, h: L.h };
}
