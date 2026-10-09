// Sons e música 100% sintetizados com WebAudio (nenhum arquivo de áudio).
import { Save } from './save';

type Snd =
  | 'click' | 'build' | 'upgrade' | 'sell' | 'coin' | 'error' | 'mg' | 'sniper' | 'cannon' | 'mortar' | 'missile'
  | 'boom' | 'bigboom' | 'smallboom' | 'wave' | 'leak' | 'victory' | 'defeat' | 'airstrike' | 'emp' | 'mine'
  | 'kamikaze' | 'boss' | 'crack' | 'shield' | 'heal' | 'mark' | 'squad' | 'supply';

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noise!: AudioBuffer;
  private last: Partial<Record<Snd, number>> = {};
  private flameNode: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private laserNode: { osc: OscillatorNode; gain: GainNode } | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicNext = 0;
  private musicMode: 'menu' | 'battle' = 'menu';

  /** Precisa ser chamado num toque do usuário (regra dos navegadores). */
  unlock(): void {
    if (!this.ctx) {
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AC();
      } catch {
        return;
      }
      const ctx = this.ctx!;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(ctx.destination);
      this.sfxGain = ctx.createGain();
      this.sfxGain.connect(this.master);
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applySettings();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  applySettings(): void {
    if (!this.ctx) return;
    const s = Save.d.settings;
    this.sfxGain.gain.value = s.sfx ? 0.8 : 0;
    this.musicGain.gain.value = s.music ? 0.3 : 0;
    if (s.music) this.startMusic(this.musicMode);
    else this.stopMusic();
  }

  private ok(name: Snd, minGap: number): boolean {
    if (!this.ctx || !Save.d.settings.sfx) return false;
    const t = this.ctx.currentTime;
    if ((this.last[name] ?? -1) > t - minGap) return false;
    this.last[name] = t;
    return true;
  }

  private env(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private noiseHit(t: number, dur: number, type: BiquadFilterType, freq: number, peak: number, q = 1, freqEnd?: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, 0.004, dur);
    src.connect(f).connect(g).connect(this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private tone(t: number, freq: number, dur: number, type: OscillatorType, peak: number, freqEnd?: number, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    this.env(g, t, peak, 0.005, dur);
    o.connect(g).connect(dest ?? this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name: Snd): void {
    const gaps: Partial<Record<Snd, number>> = { mg: 0.07, coin: 0.06, boom: 0.06, smallboom: 0.05, sniper: 0.05, cannon: 0.05, missile: 0.05, mortar: 0.06, crack: 0.08, heal: 0.6, shield: 0.15 };
    if (!this.ok(name, gaps[name] ?? 0.02)) return;
    const t = this.ctx!.currentTime + 0.005;
    switch (name) {
      case 'click':
        this.tone(t, 900, 0.05, 'square', 0.12, 600);
        break;
      case 'build':
        this.noiseHit(t, 0.12, 'lowpass', 900, 0.5);
        this.tone(t, 180, 0.15, 'triangle', 0.4, 120);
        this.tone(t + 0.08, 520, 0.1, 'square', 0.1);
        break;
      case 'upgrade':
        [440, 554, 660, 880].forEach((f, i) => this.tone(t + i * 0.06, f, 0.12, 'square', 0.12));
        break;
      case 'sell':
      case 'coin':
        this.tone(t, 1320, 0.06, 'square', name === 'coin' ? 0.05 : 0.12);
        this.tone(t + 0.05, 1760, 0.09, 'square', name === 'coin' ? 0.05 : 0.12);
        break;
      case 'supply':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.07, f, 0.15, 'triangle', 0.18));
        break;
      case 'error':
        this.tone(t, 160, 0.18, 'sawtooth', 0.15, 120);
        break;
      case 'mg':
        this.noiseHit(t, 0.05, 'bandpass', 2400, 0.35, 0.8);
        this.tone(t, 160, 0.04, 'square', 0.08, 80);
        break;
      case 'sniper':
        this.noiseHit(t, 0.03, 'highpass', 3000, 0.6);
        this.noiseHit(t + 0.01, 0.35, 'lowpass', 1400, 0.25, 1, 300);
        break;
      case 'cannon':
        this.noiseHit(t, 0.35, 'lowpass', 900, 0.8, 1, 120);
        this.tone(t, 110, 0.3, 'sine', 0.6, 40);
        break;
      case 'mortar':
        this.tone(t, 220, 0.12, 'sine', 0.5, 90);
        this.noiseHit(t, 0.1, 'lowpass', 600, 0.4);
        break;
      case 'missile':
        this.noiseHit(t, 0.45, 'bandpass', 600, 0.35, 2, 2400);
        break;
      case 'smallboom':
        this.noiseHit(t, 0.25, 'lowpass', 1200, 0.45, 1, 200);
        break;
      case 'boom':
        this.noiseHit(t, 0.5, 'lowpass', 900, 0.7, 1, 80);
        this.tone(t, 80, 0.4, 'sine', 0.5, 35);
        break;
      case 'bigboom':
        this.noiseHit(t, 1.1, 'lowpass', 700, 1.0, 1, 50);
        this.tone(t, 60, 0.9, 'sine', 0.8, 25);
        break;
      case 'mine':
        this.tone(t, 1200, 0.05, 'square', 0.1);
        break;
      case 'wave':
        this.tone(t, 220, 0.5, 'sawtooth', 0.18);
        this.tone(t, 330, 0.5, 'sawtooth', 0.12);
        this.tone(t + 0.5, 294, 0.7, 'sawtooth', 0.18);
        this.tone(t + 0.5, 440, 0.7, 'sawtooth', 0.12);
        break;
      case 'leak':
        this.tone(t, 880, 0.12, 'square', 0.2);
        this.tone(t + 0.15, 660, 0.18, 'square', 0.2);
        break;
      case 'victory':
        [392, 523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.13, f, 0.3, 'square', 0.15));
        break;
      case 'defeat':
        [392, 349, 311, 262].forEach((f, i) => this.tone(t + i * 0.28, f, 0.45, 'sawtooth', 0.15));
        break;
      case 'airstrike':
        this.noiseHit(t, 1.2, 'bandpass', 300, 0.4, 1.5, 2000);
        break;
      case 'emp':
        this.tone(t, 80, 0.6, 'sawtooth', 0.3, 1600);
        this.noiseHit(t, 0.4, 'highpass', 4000, 0.3);
        break;
      case 'kamikaze':
        this.tone(t, 1400, 0.6, 'sawtooth', 0.08, 300);
        break;
      case 'boss':
        this.tone(t, 55, 1.2, 'sawtooth', 0.35, 40);
        this.tone(t, 82, 1.2, 'square', 0.15, 60);
        break;
      case 'crack':
        this.noiseHit(t, 0.18, 'bandpass', 1600, 0.35, 1);
        break;
      case 'shield':
        this.tone(t, 1800, 0.25, 'sine', 0.15, 400);
        break;
      case 'heal':
        this.tone(t, 660, 0.15, 'sine', 0.06, 990);
        break;
      case 'mark':
        this.tone(t, 1000, 0.06, 'square', 0.1);
        this.tone(t + 0.07, 1300, 0.06, 'square', 0.1);
        break;
      case 'squad':
        this.tone(t, 330, 0.12, 'square', 0.15);
        this.tone(t + 0.12, 440, 0.2, 'square', 0.15);
        break;
    }
  }

  /** Sons contínuos (lança-chamas e laser): intensidade 0..1. */
  setLoops(flame: number, laser: number): void {
    if (!this.ctx || !Save.d.settings.sfx) {
      flame = 0;
      laser = 0;
    }
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.flameNode && flame > 0) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.sfxGain);
      src.start();
      this.flameNode = { src, gain: g };
    }
    if (this.flameNode) this.flameNode.gain.gain.setTargetAtTime(Math.min(1, flame) * 0.22, ctx.currentTime, 0.08);
    if (!this.laserNode && laser > 0) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 220;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1500;
      f.Q.value = 4;
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(f).connect(g).connect(this.sfxGain);
      osc.start();
      this.laserNode = { osc, gain: g };
    }
    if (this.laserNode) {
      this.laserNode.gain.gain.setTargetAtTime(Math.min(1, laser) * 0.12, ctx.currentTime, 0.08);
      this.laserNode.osc.frequency.setTargetAtTime(200 + laser * 120, ctx.currentTime, 0.2);
    }
  }

  // ------------------------------------------------------------ música
  startMusic(mode: 'menu' | 'battle'): void {
    this.musicMode = mode;
    if (!this.ctx || !Save.d.settings.music) return;
    if (this.musicTimer !== null) return;
    this.musicNext = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    this.musicTimer = window.setInterval(() => this.schedule(), 100);
  }

  setMusicMode(mode: 'menu' | 'battle'): void {
    this.musicMode = mode;
    this.startMusic(mode);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const bpm = this.musicMode === 'battle' ? 112 : 84;
    const step = 60 / bpm / 4;
    // progressão menor marcial: Lá m – Fá – Dó – Sol
    const roots = [110, 87.31, 130.81, 98];
    while (this.musicNext < ctx.currentTime + 0.3) {
      const t = this.musicNext;
      const s = this.musicStep % 64;
      const bar = Math.floor(s / 16);
      const root = roots[bar];
      const beat = s % 16;
      // baixo
      if (beat % 4 === 0 || (this.musicMode === 'battle' && beat % 4 === 3)) {
        this.musicTone(t, root, step * 1.8, 'triangle', 0.35);
      }
      // caixa marcial
      if (this.musicMode === 'battle') {
        if (beat === 4 || beat === 12 || (beat >= 13 && bar === 3)) this.musicNoise(t, 0.09, 1800, 0.25);
        if (beat % 2 === 0) this.musicNoise(t, 0.02, 7000, 0.05);
        if (beat === 0 || beat === 8) this.musicTone(t, 55, 0.18, 'sine', 0.5, 35);
      } else if (beat === 8) this.musicNoise(t, 0.08, 1500, 0.08);
      // pad/arpejo
      const arp = [1, 1.5, 2, 1.5];
      if (beat % 4 === 2) this.musicTone(t, root * 2 * arp[(beat / 4) | 0], step * 2, 'square', this.musicMode === 'battle' ? 0.05 : 0.04);
      this.musicNext += step;
      this.musicStep++;
    }
  }

  private musicTone(t: number, f: number, dur: number, type: OscillatorType, peak: number, fEnd?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private musicNoise(t: number, dur: number, freq: number, peak: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}

export const Sfx = new AudioEngine();
