import { itemDef } from '@/content/items';
import { makeCanvas, PixelPainter, shade } from './pixel';

type Draw = (p: PixelPainter) => void;

const WOOD = '#8a5e36';
const STEEL = '#a8acb0';

const tool = (head: string, handle = WOOD): Draw => (p) => {
  p.line(3, 13, 11, 5, handle);
  p.line(4, 13, 12, 5, shade(handle, -0.3));
  p.rect(9, 2, 5, 4, head);
  p.hline(9, 13, 2, shade(head, 0.3));
};
const bottle = (body: string, cap: string): Draw => (p) => {
  p.rect(6, 1, 4, 2, cap);
  p.rect(5, 3, 6, 11, body);
  p.rect(5, 3, 1, 11, shade(body, 0.3));
  p.rect(10, 3, 1, 11, shade(body, -0.3));
  p.hline(5, 10, 14, shade(body, -0.4));
};
const blob = (c: string, n = 5): Draw => (p) => {
  const pos = [[5, 6], [9, 5], [7, 9], [11, 9], [4, 10], [8, 12], [11, 12]];
  for (let i = 0; i < n; i++) {
    const [x, y] = pos[i % pos.length];
    p.ellipse(x, y, 2, 2, c);
    p.px(x - 1, y - 1, shade(c, 0.4));
  }
};
const garment = (c: string, sleeves = true): Draw => (p) => {
  p.rect(4, 3, 8, 11, c);
  if (sleeves) {
    p.rect(1, 3, 3, 6, shade(c, -0.1));
    p.rect(12, 3, 3, 6, shade(c, -0.1));
  }
  p.rect(6, 3, 4, 1, shade(c, -0.4));
  p.vline(4, 3, 13, shade(c, 0.2));
};
const pants = (c: string): Draw => (p) => {
  p.rect(4, 2, 8, 3, c);
  p.rect(4, 5, 3, 9, c);
  p.rect(9, 5, 3, 9, shade(c, -0.15));
  p.hline(4, 11, 2, shade(c, -0.4));
};
const shoe = (c: string): Draw => (p) => {
  p.rect(3, 8, 5, 5, c);
  p.rect(3, 11, 10, 3, c);
  p.hline(3, 12, 13, shade(c, -0.5));
  p.px(4, 9, shade(c, 0.3));
};
const pack = (c: string, big = false): Draw => (p) => {
  p.rect(big ? 3 : 4, 2, big ? 10 : 8, big ? 12 : 11, c);
  p.rect(5, 8, 6, 4, shade(c, -0.2));
  p.hline(4, 11, 2, shade(c, 0.3));
};
const meat = (c: string, cooked = false): Draw => (p) => {
  p.ellipse(8, 8, 6, 4, c);
  p.ellipse(7, 7, 3, 2, shade(c, 0.25));
  if (cooked) for (let i = 0; i < 3; i++) p.line(4 + i * 3, 10, 6 + i * 3, 6, shade(c, -0.4));
  p.rect(12, 9, 3, 2, '#e8e0d0');
};
const fish = (c: string): Draw => (p) => {
  p.ellipse(7, 8, 5, 3, c);
  p.line(12, 8, 14, 5, c);
  p.line(12, 8, 14, 11, c);
  p.px(4, 7, '#1a1a1a');
  p.hline(4, 10, 10, shade(c, 0.35));
};
const can = (label: string): Draw => (p) => {
  p.rect(4, 3, 8, 11, '#a8acb0');
  p.rect(4, 5, 8, 6, label);
  p.hline(4, 11, 3, '#d8dce0');
  p.hline(4, 11, 13, '#6a6e72');
};

const ICONS: Record<string, Draw> = {
  log: (p) => { p.rect(2, 6, 12, 5, '#6a4a2c'); p.ellipse(13, 8.5, 1.5, 2.5, '#b08a5a'); p.hline(2, 12, 6, '#8a6440'); },
  firewood: (p) => { for (let i = 0; i < 3; i++) { p.rect(2, 4 + i * 3, 12, 3, i % 2 ? '#7a5634' : '#6a4a2c'); p.px(13, 5 + i * 3, '#c8a070'); } },
  branch: (p) => { p.line(2, 13, 13, 3, WOOD); p.line(7, 8, 11, 10, WOOD); p.line(5, 11, 3, 6, WOOD); },
  stone: (p) => { p.ellipse(8, 9, 5, 4, '#8a8a82'); p.ellipse(7, 8, 2, 1.5, '#aaa9a0'); },
  fiber: (p) => { for (let i = 0; i < 5; i++) p.line(3 + i * 2, 14, 6 + i, 2, i % 2 ? '#7a9a4a' : '#5a7a34'); },
  cordage: (p) => { p.ellipse(8, 8, 5, 5, '#b0985a'); p.ellipse(8, 8, 2, 2, '#00000000'); p.ellipse(8, 8, 2.5, 2.5, '#6a5a36'); },
  rope: (p) => { p.ellipse(8, 8, 6, 5, '#d0c090'); p.ellipse(8, 8, 3, 2.5, '#8a7a50'); p.line(12, 11, 15, 14, '#d0c090'); },
  tarp: (p) => { p.rect(2, 3, 12, 10, '#3e6a3a'); p.line(2, 3, 14, 13, '#2e5a2a'); p.px(2, 3, '#c8c0a0'); p.px(13, 12, '#c8c0a0'); },
  cloth: (p) => { p.rect(3, 4, 10, 8, '#b8a888'); p.line(3, 8, 12, 8, '#9a8a6a'); },
  nails: (p) => { for (let i = 0; i < 4; i++) { p.vline(4 + i * 3, 4 + (i % 2), 13, '#8a8e92'); p.hline(3 + i * 3, 5 + i * 3, 4 + (i % 2), '#b8bcc0'); } },
  plank: (p) => { p.rect(1, 6, 14, 4, '#9a7448'); p.hline(1, 14, 6, '#b89060'); p.px(4, 8, '#6a4a2c'); },
  scrap_metal: (p) => { p.rect(3, 5, 9, 7, '#8a8e92'); p.line(3, 5, 12, 12, '#6a4a3a'); p.rect(9, 3, 4, 3, '#a8acb0'); },
  charcoal: blob('#2a2a2a', 4),
  ration: (p) => { p.rect(3, 5, 10, 7, '#b8a868'); p.rect(3, 5, 10, 2, '#8a7a48'); p.hline(5, 10, 9, '#6a5a38'); },
  canned_beans: can('#a8402a'),
  crackers: (p) => { p.rect(3, 3, 10, 10, '#d8b870'); for (let i = 0; i < 4; i++) p.px(5 + (i % 2) * 5, 5 + Math.floor(i / 2) * 5, '#a8884a'); },
  chocolate: (p) => { p.rect(3, 3, 10, 10, '#6a3a22'); p.rect(3, 3, 10, 4, '#e8e0d0'); p.px(8, 4, '#c02020'); },
  pasta: (p) => { p.rect(4, 2, 8, 12, '#3a5a9a'); p.rect(5, 6, 6, 5, '#e8d890'); },
  cooked_pasta: (p) => { p.ellipse(8, 10, 6, 3, '#6a6a6a'); p.ellipse(8, 8, 5, 2.5, '#e8d890'); },
  bilberries: blob('#2a3a7a', 7),
  blackberries: blob('#1e1426', 7),
  hazelnuts: blob('#9a6a34', 5),
  wild_garlic: (p) => { for (let i = 0; i < 3; i++) { p.ellipse(5 + i * 3, 7, 1.5, 5, '#4a9a3a'); } p.px(8, 2, '#f4f4ee'); },
  chanterelles: (p) => { for (let i = 0; i < 2; i++) { p.vline(5 + i * 5, 8, 13, '#e8dcc0'); p.hline(3 + i * 5, 8 + i * 5, 7, '#d8962a'); p.hline(4 + i * 5, 7 + i * 5, 6, '#e8aa3a'); } },
  mushrooms_unknown: (p) => { for (let i = 0; i < 2; i++) { p.vline(5 + i * 5, 8, 13, '#d8d0c0'); p.hline(3 + i * 5, 8 + i * 5, 7, '#8a7a6a'); p.hline(4 + i * 5, 7 + i * 5, 6, '#a8988a'); } },
  roasted_mushrooms: blob('#8a5a22', 5),
  raw_meat: meat('#b8403a'),
  cooked_meat: meat('#8a4a2a', true),
  dried_meat: (p) => { for (let i = 0; i < 3; i++) p.rect(3 + i * 4, 3, 2, 10, '#6a2a1e'); },
  raw_fish: fish('#8a9aa8'),
  cooked_fish: fish('#a8783e'),
  dried_fish: fish('#8a6a4a'),
  potato: blob('#b89060', 3),
  baked_potato: blob('#8a5a2a', 3),
  carrot: (p) => { p.line(4, 12, 11, 5, '#e07a2a'); p.line(5, 12, 12, 5, '#c8661e'); p.line(11, 5, 13, 2, '#4a9a3a'); p.line(12, 5, 14, 4, '#4a9a3a'); },
  beans_dry: blob('#c8b080', 6),
  bean_stew: (p) => { p.ellipse(8, 10, 6, 3, '#5a5a5a'); p.ellipse(8, 8, 5, 2.5, '#9a4a2a'); p.px(6, 8, '#e8c080'); },
  water_bottle: bottle('#6aa0c8', '#2a5a8a'),
  steel_bottle: bottle('#a8acb0', '#3a3a3a'),
  cooking_pot: (p) => { p.rect(3, 6, 10, 7, '#6a6e72'); p.hline(2, 13, 6, '#9a9ea2'); p.hline(1, 2, 7, '#3a3a3a'); p.hline(13, 14, 7, '#3a3a3a'); },
  jerrycan: (p) => { p.rect(3, 3, 10, 11, '#3a5a8a'); p.rect(9, 1, 3, 2, '#1a1a1a'); p.line(4, 4, 12, 12, '#2a4a7a'); },
  pocket_knife: (p) => { p.rect(3, 8, 7, 3, '#c02020'); p.px(5, 9, '#f0f0f0'); p.line(10, 8, 14, 6, STEEL); },
  stone_knife: (p) => { p.rect(2, 9, 5, 3, '#6a5a3a'); p.hline(2, 6, 10, '#8a7a50'); p.line(7, 10, 13, 5, '#7a7a72'); p.line(7, 9, 12, 5, '#a8a8a0'); p.px(13, 5, '#5a5a54'); },
  stone_hammer: tool('#7a7a72'),
  bow_drill: (p) => { p.line(2, 11, 14, 5, WOOD); p.line(2, 11, 14, 5, WOOD); p.line(3, 12, 13, 6, '#d8c8a0'); p.vline(8, 2, 13, '#b08a5a'); p.rect(5, 13, 7, 2, '#6a4a2c'); p.px(8, 13, '#2a1a10'); },
  wooden_pegs: (p) => { for (let i = 0; i < 4; i++) { p.line(3 + i * 3, 13, 5 + i * 3, 4, '#b08a5a'); p.px(5 + i * 3, 4, '#d0aa70'); } },
  hunting_knife: (p) => { p.rect(2, 9, 5, 3, '#3a2a1a'); p.line(7, 10, 14, 6, STEEL); p.line(7, 9, 13, 6, '#d8dce0'); },
  hatchet: tool('#8a8e92'),
  stone_axe: tool('#7a7a72'),
  folding_saw: (p) => { p.rect(2, 9, 5, 3, '#c02020'); p.rect(7, 8, 8, 3, STEEL); for (let x = 7; x < 15; x += 2) p.px(x, 11, '#6a6e72'); },
  folding_shovel: (p) => { p.line(3, 3, 9, 9, '#3a4a3a'); p.rect(9, 9, 5, 5, '#5a6a5a'); p.hline(2, 5, 2, '#3a4a3a'); },
  digging_stick: (p) => { p.line(2, 14, 13, 2, WOOD); p.px(13, 2, '#c8a070'); },
  hammer: (p) => { p.line(4, 13, 10, 5, WOOD); p.rect(8, 2, 6, 3, '#6a6e72'); },
  fishing_hooks: (p) => { p.ellipse(8, 8, 5, 5, '#c8c0a0'); p.ellipse(8, 8, 2, 2, '#4a4a4a'); p.px(12, 12, STEEL); },
  fishing_rod: (p) => { p.line(2, 14, 14, 2, WOOD); p.line(14, 2, 14, 10, '#d8d8d8'); p.px(14, 11, STEEL); },
  spear: (p) => { p.line(2, 14, 13, 3, WOOD); p.line(12, 4, 14, 1, '#c8a070'); },
  matches: (p) => { p.rect(3, 5, 10, 7, '#c8a040'); p.rect(3, 5, 10, 2, '#a02a1a'); p.px(11, 9, '#3a3a3a'); },
  lighter: (p) => { p.rect(5, 4, 6, 10, '#2a6ac8'); p.rect(5, 2, 6, 2, '#a8acb0'); },
  flashlight: (p) => { p.rect(2, 6, 9, 4, '#3a3a3a'); p.rect(11, 5, 3, 6, '#5a5a5a'); p.vline(14, 6, 9, '#f0f0c0'); },
  torch: (p) => { p.line(4, 14, 10, 6, WOOD); p.ellipse(11, 5, 2.5, 2.5, '#b8a888'); p.px(11, 2, '#e8a030'); },
  bandage: (p) => { p.rect(3, 5, 10, 6, '#f0ece0'); p.rect(7, 5, 2, 6, '#c03030'); p.rect(5, 7, 6, 2, '#c03030'); },
  antiseptic: bottle('#c8c0a0', '#a02020'),
  painkillers: (p) => { p.rect(4, 3, 8, 10, '#e8e8e8'); for (let i = 0; i < 4; i++) p.ellipse(6 + (i % 2) * 4, 6 + Math.floor(i / 2) * 4, 1.2, 1.2, '#c8c8f0'); },
  purify_tablets: (p) => { p.rect(4, 3, 8, 10, '#3a7ab8'); p.rect(5, 6, 6, 4, '#f0f0f0'); },
  soap: (p) => { p.ellipse(8, 9, 6, 4, '#e8d8a8'); p.ellipse(7, 8, 3, 1.5, '#f8ecc8'); },
  tshirt: garment('#6a6a70'),
  hoodie: garment('#5e6068'),
  wool_sweater: garment('#7a5a3a'),
  rain_jacket: garment('#a8402a'),
  winter_jacket: garment('#2e3e5e'),
  jeans: pants('#3a4a6a'),
  hiking_pants: pants('#4a4a3e'),
  sneakers: shoe('#e2ded4'),
  hiking_boots: shoe('#5a3e26'),
  beanie: (p) => { p.ellipse(8, 9, 6, 5, '#8a3a2a'); p.rect(2, 10, 12, 3, '#6a2a1e'); p.px(8, 3, '#aa5a4a'); },
  gloves: (p) => { p.rect(3, 5, 5, 8, '#6a4a2c'); p.rect(9, 5, 5, 8, '#5a3e24'); },
  school_backpack: pack('#2e3a5a'),
  hiking_backpack: pack('#3e5a3a', true),
  sleeping_bag: (p) => { p.rect(2, 4, 12, 8, '#2e5a7a'); p.ellipse(3, 8, 2, 4, '#244a68'); for (let x = 4; x < 14; x += 3) p.vline(x, 4, 11, '#244a68'); },
  duffel_bag: (p) => { p.rect(2, 6, 12, 7, '#2e4a32'); p.line(5, 6, 8, 3, '#1a1a1a'); p.line(11, 6, 8, 3, '#1a1a1a'); },
  seed_potatoes: blob('#a8885a', 3),
  bean_seeds: (p) => { p.rect(4, 3, 8, 10, '#d8c8a0'); p.px(7, 7, '#8a6a3a'); p.px(9, 9, '#8a6a3a'); },
  carrot_seeds: (p) => { p.rect(4, 3, 8, 10, '#e8b870'); p.line(6, 10, 9, 6, '#e07a2a'); },
  map: (p) => { p.rect(2, 3, 12, 10, '#d8c8a0'); p.line(3, 10, 8, 5, '#4a7a3a'); p.line(8, 5, 13, 9, '#3a6aa8'); p.px(6, 8, '#c02020'); },
  note: (p) => { p.rect(4, 2, 8, 12, '#e8e0cc'); for (let y = 4; y < 13; y += 2) p.hline(5, 10, y, '#8a8070'); },
  radio: (p) => { p.rect(2, 5, 12, 8, '#c8a030'); p.rect(4, 7, 5, 4, '#3a3a3a'); p.ellipse(11, 9, 1.5, 1.5, '#3a3a3a'); p.vline(12, 1, 5, '#8a8e92'); },
};

const cache = new Map<string, string>();

/** Pixel-art icon as a data URL (cached), drawn at 16x16 and upscaled by CSS. */
export function iconUrl(id: string): string {
  let u = cache.get(id);
  if (u) return u;
  const { c, g } = makeCanvas(16, 16);
  const p = new PixelPainter(g);
  const draw = ICONS[id];
  if (draw) draw(p);
  else {
    const cat = itemDef(id).category;
    p.rect(4, 4, 8, 8, cat === 'food' ? '#a87a4a' : '#7a7a7a');
  }
  u = c.toDataURL();
  cache.set(id, u);
  return u;
}
