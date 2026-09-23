import { log } from '@/core/logger';

/**
 * Audio architecture. Every sound is addressed by id through a registry.
 * If a recorded file exists for an id (public/assets/audio/<id>.ogg|mp3) it
 * is used; otherwise a synthesized placeholder plays. Final audio can be
 * dropped in without touching gameplay code.
 */
export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ambience: number;
}

type Synth = (ctx: AudioContext, out: AudioNode, vol: number) => void;

function noiseBuffer(ctx: AudioContext, seconds: number, brown = false): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

function burst(ctx: AudioContext, out: AudioNode, vol: number, dur: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass'): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(f).connect(g).connect(out);
  src.start();
}

function tone(ctx: AudioContext, out: AudioNode, vol: number, f0: number, f1: number, dur: number, type: OscillatorType = 'sine'): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(out);
  o.start();
  o.stop(ctx.currentTime + dur + 0.05);
}

const SYNTH: Record<string, Synth> = {
  step: (c, o, v) => burst(c, o, v * 0.18, 0.06, 900, 0.8),
  chop: (c, o, v) => {
    burst(c, o, v * 0.6, 0.12, 400, 1.5);
    tone(c, o, v * 0.25, 180, 90, 0.1, 'triangle');
  },
  treeFall: (c, o, v) => {
    burst(c, o, v * 0.7, 1.2, 180, 0.5, 'lowpass');
    tone(c, o, v * 0.3, 90, 40, 0.8, 'sine');
  },
  gather: (c, o, v) => burst(c, o, v * 0.3, 0.2, 2000, 0.6),
  water: (c, o, v) => {
    for (let i = 0; i < 3; i++) setTimeout(() => tone(c, o, v * 0.12, 600 + Math.random() * 500, 300, 0.12), i * 70);
  },
  eat: (c, o, v) => burst(c, o, v * 0.2, 0.08, 1500, 2),
  ignite: (c, o, v) => burst(c, o, v * 0.4, 0.4, 1200, 0.5, 'highpass'),
  build: (c, o, v) => {
    burst(c, o, v * 0.4, 0.08, 700, 2);
    tone(c, o, v * 0.2, 260, 200, 0.07, 'square');
  },
  buildDone: (c, o, v) => {
    tone(c, o, v * 0.2, 392, 392, 0.2);
    setTimeout(() => tone(c, o, v * 0.2, 523, 523, 0.3), 120);
  },
  swing: (c, o, v) => burst(c, o, v * 0.3, 0.15, 2500, 0.7, 'highpass'),
  boar: (c, o, v) => tone(c, o, v * 0.35, 160, 90, 0.4, 'sawtooth'),
  equip: (c, o, v) => burst(c, o, v * 0.25, 0.06, 3000, 1),
  ui: (c, o, v) => tone(c, o, v * 0.08, 880, 660, 0.05, 'triangle'),
  uiOpen: (c, o, v) => tone(c, o, v * 0.08, 520, 700, 0.07, 'triangle'),
  thunder: (c, o, v) => burst(c, o, v * 0.9, 3, 120, 0.4, 'lowpass'),
  hint: (c, o, v) => tone(c, o, v * 0.06, 660, 880, 0.18, 'sine'),
};

export class AudioManager {
  private ctx?: AudioContext;
  private master?: GainNode;
  private sfxBus?: GainNode;
  private musicBus?: GainNode;
  private ambBus?: GainNode;
  private files = new Map<string, AudioBuffer | null>();
  settings: AudioSettings = { master: 0.8, music: 0.5, sfx: 0.8, ambience: 0.7 };
  private rain?: { g: GainNode };
  private wind?: { g: GainNode; f: BiquadFilterNode };
  private fire?: { g: GainNode };
  private birdTimer = 0;
  private musicTimer = 20;
  private lastStep = 0;

  /** Must be called from a user gesture on iOS/Safari. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.ambBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.ambBus.connect(this.master);
      this.applyVolumes();
      this.startAmbience();
    } catch (e) {
      log.warn('audio', 'Web Audio unavailable', e);
    }
  }

  applyVolumes(): void {
    if (!this.master) return;
    this.master.gain.value = this.settings.master;
    this.sfxBus!.gain.value = this.settings.sfx;
    this.musicBus!.gain.value = this.settings.music * 0.6;
    this.ambBus!.gain.value = this.settings.ambience;
  }

  suspend(): void {
    void this.ctx?.suspend();
  }
  resume(): void {
    void this.ctx?.resume();
  }

  private startAmbience(): void {
    const c = this.ctx!;
    const loop = (brown: boolean) => {
      const s = c.createBufferSource();
      s.buffer = noiseBuffer(c, 4, brown);
      s.loop = true;
      return s;
    };
    // wind
    const ws = loop(true);
    const wf = c.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 400;
    const wg = c.createGain();
    wg.gain.value = 0.05;
    ws.connect(wf).connect(wg).connect(this.ambBus!);
    ws.start();
    this.wind = { g: wg, f: wf };
    // rain
    const rs = loop(false);
    const rf = c.createBiquadFilter();
    rf.type = 'highpass';
    rf.frequency.value = 1500;
    const rg = c.createGain();
    rg.gain.value = 0;
    rs.connect(rf).connect(rg).connect(this.ambBus!);
    rs.start();
    this.rain = { g: rg };
    // fire crackle bed
    const fs = loop(true);
    const ff = c.createBiquadFilter();
    ff.type = 'bandpass';
    ff.frequency.value = 800;
    const fg = c.createGain();
    fg.gain.value = 0;
    fs.connect(ff).connect(fg).connect(this.ambBus!);
    fs.start();
    this.fire = { g: fg };
  }

  /** Called every frame with the environment around the listener. */
  updateAmbience(dt: number, env: { rain: number; wind: number; fireDist: number; daylight: number; indoor: boolean; sleeping: boolean }): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx;
    const k = Math.min(1, dt * 2);
    const indoor = env.indoor ? 0.4 : 1;
    const cur = (g: GainNode) => g.gain.value;
    this.rain!.g.gain.value = cur(this.rain!.g) + (env.rain * 0.22 * indoor - cur(this.rain!.g)) * k;
    this.wind!.g.gain.value = cur(this.wind!.g) + ((0.02 + env.wind * 0.012) * indoor - cur(this.wind!.g)) * k;
    this.wind!.f.frequency.value = 250 + env.wind * 40;
    const fireVol = env.fireDist < 8 ? (1 - env.fireDist / 8) * 0.12 : 0;
    this.fire!.g.gain.value = cur(this.fire!.g) + (fireVol - cur(this.fire!.g)) * k;
    if (fireVol > 0.01 && Math.random() < dt * 8) burst(c, this.ambBus!, fireVol * 1.5, 0.03, 2000 + Math.random() * 2000, 3);
    // birds by day, owls and crickets at night
    this.birdTimer -= dt;
    if (this.birdTimer <= 0 && !env.sleeping) {
      this.birdTimer = 2 + Math.random() * 6;
      if (env.rain < 0.3) {
        if (env.daylight > 0.5) this.bird(0.05 * indoor);
        else if (env.daylight < 0.2 && Math.random() < 0.4) this.owl(0.04 * indoor);
      }
    }
    // sparse generative music: a few soft notes now and then
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 25 + Math.random() * 50;
      this.phrase();
    }
  }

  private bird(vol: number): void {
    const c = this.ctx!;
    const base = 2200 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) setTimeout(() => tone(c, this.ambBus!, vol, base * (1 + Math.random() * 0.3), base * 0.8, 0.08 + Math.random() * 0.06), i * (90 + Math.random() * 80));
  }

  private owl(vol: number): void {
    const c = this.ctx!;
    tone(c, this.ambBus!, vol, 420, 380, 0.35);
    setTimeout(() => tone(c, this.ambBus!, vol * 0.8, 400, 360, 0.5), 450);
  }

  private phrase(): void {
    if (!this.ctx || this.settings.music <= 0) return;
    const c = this.ctx;
    // A minor pentatonic, low and quiet
    const scale = [220, 261.6, 293.7, 329.6, 392, 440];
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = scale[Math.floor(Math.random() * scale.length)];
      setTimeout(() => {
        const o = c.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 3.5);
        o.connect(g).connect(this.musicBus!);
        o.start();
        o.stop(c.currentTime + 3.6);
      }, i * 1300);
    }
  }

  /** Play a sound by id at a world position relative to the listener. */
  play(id: string, dist = 0): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (dist > 18) return;
    if (id === 'step') {
      const now = performance.now();
      if (now - this.lastStep < 200) return;
      this.lastStep = now;
    }
    const vol = Math.max(0, 1 - dist / 18);
    const file = this.files.get(id);
    if (file) {
      const s = this.ctx.createBufferSource();
      s.buffer = file;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      s.connect(g).connect(this.sfxBus!);
      s.start();
      return;
    }
    if (file === undefined) void this.tryLoad(id);
    SYNTH[id]?.(this.ctx, this.sfxBus!, vol);
  }

  private async tryLoad(id: string): Promise<void> {
    this.files.set(id, null);
    for (const ext of ['ogg', 'mp3']) {
      try {
        const res = await fetch(`/assets/audio/${id}.${ext}`);
        if (!res.ok || !res.headers.get('content-type')?.startsWith('audio')) continue;
        const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
        this.files.set(id, buf);
        return;
      } catch {
        // no recorded asset: the synthesized placeholder is used
      }
    }
  }
}

export const audio = new AudioManager();
