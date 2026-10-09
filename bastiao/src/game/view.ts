import Phaser from 'phaser';
import { ENEMY_BY_ID } from '../core/data';
import { EV } from '../core/events';
import type { Enemy, Game, Obstacle, Tower } from '../core/game';
import { Sfx } from './audio';
import { enemyDisplaySize } from './art/textures';
import { C, MAP_H, MAP_W, MAP_X, MAP_Y, TILE, tx, ty } from './config';
import { Fx } from './fx';
import { Save } from './save';

interface EnemyView {
  uid: number;
  body: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  rotor: Phaser.GameObjects.Image;
  hpBg: Phaser.GameObjects.Image;
  hpFg: Phaser.GameObjects.Image;
  shield: Phaser.GameObjects.Image;
  size: number;
  fxT: number;
}

interface TowerView {
  base: Phaser.GameObjects.Image;
  turret: Phaser.GameObjects.Image;
  pips: Phaser.GameObjects.Image[];
  beam?: Phaser.GameObjects.Image;
  level: number;
  shots: number;
  recoil: number;
  angle: number;
  fxT: number;
}

interface ObsView {
  img: Phaser.GameObjects.Image;
  hpBg: Phaser.GameObjects.Image;
  hpFg: Phaser.GameObjects.Image;
  mark: Phaser.GameObjects.Image;
  shake: number;
}

interface Floater {
  t: Phaser.GameObjects.BitmapText;
  life: number;
  vy: number;
}

const D = {
  decal: 2,
  obstacle: 10,
  zone: 12,
  base: 18,
  towerBase: 20,
  shadow: 25,
  ground: 30,
  turret: 40,
  proj: 45,
  airShadow: 47,
  air: 50,
  beam: 55,
  fx: 60,
  bars: 70,
  numbers: 80,
};

/** Camada visual da partida: espelha o estado da simulação em sprites e efeitos. */
export class BattleView {
  fx: Fx;
  fxTop: Fx;
  decals: Phaser.GameObjects.RenderTexture;
  private enemies: (EnemyView | null)[] = [];
  private towers = new Map<number, TowerView>();
  private projs: Phaser.GameObjects.Image[] = [];
  private projShadows: Phaser.GameObjects.Image[] = [];
  private obs: ObsView[] = [];
  private zoneViews: Phaser.GameObjects.Image[] = [];
  private tracers: { img: Phaser.GameObjects.Image; life: number }[] = [];
  private floaters: Floater[] = [];
  private numCount = 0;
  private stamp: Phaser.GameObjects.Image;
  onLeak?: (n: number) => void;
  onWave?: (n: number) => void;
  onBoss?: (k: string) => void;
  private flameCount = 0;
  private laserCount = 0;

  constructor(private scene: Phaser.Scene, private game: Game) {
    this.decals = scene.add.renderTexture(MAP_X, MAP_Y, MAP_W, MAP_H).setOrigin(0).setDepth(D.decal);
    this.stamp = scene.make.image({ x: 0, y: 0, key: 'marca', add: false });
    this.fx = new Fx(scene, 650, D.fx);
    this.fxTop = new Fx(scene, 120, D.numbers - 1);
    for (let i = 0; i < game.enemyPool.length; i++) this.enemies.push(null);
    for (let i = 0; i < game.projPool.length; i++) {
      this.projShadows.push(scene.add.image(0, 0, 'sombra').setVisible(false).setDepth(D.shadow).setAlpha(0.6));
      this.projs.push(scene.add.image(0, 0, 'proj_shell').setVisible(false).setDepth(D.proj));
    }
    for (let i = 0; i < game.zones.length; i++) this.zoneViews.push(scene.add.image(0, 0, 'mina').setVisible(false).setDepth(D.zone));
    for (let i = 0; i < 70; i++) {
      const img = scene.add.image(0, 0, 'tracer').setOrigin(1, 0.5).setVisible(false).setDepth(D.beam).setBlendMode(Phaser.BlendModes.ADD);
      this.tracers.push({ img, life: 0 });
    }
    for (let i = 0; i < 46; i++) {
      const t = scene.add.bitmapText(0, 0, 'dano', '', 26).setOrigin(0.5).setVisible(false).setDepth(D.numbers);
      this.floaters.push({ t, life: 0, vy: 0 });
    }
    // obstáculos
    for (const o of game.obstacles) {
      const img = scene.add.image(tx(o.x), ty(o.y), `obs_${o.def.id}_${game.level.biome}`).setDisplaySize(TILE, TILE).setDepth(D.obstacle);
      const hpBg = scene.add.image(tx(o.x), ty(o.y) - TILE * 0.5, 'px').setDisplaySize(50, 8).setTint(0x1b1f22).setVisible(false).setDepth(D.bars);
      const hpFg = scene.add.image(tx(o.x) - 24, ty(o.y) - TILE * 0.5, 'px').setOrigin(0, 0.5).setDisplaySize(48, 6).setTint(0xffcc33).setVisible(false).setDepth(D.bars);
      const mark = scene.add.image(tx(o.x), ty(o.y), 'ic_mira').setDisplaySize(60, 60).setVisible(false).setDepth(D.bars);
      this.obs.push({ img, hpBg, hpFg, mark, shake: 0 });
    }
    // base
    const p0 = game.paths[0];
    scene.add.image(tx(p0.xs[p0.xs.length - 1]), ty(p0.ys[p0.ys.length - 1]), 'base_qg').setDisplaySize(120, 120).setDepth(D.base);
  }

  // ------------------------------------------------------------ sincronização por frame
  sync(dt: number): void {
    this.syncEnemies(dt);
    this.syncTowers(dt);
    this.syncProjectiles();
    this.syncObstacles(dt);
    this.syncZones();
    this.updateTracers(dt);
    this.updateFloaters(dt);
    this.fx.update(dt);
    this.fxTop.update(dt);
    Sfx.setLoops(Math.min(1, this.flameCount / 3), Math.min(1, this.laserCount / 3));
  }

  private makeEnemyView(): EnemyView {
    const s = this.scene;
    return {
      uid: -1,
      body: s.add.image(0, 0, 'px'),
      shadow: s.add.image(0, 0, 'sombra'),
      rotor: s.add.image(0, 0, 'rotor').setVisible(false),
      hpBg: s.add.image(0, 0, 'px').setTint(0x1b1f22).setDepth(D.bars),
      hpFg: s.add.image(0, 0, 'px').setOrigin(0, 0.5).setDepth(D.bars),
      shield: s.add.image(0, 0, 'bolha').setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
      size: 1,
      fxT: 0,
    };
  }

  private syncEnemies(dt: number): void {
    const pool = this.game.enemyPool;
    for (let i = 0; i < pool.length; i++) {
      const e = pool[i];
      let v = this.enemies[i];
      if (!e.active) {
        if (v && v.body.visible) this.hideEnemy(v);
        continue;
      }
      if (!v) v = this.enemies[i] = this.makeEnemyView();
      if (v.uid !== e.uid) this.setupEnemy(v, e);
      this.updateEnemy(v, e, dt);
    }
  }

  private hideEnemy(v: EnemyView): void {
    v.body.setVisible(false);
    v.shadow.setVisible(false);
    v.rotor.setVisible(false);
    v.hpBg.setVisible(false);
    v.hpFg.setVisible(false);
    v.shield.setVisible(false);
    v.uid = -1;
  }

  private setupEnemy(v: EnemyView, e: Enemy): void {
    v.uid = e.uid;
    const size = enemyDisplaySize(e.def.size);
    v.size = size;
    const air = !!e.def.air;
    v.body.setTexture(`ini_${e.def.id}`).setDisplaySize(size, size).setVisible(true).setDepth(air ? D.air : D.ground).clearTint().setAlpha(1);
    v.shadow.setDisplaySize(size * (air ? 0.8 : 1.05), size * (air ? 0.5 : 0.7)).setVisible(true).setDepth(air ? D.airShadow : D.shadow).setAlpha(air ? 0.5 : 0.8);
    const rotor = e.def.id === 'heli' || e.def.id === 'boss_ciclope';
    v.rotor.setVisible(rotor).setDisplaySize(size * 1.1, size * 1.1).setDepth(D.air + 1);
    v.hpBg.setVisible(false);
    v.hpFg.setVisible(false);
    v.shield.setVisible(false).setDepth((air ? D.air : D.ground) + 2);
    v.fxT = 0;
  }

  private updateEnemy(v: EnemyView, e: Enemy, dt: number): void {
    const x = tx(e.x);
    const y = ty(e.y);
    const air = !!e.def.air;
    const lift = air ? 18 : 0;
    v.body.setPosition(x, y - lift).setRotation(e.a);
    v.shadow.setPosition(x + (air ? 10 : 3), y + (air ? 14 : 5));
    if (v.rotor.visible) v.rotor.setPosition(x, y - lift).setRotation(v.rotor.rotation + dt * 25);
    // camuflado / fumaça
    let alpha = 1;
    if (e.def.camo && !e.revealed) alpha = 0.32;
    if (e.smoke > 0) alpha = Math.min(alpha, 0.55);
    v.body.setAlpha(alpha);
    if (e.hitFlash > 0) v.body.setTintFill(0xffffff);
    else if (e.stun > 0) v.body.setTint(0x88ccff);
    else if (e.burnTime > 0) v.body.setTint(0xffb080);
    else v.body.clearTint();
    // barra de vida
    const damaged = e.hp < e.maxHp || e.shield > 0;
    const bw = Math.max(34, Math.min(110, v.size * 0.8));
    const by = y - lift - v.size * 0.5 - 6;
    v.hpBg.setVisible(damaged);
    v.hpFg.setVisible(damaged);
    if (damaged) {
      v.hpBg.setPosition(x, by).setDisplaySize(bw + 4, 9);
      const f = Math.max(0, e.hp / e.maxHp);
      v.hpFg.setPosition(x - bw / 2, by).setDisplaySize(Math.max(1, bw * f), 6);
      v.hpFg.setTint(e.shield > 0 ? 0x3fd0ff : f > 0.5 ? 0x6fcf4a : f > 0.25 ? 0xffcc33 : 0xe0453a);
      if (e.shield > 0) {
        const max = Math.max(e.auraShieldMax, e.bossShieldMax, e.shield);
        v.hpFg.setDisplaySize(Math.max(1, bw * Math.min(1, e.shield / max)), 6);
      }
    }
    // bolha de escudo
    const sh = e.shield > 0;
    v.shield.setVisible(sh);
    if (sh) v.shield.setPosition(x, y - lift).setDisplaySize(v.size * 1.35, v.size * 1.35).setAlpha(0.55 + 0.25 * Math.sin(this.scene.time.now / 120));
    // efeitos contínuos
    v.fxT -= dt;
    if (v.fxT <= 0) {
      v.fxT = 0.12;
      if (e.burnTime > 0) this.fx.emit('fogo', x, y - lift, { count: 1, speed: [10, 30], angle: [240, 300], life: [0.3, 0.5], scale: [0.5, 0.15], alpha: [0.9, 0], add: true, spread: 8 });
      if (e.stun > 0) this.fx.emit('faisca', x, y - lift, { count: 2, speed: [40, 90], life: [0.15, 0.25], scale: [0.7, 0.3], tint: 0x9fe8ff, add: true, rotateToVel: true });
      if (e.def.vehicle && !air && e.hp < e.maxHp * 0.4) this.fx.emit('fumaca', x, y, { count: 1, speed: [10, 25], angle: [250, 290], life: [0.8, 1.2], scale: [0.3, 0.8], alpha: [0.5, 0], tint: 0x444444 });
      if (e.def.boss && e.smoke > 0) this.fx.emit('fumaca', x, y, { count: 3, speed: [20, 60], life: [1, 1.6], scale: [0.8, 2.2], alpha: [0.75, 0], tint: 0xb0aaa0, spread: 30 });
    }
  }

  private syncTowers(dt: number): void {
    const seen = new Set<number>();
    this.flameCount = 0;
    this.laserCount = 0;
    for (const t of this.game.towers) {
      seen.add(t.uid);
      let v = this.towers.get(t.uid);
      if (!v) {
        v = this.makeTowerView(t);
        this.towers.set(t.uid, v);
      }
      this.updateTower(v, t, dt);
    }
    for (const [uid, v] of this.towers) {
      if (!seen.has(uid)) {
        v.base.destroy();
        v.turret.destroy();
        v.beam?.destroy();
        for (const p of v.pips) p.destroy();
        this.towers.delete(uid);
      }
    }
  }

  private makeTowerView(t: Tower): TowerView {
    const s = this.scene;
    const x = tx(t.x);
    const y = ty(t.y);
    if (t.temp) {
      const base = s.add.image(x, y, 'base_mg').setDisplaySize(TILE * 0.85, TILE * 0.85).setDepth(D.towerBase).setTint(0xb8c79a);
      const turret = s.add.image(x, y, 'tur_mg_1').setDisplaySize(TILE * 0.95, TILE * 0.95).setDepth(D.turret);
      this.fx.emit('fumaca', x, y, { count: 8, speed: [30, 80], life: [0.5, 0.9], scale: [0.5, 1.2], alpha: [0.6, 0], tint: 0xcfc6a8 });
      return { base, turret, pips: [], level: 0, shots: 0, recoil: 0, angle: t.angle, fxT: 0 };
    }
    const base = s.add.image(x, y, `base_${t.def.id}`).setDisplaySize(TILE, TILE).setDepth(D.towerBase);
    const turret = s.add.image(x, y, `tur_${t.def.id}_${t.level}`).setDisplaySize(TILE * 1.22, TILE * 1.22).setDepth(D.turret);
    const pips: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 3; i++) pips.push(s.add.image(x - 14 + i * 14, y + TILE * 0.42, 'px').setDisplaySize(10, 6).setTint(0xffcc33).setDepth(D.turret + 1).setVisible(i <= t.level));
    let beam: Phaser.GameObjects.Image | undefined;
    if (t.def.attack === 'beam') beam = s.add.image(x, y, 'feixe').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.beam).setVisible(false);
    this.fx.emit('fumaca', x, y, { count: 10, speed: [40, 110], life: [0.5, 0.9], scale: [0.5, 1.3], alpha: [0.7, 0], tint: 0xcfc6a8 });
    return { base, turret, pips, beam, level: t.level, shots: t.shots, recoil: 0, angle: t.angle, fxT: 0 };
  }

  private updateTower(v: TowerView, t: Tower, dt: number): void {
    const x = tx(t.x);
    const y = ty(t.y);
    if (v.level !== t.level && !t.temp) {
      v.level = t.level;
      v.turret.setTexture(`tur_${t.def.id}_${t.level}`).setDisplaySize(TILE * 1.22, TILE * 1.22);
      v.pips.forEach((p, i) => p.setVisible(i <= t.level));
      this.fx.emit('faisca', x, y, { count: 14, speed: [80, 200], life: [0.3, 0.5], tint: 0xffcc33, add: true, rotateToVel: true });
      this.fx.emit('glow', x, y, { count: 1, life: [0.35, 0.35], scale: [0.6, 2.2], alpha: [0.8, 0], tint: 0xffcc33, add: true });
    }
    if (t.def.attack === 'support') {
      v.turret.rotation += dt * 1.5;
      v.turret.setTint(t.disabled > 0 ? 0x777777 : 0xffffff);
      return;
    }
    // giro suave
    let da = t.angle - v.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    v.angle += da * Math.min(1, dt * 14);
    if (t.shots !== v.shots) {
      v.shots = t.shots;
      v.recoil = t.def.id === 'at' || t.def.id === 'sn' ? 9 : t.def.id === 'mo' ? 4 : 5;
    }
    v.recoil = Math.max(0, v.recoil - dt * 40);
    const ox = -Math.cos(v.angle) * v.recoil;
    const oy = -Math.sin(v.angle) * v.recoil;
    v.turret.setPosition(x + ox, y + oy).setRotation(v.angle);
    const dis = t.disabled > 0;
    v.turret.setTint(dis ? 0x6a6a6a : 0xffffff);
    v.base.setTint(dis ? 0x8a8a8a : 0xffffff);
    v.fxT -= dt;
    if (dis && v.fxT <= 0) {
      v.fxT = 0.15;
      this.fx.emit('faisca', x, y - 10, { count: 2, speed: [60, 140], life: [0.15, 0.3], tint: 0x9fe8ff, add: true, rotateToVel: true });
    }
    const muzzle = TILE * 0.55;
    const mx = x + Math.cos(v.angle) * muzzle;
    const my = y + Math.sin(v.angle) * muzzle;
    // lança-chamas
    if (t.def.attack === 'flame' && t.firing && !dis) {
      this.flameCount++;
      const deg = Phaser.Math.RadToDeg(v.angle);
      const half = 26;
      const sp = t.stats.range * TILE * 1.5;
      this.fx.emit('fogo', mx, my, { count: 2, speed: [sp * 0.7, sp], angle: [deg - half, deg + half], life: [0.35, 0.55], scale: [0.4, 1.4], alpha: [1, 0], add: true, drag: 1.5 });
      if (Math.random() < 0.3) this.fx.emit('fumaca', mx + Math.cos(v.angle) * sp * 0.5, my + Math.sin(v.angle) * sp * 0.5, { count: 1, speed: [10, 30], life: [0.6, 1], scale: [0.4, 1], alpha: [0.4, 0], tint: 0x333333 });
    }
    // laser
    if (v.beam) {
      const tgt = t.target && t.target.active && t.target.uid === t.targetUid ? t.target : null;
      const ob = t.targetObs && t.targetObs.alive ? t.targetObs : null;
      if (t.firing && !dis && (tgt || ob)) {
        this.laserCount++;
        const ex = tx(tgt ? tgt.x : ob!.x);
        const ey = ty(tgt ? tgt.y : ob!.y) - (tgt?.def.air ? 18 : 0);
        const dist = Phaser.Math.Distance.Between(mx, my, ex, ey);
        const ramp = Math.min(1, t.rampT / t.stats.rampTime);
        v.beam.setVisible(true).setPosition(mx, my).setRotation(Math.atan2(ey - my, ex - mx));
        v.beam.setDisplaySize(dist, 8 + ramp * 14 + Math.sin(this.scene.time.now / 40) * 2);
        if (Math.random() < 0.5) this.fx.emit('faisca', ex, ey, { count: 1, speed: [60, 160], life: [0.1, 0.25], tint: 0x9fe8ff, add: true, rotateToVel: true });
      } else v.beam.setVisible(false);
    }
  }

  private syncProjectiles(): void {
    const pool = this.game.projPool;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      const img = this.projs[i];
      const sh = this.projShadows[i];
      if (!p.active) {
        if (img.visible) {
          img.setVisible(false);
          sh.setVisible(false);
        }
        continue;
      }
      const x = tx(p.x);
      const y = ty(p.y);
      if (!img.visible) {
        const key = p.kind === 'shell' ? 'proj_shell' : p.kind === 'missile' ? 'proj_missil' : 'proj_morteiro';
        img.setTexture(key).setVisible(true);
        const s = p.kind === 'missile' ? 34 : p.kind === 'shell' ? 26 : 24;
        img.setDisplaySize(s, s);
        sh.setVisible(p.kind === 'mortar').setDisplaySize(22, 12);
      }
      if (p.kind === 'mortar') {
        const f = Math.min(1, p.t / p.tTotal);
        const h = Math.sin(f * Math.PI) * 90;
        img.setPosition(x, y - h).setScale((24 / img.width) * (1 + h / 90));
        sh.setPosition(x, y);
      } else {
        img.setPosition(x, y).setRotation(p.a);
        if (p.kind === 'missile' && Math.random() < 0.7)
          this.fx.emit('fumaca', x - Math.cos(p.a) * 14, y - Math.sin(p.a) * 14, { count: 1, life: [0.35, 0.6], scale: [0.18, 0.5], alpha: [0.6, 0], tint: 0xdddddd });
      }
    }
  }

  private syncObstacles(dt: number): void {
    const list = this.game.obstacles;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      const v = this.obs[i];
      if (!o.alive) {
        if (v.img.visible) {
          v.img.setVisible(false);
          v.hpBg.setVisible(false);
          v.hpFg.setVisible(false);
          v.mark.setVisible(false);
        }
        continue;
      }
      const dmg = o.hp < o.maxHp;
      v.hpBg.setVisible(dmg);
      v.hpFg.setVisible(dmg);
      if (dmg) v.hpFg.setDisplaySize(Math.max(1, 48 * (o.hp / o.maxHp)), 6);
      v.mark.setVisible(o.marked);
      if (o.marked) v.mark.setRotation(v.mark.rotation + dt * 1.5).setScale((60 / v.mark.width) * (1 + 0.08 * Math.sin(this.scene.time.now / 150)));
      if (v.shake > 0) {
        v.shake -= dt;
        v.img.setPosition(tx(o.x) + (Math.random() - 0.5) * 4, ty(o.y) + (Math.random() - 0.5) * 4);
      } else v.img.setPosition(tx(o.x), ty(o.y));
    }
  }

  private syncZones(): void {
    const zs = this.game.zones;
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      const img = this.zoneViews[i];
      if (!z.active) {
        if (img.visible) img.setVisible(false);
        continue;
      }
      const x = tx(z.x);
      const y = ty(z.y);
      switch (z.kind) {
        case 'mine':
          img.setTexture('mina').setVisible(true).setPosition(x, y).setDisplaySize(26, 26).setAlpha(0.85 + 0.15 * Math.sin(this.scene.time.now / 200));
          break;
        case 'wire':
          img.setTexture('arame').setVisible(true).setPosition(x, y).setDisplaySize(z.r * TILE * 2, z.r * TILE * 1.2).setAlpha(Math.min(1, z.t));
          break;
        case 'strike':
          img.setTexture('ic_alvo').setVisible(true).setPosition(x, y).setDisplaySize(z.r * TILE * 2, z.r * TILE * 2).setAlpha(0.35 + 0.3 * Math.sin(this.scene.time.now / 60));
          break;
        case 'napalm':
          img.setTexture('marca').setVisible(true).setPosition(x, y).setDisplaySize(z.r * TILE * 2.2, z.r * TILE * 2.2).setAlpha(0.6);
          if (Math.random() < 0.8)
            this.fx.emit('fogo', x, y, { count: 2, spread: z.r * TILE * 0.8, speed: [10, 40], angle: [250, 290], life: [0.4, 0.8], scale: [0.6, 1.4], alpha: [0.9, 0], add: true });
          break;
      }
    }
  }

  // ------------------------------------------------------------ eventos
  handleEvents(): void {
    const q = this.game.events;
    const st = Save.d.settings;
    for (let i = 0; i < q.count; i++) {
      const ev = q.get(i);
      const x = tx(ev.x);
      const y = ty(ev.y);
      switch (ev.type) {
        case EV.SHOT: {
          const x2 = tx(ev.x2);
          const y2 = ty(ev.y2);
          const ang = Math.atan2(y2 - y, x2 - x);
          const mx = x + Math.cos(ang) * TILE * 0.6;
          const my = y + Math.sin(ang) * TILE * 0.6;
          this.tracer(mx, my, x2, y2, ev.k === 'sn' ? 0xffffff : 0xffe28a, ev.k === 'sn' ? 0.12 : 0.07);
          this.fx.emit('glow', mx, my, { count: 1, life: [0.06, 0.06], scale: [0.35, 0.5], alpha: [1, 0], tint: 0xffd27a, add: true });
          if (ev.k === 'sn') {
            Sfx.play('sniper');
            if (ev.v) this.number(x2, y2 - 30, 'CRIT!', 0xffcc33);
          } else Sfx.play('mg');
          this.fx.emit('faisca', x2, y2, { count: 1, speed: [40, 120], life: [0.08, 0.18], tint: 0xffe28a, add: true, rotateToVel: true });
          break;
        }
        case EV.LAUNCH:
          if (ev.k === 'shell') {
            Sfx.play('cannon');
            this.muzzle(x, y, ev.x2, ev.y2, 0.8);
          } else if (ev.k === 'mortar') {
            Sfx.play('mortar');
            this.fx.emit('fumaca', x, y, { count: 3, speed: [10, 40], life: [0.5, 0.8], scale: [0.4, 0.9], alpha: [0.6, 0], tint: 0xbbbbbb });
          } else Sfx.play('missile');
          break;
        case EV.HIT:
          if (st.numbers) this.number(x + (Math.random() - 0.5) * 16, y, String(Math.round(ev.v)), ev.k === 'ENE' ? 0x9fe8ff : 0xffffff);
          break;
        case EV.EXPLOSION:
          this.explosion(x, y, ev.v * TILE, ev.k);
          break;
        case EV.DEATH: {
          const def = ENEMY_BY_ID[ev.k];
          if (def.boss) {
            this.explosion(x, y, TILE * 2.2, 'g');
            this.explosion(x + 40, y - 30, TILE * 1.2, 'm');
            this.scene.time.delayedCall(250, () => this.explosion(x - 30, y + 20, TILE * 1.5, 'g'));
          } else if (def.vehicle) {
            this.explosion(x, y - (def.air ? 18 : 0), TILE * (0.4 + def.size), def.air ? 'ar' : 'm', !def.air);
          } else {
            this.fx.emit('fumaca', x, y, { count: 4, speed: [20, 60], life: [0.4, 0.7], scale: [0.3, 0.7], alpha: [0.6, 0], tint: 0xb9a888 });
            this.fx.emit('detrito', x, y, { count: 3, speed: [60, 140], life: [0.3, 0.5], grav: 300, spin: 8 });
          }
          break;
        }
        case EV.MONEY:
          if (ev.k === 'onda' || ev.k === 'cedo' || ev.k === 'sup') {
            Sfx.play('coin');
          } else if (st.numbers && ev.v >= 1) this.number(x, y - 24, `+$${Math.round(ev.v)}`, 0xffcc33, 0.9);
          break;
        case EV.LEAK:
          Sfx.play('leak');
          this.onLeak?.(ev.v);
          break;
        case EV.OBST_DOWN: {
          Sfx.play('crack');
          const v = this.obs.find((o, idx) => this.game.obstacles[idx].x === ev.x && this.game.obstacles[idx].y === ev.y);
          if (v) v.shake = 0;
          this.fx.emit('detrito', x, y, { count: 14, speed: [80, 220], life: [0.4, 0.8], grav: 420, spin: 10, scale: [1.6, 1] });
          this.fx.emit('fumaca', x, y, { count: 8, speed: [20, 70], life: [0.6, 1.1], scale: [0.6, 1.5], alpha: [0.7, 0], tint: 0xc9bfa5 });
          this.number(x, y - 30, `+$${ev.v}`, 0xffcc33, 1.3);
          break;
        }
        case EV.OBST_HIT: {
          const idx = this.game.obstacles.findIndex((o) => o.x === ev.x && o.y === ev.y);
          if (idx >= 0) this.obs[idx].shake = 0.12;
          if (Math.random() < 0.3) this.fx.emit('detrito', x, y, { count: 1, speed: [60, 140], life: [0.3, 0.5], grav: 300, spin: 8 });
          break;
        }
        case EV.DISABLED:
          this.fx.emit('faisca', x, y, { count: 12, speed: [80, 200], life: [0.2, 0.4], tint: 0x9fe8ff, add: true, rotateToVel: true });
          Sfx.play('emp');
          break;
        case EV.WAVE:
          Sfx.play('wave');
          this.onWave?.(ev.v);
          break;
        case EV.ABILITY:
          this.ability(ev.k, x, y, ev.v);
          break;
        case EV.BOSS:
          Sfx.play('boss');
          this.onBoss?.(ev.k);
          if (ev.k === 'emp') this.ring(x, y, ev.v * TILE, 0x3fd0ff);
          if (ev.k === 'fumaca') this.fx.emit('fumaca', x, y, { count: 24, spread: ev.v * TILE * 0.6, speed: [20, 60], life: [1.6, 2.6], scale: [1, 2.6], alpha: [0.8, 0], tint: 0xb0aaa0 });
          if (ev.k === 'colosso') this.shake(0.012, 400);
          if (ev.k === 'escudo') this.fx.emit('faisca', x, y, { count: 30, speed: [120, 320], life: [0.3, 0.6], tint: 0x9fe8ff, add: true, rotateToVel: true });
          break;
        case EV.BUILD:
          Sfx.play('build');
          break;
        case EV.UPGRADE:
          Sfx.play('upgrade');
          break;
        case EV.SELL:
          Sfx.play('sell');
          this.fx.emit('fumaca', x, y, { count: 10, speed: [30, 90], life: [0.5, 0.9], scale: [0.5, 1.3], alpha: [0.7, 0], tint: 0xcfc6a8 });
          this.number(x, y - 30, `+$${ev.v}`, 0xffcc33, 1.2);
          break;
        case EV.SHIELD_BREAK:
          Sfx.play('shield');
          this.fx.emit('faisca', x, y, { count: 8, speed: [80, 180], life: [0.2, 0.4], tint: 0x9fe8ff, add: true, rotateToVel: true });
          break;
        case EV.HEAL:
          Sfx.play('heal');
          this.fxTop.emit('px', x, y - 20, { count: 3, spread: 30, speed: [20, 40], angle: [260, 280], life: [0.5, 0.8], scale: [3, 2], alpha: [1, 0], tint: 0x6fcf4a });
          break;
        case EV.KAMIKAZE:
          Sfx.play('kamikaze');
          break;
      }
    }
    q.clear();
  }

  private ability(id: string, x: number, y: number, v: number): void {
    switch (id) {
      case 'aereo': {
        Sfx.play('airstrike');
        const plane = this.scene.add.image(-200, y - 60, 'ic_hab_aereo').setDisplaySize(170, 170).setRotation(Math.PI / 2).setDepth(D.air + 5).setTint(0x59636b);
        const sh = this.scene.add.image(-200, y + 40, 'ic_hab_aereo').setDisplaySize(170, 170).setRotation(Math.PI / 2).setDepth(D.airShadow).setTint(0x000000).setAlpha(0.3);
        this.scene.tweens.add({ targets: [plane, sh], x: MAP_W + 300, duration: 1600, onComplete: () => { plane.destroy(); sh.destroy(); } });
        break;
      }
      case 'minas':
        Sfx.play('mine');
        break;
      case 'arame':
        Sfx.play('build');
        break;
      case 'napalm':
        Sfx.play('airstrike');
        this.scene.time.delayedCall(300, () => this.explosion(x, y, v * TILE, 'm', false));
        break;
      case 'emp':
        Sfx.play('emp');
        this.ring(x, y, v * TILE, 0x3fd0ff);
        this.fx.emit('glow', x, y, { count: 1, life: [0.3, 0.3], scale: [1, 4], alpha: [0.8, 0], tint: 0x3fd0ff, add: true });
        break;
      case 'reforcos':
        Sfx.play('squad');
        break;
      case 'suprimentos': {
        Sfx.play('supply');
        const crate = this.scene.add.image(MAP_W / 2, MAP_Y - 40, 'ic_hab_suprimentos').setDisplaySize(90, 90).setDepth(D.air + 5);
        this.scene.tweens.add({ targets: crate, y: MAP_Y + 140, duration: 900, ease: 'Sine.out', onComplete: () => this.scene.tweens.add({ targets: crate, alpha: 0, duration: 400, onComplete: () => crate.destroy() }) });
        break;
      }
    }
  }

  // ------------------------------------------------------------ utilidades visuais
  explosion(x: number, y: number, radius: number, kind: string, decal = true): void {
    const r = Math.max(20, radius);
    const big = kind === 'g' || kind === 'barril';
    if (kind === 'p') {
      Sfx.play('smallboom');
      this.fx.emit('glow', x, y, { count: 1, life: [0.12, 0.12], scale: [0.4, 0.9], alpha: [1, 0], tint: 0xffd27a, add: true });
      this.fx.emit('fumaca', x, y, { count: 2, speed: [10, 40], life: [0.3, 0.5], scale: [0.2, 0.5], alpha: [0.6, 0], tint: 0x999999 });
      return;
    }
    if (kind === 'ar') {
      Sfx.play('smallboom');
      this.fx.emit('glow', x, y, { count: 1, life: [0.18, 0.18], scale: [0.5, r / 30], alpha: [1, 0], tint: 0xffe0a0, add: true });
      this.fx.emit('fogo', x, y, { count: 5, speed: [40, 120], life: [0.2, 0.4], scale: [0.5, 0.2], add: true });
      this.fx.emit('fumaca', x, y, { count: 4, speed: [20, 60], life: [0.5, 0.9], scale: [0.3, 0.9], alpha: [0.6, 0], tint: 0x666666 });
      this.fx.emit('detrito', x, y, { count: 4, speed: [80, 180], life: [0.4, 0.7], grav: 380, spin: 10 });
      return;
    }
    Sfx.play(big ? 'bigboom' : 'boom');
    const n = big ? 1.8 : 1;
    this.fx.emit('glow', x, y, { count: 1, life: [0.2, 0.2], scale: [0.6, (r / 32) * 1.4], alpha: [1, 0], tint: 0xfff0b0, add: true });
    this.fx.emit('fogo', x, y, { count: Math.round(10 * n), speed: [r * 0.6, r * 2.2], life: [0.25, 0.5], scale: [0.9, 0.2], alpha: [1, 0], add: true, drag: 3 });
    this.fx.emit('fumaca', x, y, { count: Math.round(8 * n), speed: [r * 0.3, r * 1.1], life: [0.7, 1.4], scale: [0.5, 1.4 * n], alpha: [0.75, 0], tint: [0x4a4a4a, 0x6a6a6a, 0x5a554e], drag: 2 });
    this.fx.emit('detrito', x, y, { count: Math.round(6 * n), speed: [r * 1.5, r * 3.5], life: [0.4, 0.8], grav: 520, spin: 12 });
    this.fx.emit('faisca', x, y, { count: Math.round(6 * n), speed: [r * 2, r * 4], life: [0.15, 0.3], tint: 0xffd27a, add: true, rotateToVel: true });
    if (big) this.ring(x, y, r * 1.2, 0xffe0a0);
    if (decal) {
      const s = (r * 2.2) / 96;
      this.stamp.setScale(s).setRotation(Math.random() * 6.28).setAlpha(0.55);
      this.decals.draw(this.stamp, x - MAP_X, y - MAP_Y);
    }
    if (big) this.shake(0.008, 260);
    else if (r > TILE * 0.9) this.shake(0.003, 140);
  }

  private ring(x: number, y: number, r: number, tint: number): void {
    const img = this.scene.add.image(x, y, 'onda_choque').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(D.fx).setDisplaySize(10, 10);
    this.scene.tweens.add({ targets: img, displayWidth: r * 2, displayHeight: r * 2, alpha: 0, duration: 420, ease: 'Cubic.out', onComplete: () => img.destroy() });
  }

  private muzzle(x: number, y: number, x2: number, y2: number, size: number): void {
    const ang = Math.atan2(ty(y2) - y, tx(x2) - x);
    const mx = x + Math.cos(ang) * TILE * 0.7;
    const my = y + Math.sin(ang) * TILE * 0.7;
    this.fx.emit('glow', mx, my, { count: 1, life: [0.08, 0.08], scale: [0.5 * size, 0.9 * size], alpha: [1, 0], tint: 0xffd27a, add: true });
    this.fx.emit('fumaca', mx, my, { count: 3, speed: [30, 80], angle: [Phaser.Math.RadToDeg(ang) - 25, Phaser.Math.RadToDeg(ang) + 25], life: [0.4, 0.7], scale: [0.3, 0.8], alpha: [0.6, 0], tint: 0xaaaaaa });
  }

  shake(intensity: number, ms: number): void {
    if (!Save.d.settings.shake) return;
    this.scene.cameras.main.shake(ms, intensity);
  }

  private tracer(x1: number, y1: number, x2: number, y2: number, tint: number, life: number): void {
    const tr = this.tracers.find((t) => t.life <= 0);
    if (!tr) return;
    const len = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    tr.life = life;
    tr.img.setVisible(true).setPosition(x2, y2).setRotation(Math.atan2(y2 - y1, x2 - x1)).setDisplaySize(Math.min(len, 160), 4).setTint(tint).setAlpha(1);
  }

  private updateTracers(dt: number): void {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) t.img.setVisible(false);
      else t.img.setAlpha(Math.min(1, t.life * 12));
    }
  }

  number(x: number, y: number, text: string, tint: number, scale = 1): void {
    if (this.numCount > 40) return;
    const f = this.floaters.find((q) => q.life <= 0);
    if (!f) return;
    f.life = 0.8;
    f.vy = -60;
    f.t.setText(text).setPosition(x, y).setVisible(true).setTint(tint).setScale(scale).setAlpha(1);
  }

  private updateFloaters(dt: number): void {
    let n = 0;
    for (const f of this.floaters) {
      if (f.life <= 0) continue;
      n++;
      f.life -= dt;
      f.t.y += f.vy * dt;
      f.vy *= 0.94;
      if (f.life <= 0) f.t.setVisible(false);
      else f.t.setAlpha(Math.min(1, f.life * 3));
    }
    this.numCount = n;
  }

  obstacleIndexAt(o: Obstacle): number {
    return this.game.obstacles.indexOf(o);
  }

  get depths(): typeof D {
    return D;
  }
}

export const DEPTH = D;
export const OUTLINE = C.outline;
