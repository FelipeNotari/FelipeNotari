import Phaser from 'phaser';
import { Save } from './save';

interface Particle {
  img: Phaser.GameObjects.Image;
  active: boolean;
  vx: number;
  vy: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  a0: number;
  a1: number;
  rot: number;
  drag: number;
  grav: number;
}

export interface EmitOpts {
  count?: number;
  speed?: [number, number];
  angle?: [number, number]; // graus
  life?: [number, number]; // segundos
  scale?: [number, number];
  alpha?: [number, number];
  tint?: number | number[];
  add?: boolean;
  grav?: number;
  drag?: number;
  spin?: number;
  spread?: number; // raio de dispersão inicial
  depth?: number;
  rotateToVel?: boolean;
}

/** Sistema de partículas próprio, com pool fixo (sem alocação durante o jogo). */
export class Fx {
  private pool: Particle[] = [];
  private next = 0;
  constructor(private scene: Phaser.Scene, size = 700, private depth = 60) {
    for (let i = 0; i < size; i++) {
      const img = scene.add.image(0, 0, 'glow').setVisible(false).setDepth(depth);
      this.pool.push({ img, active: false, vx: 0, vy: 0, life: 0, max: 1, s0: 1, s1: 1, a0: 1, a1: 0, rot: 0, drag: 0, grav: 0 });
    }
  }

  emit(tex: string, x: number, y: number, o: EmitOpts = {}): void {
    let count = o.count ?? 1;
    if (Save.d.settings.particles === 'baixa') count = Math.ceil(count / 2);
    for (let i = 0; i < count; i++) {
      const p = this.alloc();
      const ang = Phaser.Math.DegToRad(Phaser.Math.FloatBetween(o.angle?.[0] ?? 0, o.angle?.[1] ?? 360));
      const sp = Phaser.Math.FloatBetween(o.speed?.[0] ?? 0, o.speed?.[1] ?? 0);
      p.vx = Math.cos(ang) * sp;
      p.vy = Math.sin(ang) * sp;
      p.max = p.life = Phaser.Math.FloatBetween(o.life?.[0] ?? 0.5, o.life?.[1] ?? o.life?.[0] ?? 0.5);
      p.s0 = o.scale?.[0] ?? 1;
      p.s1 = o.scale?.[1] ?? p.s0;
      p.a0 = o.alpha?.[0] ?? 1;
      p.a1 = o.alpha?.[1] ?? 0;
      p.rot = (o.spin ?? 0) * (Math.random() * 2 - 1);
      p.drag = o.drag ?? 0;
      p.grav = o.grav ?? 0;
      const sx = o.spread ? (Math.random() * 2 - 1) * o.spread : 0;
      const sy = o.spread ? (Math.random() * 2 - 1) * o.spread : 0;
      const img = p.img;
      img.setTexture(tex);
      img.setPosition(x + sx, y + sy);
      img.setScale(p.s0);
      img.setAlpha(p.a0);
      img.setRotation(o.rotateToVel ? ang : Math.random() * 6.28);
      if (o.tint !== undefined) img.setTint(Array.isArray(o.tint) ? o.tint[(Math.random() * o.tint.length) | 0] : o.tint);
      else img.clearTint();
      img.setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      img.setDepth(o.depth ?? this.depth);
      img.setVisible(true);
      p.active = true;
    }
  }

  private alloc(): Particle {
    for (let k = 0; k < this.pool.length; k++) {
      const i = (this.next + k) % this.pool.length;
      if (!this.pool[i].active) {
        this.next = (i + 1) % this.pool.length;
        return this.pool[i];
      }
    }
    // tudo ocupado: recicla a mais antiga na fila
    const p = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    return p;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.img.setVisible(false);
        continue;
      }
      const t = 1 - p.life / p.max;
      if (p.drag) {
        const f = Math.max(0, 1 - p.drag * dt);
        p.vx *= f;
        p.vy *= f;
      }
      p.vy += p.grav * dt;
      const img = p.img;
      img.x += p.vx * dt;
      img.y += p.vy * dt;
      img.setScale(p.s0 + (p.s1 - p.s0) * t);
      img.setAlpha(p.a0 + (p.a1 - p.a0) * t);
      if (p.rot) img.rotation += p.rot * dt;
    }
  }

  clear(): void {
    for (const p of this.pool) {
      p.active = false;
      p.img.setVisible(false);
    }
  }
}
