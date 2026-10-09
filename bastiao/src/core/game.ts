import {
  ABILITY_BY_ID, ENEMY_BY_ID, GRID_H, GRID_W, MATRIX, OBSTACLE_BY_ID, SELL_RATE, TOWER_BY_ID,
  earlyBonusRate, starsFor,
} from './data';
import { EV, EventQueue } from './events';
import { Path } from './path';
import { computeMods } from './research';
import { Rng } from './rng';
import type {
  AbilityDef, ArmorClass, DamageType, EnemyDef, LevelData, Mods, ObstacleDef, Priority, TowerDef, TowerMods,
} from './types';

export const CELL_FREE = 0;
export const CELL_PATH = 1;
export const CELL_OBST = 2;
export const CELL_TOWER = 3;

export class Enemy {
  active = false;
  uid = 0;
  def!: EnemyDef;
  cls: ArmorClass = 'INF';
  hp = 0;
  maxHp = 0;
  shield = 0;
  auraShieldMax = 0;
  bossShieldMax = 0;
  path!: Path;
  pathIdx = 0;
  dist = 0;
  off = 0;
  x = 0;
  y = 0;
  a = 0;
  seg = 0;
  speedMult = 1;
  slow = 0;
  stun = 0;
  burnDps = 0;
  burnTime = 0;
  burnSrc: Tower | null = null;
  revealed = false;
  smoke = 0;
  diving = false;
  diveTower: Tower | null = null;
  scanT = 0;
  bossT1 = 0;
  bossT2 = 0;
  bossDown = 0;
  phase = 0;
  wave = 0;
  hitFlash = 0;
  get air(): boolean {
    return !!this.def.air;
  }
  get remaining(): number {
    return this.path.length - this.dist;
  }
}

export interface TowerStats {
  dmg: number;
  rate: number;
  range: number;
  minRange: number;
  aoe: number;
  flight: number;
  projSpeed: number;
  missiles: number;
  coneCos: number;
  burnDps: number;
  burnTime: number;
  rampMax: number;
  rampTime: number;
  slow: number;
  aura: number;
  auraRadius: number;
  auraDmg: number;
  reveal: boolean;
  crit: number;
  vs: Record<ArmorClass, number>;
  auraRangeBonus: number;
  auraDmgBonus: number;
}

export class Tower {
  active = true;
  uid = 0;
  def: TowerDef;
  level = 0;
  cx = 0;
  cy = 0;
  x = 0;
  y = 0;
  invested = 0;
  priority: Priority = 0;
  cooldown = 0;
  retarget = 0;
  target: Enemy | null = null;
  targetUid = 0;
  targetObs: Obstacle | null = null;
  angle = -Math.PI / 2;
  disabled = 0;
  rampT = 0;
  rampUid = -1;
  firing = false;
  flameTick = 0;
  burstLeft = 0;
  burstT = 0;
  numAcc = 0;
  numT = 0;
  temp = false;
  life = 0;
  dmgDealt = 0;
  kills = 0;
  shots = 0; // contador para a camada visual (recuo)
  stats: TowerStats;
  constructor(def: TowerDef) {
    this.def = def;
    this.stats = {
      dmg: 0, rate: 0, range: 0, minRange: 0, aoe: 0, flight: 1, projSpeed: 10, missiles: 1, coneCos: 1,
      burnDps: 0, burnTime: 0, rampMax: 1, rampTime: 1, slow: 0, aura: 0, auraRadius: 0, auraDmg: 0,
      reveal: false, crit: 0, vs: { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 }, auraRangeBonus: 0, auraDmgBonus: 0,
    };
  }
  get canGround(): boolean {
    return this.def.targets === 'ground' || this.def.targets === 'both';
  }
  get canAir(): boolean {
    return this.def.targets === 'air' || this.def.targets === 'both';
  }
}

export class Obstacle {
  alive = true;
  marked = false;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  constructor(public idx: number, public def: ObstacleDef, public cx: number, public cy: number) {
    this.hp = this.maxHp = def.hp;
    this.x = cx + 0.5;
    this.y = cy + 0.5;
  }
}

export type ProjKind = 'shell' | 'mortar' | 'missile';
export class Projectile {
  active = false;
  kind: ProjKind = 'shell';
  x = 0;
  y = 0;
  sx = 0;
  sy = 0;
  tx = 0;
  ty = 0;
  t = 0;
  tTotal = 1;
  speed = 10;
  dmg = 0;
  dtype: DamageType = 'PER';
  aoe = 0;
  target: Enemy | null = null;
  targetUid = 0;
  obs: Obstacle | null = null;
  tower: Tower | null = null;
  a = 0;
}

export type ZoneKind = 'strike' | 'mine' | 'napalm' | 'wire';
export class Zone {
  active = false;
  kind: ZoneKind = 'mine';
  x = 0;
  y = 0;
  r = 1;
  t = 0;
  dmg = 0;
  slow = 0;
  trigger = 0.45;
}

export interface AbilitySlot {
  def: AbilityDef;
  cd: number;
  maxCd: number;
}

export interface GameOptions {
  mods?: Mods;
  researched?: Iterable<string>;
  abilities?: string[];
  seed?: number;
  events?: boolean;
}

const ENEMY_POOL = 360;
const PROJ_POOL = 420;
const ZONE_POOL = 48;

const SQUAD_DEF: TowerDef = {
  id: 'squad', name: 'Reforços', short: 'Reforços', role: '', dmgType: 'BAL', targets: 'both', attack: 'hitscan',
  unlock: 99, levels: [{ cost: 0, dmg: 14, rate: 5, range: 2.5 }],
};

interface SpawnGroup {
  def: EnemyDef;
  left: number;
  timer: number;
  interval: number;
  path: number;
}

export class Game {
  readonly level: LevelData;
  readonly mods: Mods;
  readonly events: EventQueue;
  readonly rng: Rng;
  readonly paths: Path[] = [];
  readonly airPaths: Path[] = [];
  readonly grid = new Uint8Array(GRID_W * GRID_H);
  readonly obstacleAt = new Int16Array(GRID_W * GRID_H).fill(-1);
  readonly obstacles: Obstacle[] = [];
  readonly towers: Tower[] = [];
  readonly enemyPool: Enemy[] = [];
  readonly alive: Enemy[] = [];
  readonly projPool: Projectile[] = [];
  readonly zones: Zone[] = [];
  readonly abilities: AbilitySlot[] = [];

  time = 0;
  money = 0;
  lives = 0;
  maxLives = 0;
  waveIdx = -1; // última onda iniciada
  state: 'idle' | 'spawning' | 'countdown' | 'final' | 'won' | 'lost' = 'countdown';
  /** Tutorial pode segurar a contagem. */
  holdCountdown = false;
  countdown = 0;
  markedObs: Obstacle | null = null;
  speedFactor = 1;
  private groups: SpawnGroup[] = [];
  private auraT = 0;
  private healT = 0;
  private uidSeq = 1;
  private auraDirty = true;
  private revealSrc: { x: number; y: number; r2: number }[] = [];
  private slowSrc: { x: number; y: number; r2: number; slow: number }[] = [];

  // estatísticas
  stat = { kills: 0, earnKills: 0, earnWaves: 0, earnObst: 0, earnEarly: 0, earnSupply: 0, spent: 0, livesLost: 0, leaks: 0 };

  constructor(level: LevelData, opts: GameOptions = {}) {
    this.level = level;
    this.mods = opts.mods ?? computeMods(opts.researched ?? []);
    this.events = new EventQueue();
    this.events.enabled = opts.events ?? true;
    this.rng = new Rng(opts.seed ?? 12345);
    this.money = level.startMoney;
    this.lives = this.maxLives = level.lives;
    this.countdown = (level as any).firstDelay ?? 30;
    for (const p of level.paths) this.paths.push(new Path(p, false));
    for (const p of level.airPaths ?? []) this.airPaths.push(new Path(p, true));
    // marca o caminho na grade
    for (const p of this.paths) {
      for (let i = 0; i < p.sx.length; i++) {
        const cx = Math.floor(p.sx[i]);
        const cy = Math.floor(p.sy[i]);
        if (cx >= 0 && cy >= 0 && cx < GRID_W && cy < GRID_H) this.grid[cy * GRID_W + cx] = CELL_PATH;
      }
    }
    for (const o of level.obstacles) {
      const def = OBSTACLE_BY_ID[o.type];
      if (!def) continue;
      const idx = o.y * GRID_W + o.x;
      if (this.grid[idx] !== CELL_FREE) continue;
      const ob = new Obstacle(this.obstacles.length, def, o.x, o.y);
      this.obstacles.push(ob);
      this.grid[idx] = CELL_OBST;
      this.obstacleAt[idx] = ob.idx;
    }
    for (let i = 0; i < ENEMY_POOL; i++) this.enemyPool.push(new Enemy());
    for (let i = 0; i < PROJ_POOL; i++) this.projPool.push(new Projectile());
    for (let i = 0; i < ZONE_POOL; i++) this.zones.push(new Zone());
    const abil = opts.abilities ?? level.abilities.slice(0, 3);
    for (const id of abil) {
      const def = ABILITY_BY_ID[id];
      if (!def) continue;
      const maxCd = def.cooldown * (1 + this.mods.abilities[id].cd);
      this.abilities.push({ def, cd: 0, maxCd });
    }
  }

  // ---------------------------------------------------------------- consultas
  get totalWaves(): number {
    return this.level.waves.length;
  }
  get over(): boolean {
    return this.state === 'won' || this.state === 'lost';
  }
  get stars(): number {
    return this.state === 'won' ? starsFor(this.lives) : 0;
  }
  cell(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return -1;
    return this.grid[cy * GRID_W + cx];
  }
  towerAt(cx: number, cy: number): Tower | null {
    for (const t of this.towers) if (!t.temp && t.cx === cx && t.cy === cy) return t;
    return null;
  }
  obstacleAtCell(cx: number, cy: number): Obstacle | null {
    if (cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return null;
    const i = this.obstacleAt[cy * GRID_W + cx];
    return i >= 0 && this.obstacles[i].alive ? this.obstacles[i] : null;
  }
  towerMods(id: string): TowerMods {
    return this.mods.towers[id];
  }
  buildCost(id: string): number {
    const def = TOWER_BY_ID[id];
    return Math.round(def.levels[0].cost * (1 + this.mods.towers[id].cost));
  }
  upgradeCost(t: Tower): number {
    if (t.level >= t.def.levels.length - 1) return 0;
    return Math.round(t.def.levels[t.level + 1].cost * (1 + this.mods.towers[t.def.id].upg));
  }
  sellValue(t: Tower): number {
    return Math.floor(t.invested * SELL_RATE);
  }
  isUnlocked(id: string): boolean {
    return this.level.towers.includes(id);
  }
  canBuildAt(cx: number, cy: number): boolean {
    return this.cell(cx, cy) === CELL_FREE;
  }
  /** Tipos de inimigo (e quantidades) da próxima onda. */
  nextWavePreview(): { id: string; count: number }[] {
    const w = this.level.waves[this.waveIdx + 1];
    if (!w) return [];
    const map = new Map<string, number>();
    for (const g of w.groups) map.set(g.enemy, (map.get(g.enemy) ?? 0) + g.count);
    return [...map.entries()].map(([id, count]) => ({ id, count }));
  }
  earlyBonus(): number {
    if (this.state !== 'countdown' || this.holdCountdown) return 0;
    return Math.round(this.countdown * earlyBonusRate(this.waveIdx + 2));
  }
  hpFor(def: EnemyDef, wave: number): number {
    const growth = (this.level as any).waveHpGrowth ?? 0.03;
    return Math.round(def.hp * this.level.hpMult * (1 + growth * wave));
  }

  // ---------------------------------------------------------------- comandos
  build(id: string, cx: number, cy: number): Tower | null {
    if (this.over || !this.isUnlocked(id) || !this.canBuildAt(cx, cy)) return null;
    const cost = this.buildCost(id);
    if (this.money < cost) return null;
    const t = new Tower(TOWER_BY_ID[id]);
    t.uid = this.uidSeq++;
    t.cx = cx;
    t.cy = cy;
    t.x = cx + 0.5;
    t.y = cy + 0.5;
    t.invested = cost;
    if (id === 'at' || id === 'sn' || id === 'la') t.priority = 2;
    this.money -= cost;
    this.stat.spent += cost;
    this.towers.push(t);
    this.grid[cy * GRID_W + cx] = CELL_TOWER;
    this.auraDirty = true;
    this.events.push(EV.BUILD, t.x, t.y, 0, id);
    return t;
  }
  upgrade(t: Tower): boolean {
    if (this.over || t.level >= t.def.levels.length - 1) return false;
    const cost = this.upgradeCost(t);
    if (this.money < cost) return false;
    this.money -= cost;
    this.stat.spent += cost;
    t.invested += cost;
    t.level++;
    this.auraDirty = true;
    this.events.push(EV.UPGRADE, t.x, t.y, t.level + 1, t.def.id);
    return true;
  }
  sell(t: Tower): number {
    if (this.over || !t.active || t.temp) return 0;
    const v = this.sellValue(t);
    this.money += v;
    this.stat.spent -= v;
    t.active = false;
    const i = this.towers.indexOf(t);
    if (i >= 0) this.towers.splice(i, 1);
    this.grid[t.cy * GRID_W + t.cx] = CELL_FREE;
    this.auraDirty = true;
    this.events.push(EV.SELL, t.x, t.y, v, t.def.id);
    return v;
  }
  setPriority(t: Tower, p: Priority): void {
    t.priority = p;
    t.retarget = 0;
  }
  toggleMark(o: Obstacle): void {
    if (!o.alive) return;
    if (this.markedObs === o) {
      o.marked = false;
      this.markedObs = null;
    } else {
      if (this.markedObs) this.markedObs.marked = false;
      o.marked = true;
      this.markedObs = o;
    }
    for (const t of this.towers) t.retarget = 0;
  }
  /** Inicia a próxima onda (com bônus se ainda havia contagem). */
  callWave(): number {
    if (this.state !== 'idle' && this.state !== 'countdown') return 0;
    let bonus = 0;
    if (this.state === 'countdown') {
      bonus = this.earlyBonus();
      if (bonus > 0) {
        this.money += bonus;
        this.stat.earnEarly += bonus;
        this.events.push(EV.MONEY, 12, 0.6, bonus, 'cedo');
      }
    }
    this.startWave();
    return bonus;
  }

  /** Usa uma habilidade. Retorna false se não puder. */
  cast(slot: number, x: number, y: number): boolean {
    const s = this.abilities[slot];
    if (!s || s.cd > 0 || this.over) return false;
    const def = s.def;
    const m = this.mods.abilities[def.id];
    const p = def.params;
    const power = 1 + m.power;
    const rad = 1 + m.radius;
    const dur = 1 + m.duration;
    if (def.target === 'path') {
      const near = this.nearestGroundPath(x, y);
      if (!near || near.dist2 > 1.6 * 1.6) return false;
      const path = this.paths[near.idx];
      const pos = { x: 0, y: 0, a: 0, seg: 0 };
      if (def.id === 'minas') {
        const n = p.count;
        for (let i = 0; i < n; i++) {
          const z = this.allocZone();
          if (!z) break;
          path.posAt(near.d + (i - (n - 1) / 2) * 0.7, pos);
          z.kind = 'mine';
          z.x = pos.x;
          z.y = pos.y;
          z.r = p.radius * rad;
          z.dmg = p.dmg * power;
          z.t = p.life;
          z.trigger = 0.45;
        }
        this.events.push(EV.ABILITY, x, y, p.radius * rad, def.id);
      } else if (def.id === 'arame') {
        const z = this.allocZone();
        if (!z) return false;
        path.posAt(near.d, pos);
        z.kind = 'wire';
        z.x = pos.x;
        z.y = pos.y;
        z.r = p.radius * rad;
        z.slow = Math.min(0.8, p.slow * power);
        z.t = p.duration * dur;
        this.events.push(EV.ABILITY, z.x, z.y, z.r, def.id);
      }
    } else if (def.id === 'aereo') {
      const z = this.allocZone();
      if (!z) return false;
      z.kind = 'strike';
      z.x = x;
      z.y = y;
      z.r = p.radius * rad;
      z.dmg = p.dmg * power;
      z.t = p.delay;
      this.events.push(EV.ABILITY, x, y, z.r, def.id);
    } else if (def.id === 'napalm') {
      const z = this.allocZone();
      if (!z) return false;
      z.kind = 'napalm';
      z.x = x;
      z.y = y;
      z.r = p.radius * rad;
      z.dmg = p.dps * power;
      z.t = p.duration * dur;
      this.events.push(EV.ABILITY, x, y, z.r, def.id);
    } else if (def.id === 'emp') {
      const r = p.radius * rad;
      const r2 = r * r;
      const stun = p.stun * dur;
      for (let i = 0; i < this.alive.length; i++) {
        const e = this.alive[i];
        if (!e.active) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        if (dx * dx + dy * dy > r2) continue;
        if (e.shield > 0) {
          e.shield = 0;
          this.events.push(EV.SHIELD_BREAK, e.x, e.y);
          if (e.def.boss === 'fortaleza') this.fortalezaBreak(e);
        }
        if (e.def.vehicle || e.def.air) e.stun = Math.max(e.stun, e.def.boss ? stun * 0.3 : stun);
        this.damageEnemy(e, p.dmg * power, 'ENE', null);
      }
      this.events.push(EV.ABILITY, x, y, r, def.id);
    } else if (def.id === 'reforcos') {
      const t = new Tower(SQUAD_DEF);
      t.uid = this.uidSeq++;
      t.temp = true;
      t.x = x;
      t.y = y;
      t.cx = -10;
      t.cy = -10;
      t.life = p.duration * dur;
      this.computeStats(t);
      t.stats.dmg = (p.dps / 5) * power;
      t.stats.range = p.range * rad;
      this.towers.push(t);
      this.events.push(EV.ABILITY, x, y, t.stats.range, def.id);
    } else if (def.id === 'suprimentos') {
      const money = Math.round(p.money * power);
      this.money += money;
      this.stat.earnSupply += money;
      this.lives = Math.min(this.maxLives, this.lives + p.lives);
      this.events.push(EV.ABILITY, x, y, money, def.id);
      this.events.push(EV.MONEY, x, y, money, 'sup');
    } else {
      return false;
    }
    s.cd = s.maxCd;
    return true;
  }

  nearestGroundPath(x: number, y: number): { idx: number; d: number; dist2: number } | null {
    let best: { idx: number; d: number; dist2: number } | null = null;
    for (let i = 0; i < this.paths.length; i++) {
      const n = this.paths[i].nearestDist(x, y);
      if (!best || n.dist2 < best.dist2) best = { idx: i, d: n.d, dist2: n.dist2 };
    }
    return best;
  }

  // ---------------------------------------------------------------- simulação
  step(dt: number): void {
    if (this.over) return;
    this.time += dt;
    this.updateWaves(dt);
    if (this.auraDirty) this.recomputeAuras();
    this.auraT -= dt;
    if (this.auraT <= 0) {
      this.auraT = 0.2;
      this.updateEnemyAuras();
    }
    this.healT -= dt;
    if (this.healT <= 0) {
      this.healT = 0.5;
      this.updateHeal(0.5);
    }
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    for (const s of this.abilities) if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
    this.compact();
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = 'lost';
      this.events.push(EV.DEFEAT, 0, 0);
    } else if (this.state === 'final' && this.alive.length === 0) {
      this.state = 'won';
      this.events.push(EV.VICTORY, 0, 0, this.stars);
    }
  }

  private startWave(): void {
    this.waveIdx++;
    const w = this.level.waves[this.waveIdx];
    this.groups.length = 0;
    for (const g of w.groups) {
      const def = ENEMY_BY_ID[g.enemy];
      this.groups.push({ def, left: g.count, timer: g.delay, interval: g.interval, path: g.path });
    }
    this.state = 'spawning';
    this.events.push(EV.WAVE, 0, 0, this.waveIdx + 1);
  }

  private updateWaves(dt: number): void {
    if (this.state === 'spawning') {
      let pending = false;
      for (const g of this.groups) {
        if (g.left <= 0) continue;
        pending = true;
        g.timer -= dt;
        while (g.left > 0 && g.timer <= 0) {
          const paths = g.def.air ? this.airPaths : this.paths;
          const path = paths[Math.min(g.path, paths.length - 1)];
          this.spawn(g.def, path, Math.min(g.path, paths.length - 1), 0, this.waveIdx);
          g.left--;
          g.timer += g.interval;
        }
      }
      if (!pending) {
        const bonus = this.level.waves[this.waveIdx].bonus;
        if (bonus > 0) {
          this.money += bonus;
          this.stat.earnWaves += bonus;
          this.events.push(EV.MONEY, 12, 0.6, bonus, 'onda');
        }
        if (this.waveIdx >= this.level.waves.length - 1) this.state = 'final';
        else {
          this.state = 'countdown';
          this.countdown = this.level.waveGap;
        }
      }
    } else if (this.state === 'countdown') {
      if (this.holdCountdown) return;
      this.countdown -= dt;
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.startWave();
      }
    }
  }

  spawn(def: EnemyDef, path: Path, pathIdx: number, dist: number, wave: number): Enemy | null {
    let e: Enemy | null = null;
    for (let i = 0; i < this.enemyPool.length; i++) {
      if (!this.enemyPool[i].active) {
        e = this.enemyPool[i];
        break;
      }
    }
    if (!e) return null;
    e.active = true;
    e.uid = this.uidSeq++;
    e.def = def;
    e.cls = def.cls;
    e.maxHp = e.hp = this.hpFor(def, wave);
    e.shield = 0;
    e.auraShieldMax = 0;
    e.bossShieldMax = 0;
    e.path = path;
    e.pathIdx = pathIdx;
    e.dist = dist;
    e.off = def.boss ? 0 : this.rng.range(-0.22, 0.22);
    e.seg = 0;
    e.speedMult = 1;
    e.slow = 0;
    e.stun = 0;
    e.burnDps = 0;
    e.burnTime = 0;
    e.burnSrc = null;
    e.revealed = !def.camo;
    e.smoke = 0;
    e.diving = false;
    e.diveTower = null;
    e.scanT = this.rng.next() * 0.25;
    e.bossT1 = 0;
    e.bossT2 = 0;
    e.bossDown = 0;
    e.phase = 0;
    e.wave = wave;
    e.hitFlash = 0;
    if (def.boss === 'fortaleza') {
      e.bossShieldMax = e.maxHp * (def.bossParams!.shieldPct as number);
      e.shield = e.bossShieldMax;
    }
    this.placeEnemy(e);
    this.alive.push(e);
    return e;
  }

  private placeEnemy(e: Enemy): void {
    e.path.posAt(e.dist, e);
    if (e.off !== 0) {
      e.x += -Math.sin(e.a) * e.off;
      e.y += Math.cos(e.a) * e.off;
    }
  }

  private allocZone(): Zone | null {
    for (const z of this.zones) if (!z.active) {
      z.active = true;
      return z;
    }
    return null;
  }

  private allocProj(): Projectile | null {
    for (const p of this.projPool) if (!p.active) {
      p.active = true;
      return p;
    }
    return null;
  }

  private compact(): void {
    let j = 0;
    for (let i = 0; i < this.alive.length; i++) {
      const e = this.alive[i];
      if (e.active) this.alive[j++] = e;
    }
    this.alive.length = j;
  }

  // ---------------------------------------------------------------- auras
  private recomputeAuras(): void {
    this.auraDirty = false;
    const supports = this.towers.filter((t) => t.def.attack === 'support' && t.active);
    for (const t of this.towers) this.computeStats(t);
    for (const t of this.towers) {
      if (t.def.attack === 'support' || t.temp) continue;
      let rb = 0;
      let db = 0;
      for (const s of supports) {
        const dx = s.x - t.x;
        const dy = s.y - t.y;
        const r = s.stats.auraRadius;
        if (dx * dx + dy * dy <= r * r + 0.01) {
          rb = Math.max(rb, s.stats.aura);
          db = Math.max(db, s.stats.auraDmg);
        }
      }
      t.stats.auraRangeBonus = rb;
      t.stats.auraDmgBonus = db;
      t.stats.range *= 1 + rb;
      t.stats.dmg *= 1 + db;
    }
    this.revealSrc.length = 0;
    this.slowSrc.length = 0;
    for (const t of this.towers) {
      if (t.stats.reveal) this.revealSrc.push({ x: t.x, y: t.y, r2: t.stats.range * t.stats.range });
      if (t.def.attack === 'support') this.slowSrc.push({ x: t.x, y: t.y, r2: t.stats.range * t.stats.range, slow: t.stats.slow });
    }
  }

  computeStats(t: Tower): void {
    if (t.temp) {
      const b = t.def.levels[0];
      t.stats.dmg = b.dmg!;
      t.stats.rate = b.rate!;
      t.stats.range = b.range;
      return;
    }
    const b = t.def.levels[t.level];
    const m = this.mods.towers[t.def.id];
    const s = t.stats;
    s.dmg = (b.dmg ?? 0) * (1 + m.dmg);
    s.rate = (b.rate ?? 0) * (1 + m.rate);
    s.range = b.range * (1 + (t.def.attack === 'support' ? m.reveal : m.range));
    s.minRange = (b.minRange ?? 0) * (1 + m.minRange);
    s.aoe = (b.aoe ?? 0) * (1 + m.aoe);
    s.flight = b.flight ?? 1;
    s.projSpeed = b.projSpeed ?? 10;
    s.missiles = b.missiles ?? 1;
    s.coneCos = Math.cos((((b.cone ?? 0) / 2) * Math.PI) / 180);
    s.burnDps = (b.burnDps ?? 0) * (1 + m.burn);
    s.burnTime = b.burnTime ?? 0;
    s.rampMax = 1 + ((b.rampMax ?? 1) - 1) * (1 + m.ramp);
    s.rampTime = (b.rampTime ?? 1) / (1 + m.rampSpeed);
    s.slow = Math.min(0.6, (b.slow ?? 0) * (1 + m.slow));
    s.aura = (b.aura ?? 0) * (1 + m.aura);
    s.auraRadius = b.auraRadius ?? 0;
    s.auraDmg = (b.auraDmg ?? 0) + (t.def.attack === 'support' ? m.auraDmg : 0);
    s.reveal = t.def.attack === 'support' || !!b.revealCamo;
    s.crit = m.crit;
    s.vs = m.vs;
    s.auraRangeBonus = 0;
    s.auraDmgBonus = 0;
  }

  private updateEnemyAuras(): void {
    // revelação de camuflados
    for (let i = 0; i < this.alive.length; i++) {
      const e = this.alive[i];
      if (!e.def.camo) continue;
      let rev = false;
      for (const s of this.revealSrc) {
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        if (dx * dx + dy * dy <= s.r2) {
          rev = true;
          break;
        }
      }
      e.revealed = rev;
    }
    // escudo dos geradores
    for (let i = 0; i < this.alive.length; i++) this.alive[i].auraShieldMax = 0;
    for (let i = 0; i < this.alive.length; i++) {
      const g = this.alive[i];
      const sa = g.def.shieldAura;
      if (!sa || !g.active) continue;
      const r2 = sa.radius * sa.radius;
      for (let j = 0; j < this.alive.length; j++) {
        const e = this.alive[j];
        if (e === g || !e.active || e.def.boss) continue;
        const dx = e.x - g.x;
        const dy = e.y - g.y;
        if (dx * dx + dy * dy <= r2) e.auraShieldMax = Math.max(e.auraShieldMax, Math.min(sa.cap, e.maxHp * sa.pct));
      }
    }
  }

  private updateHeal(dt: number): void {
    for (let i = 0; i < this.alive.length; i++) {
      const h = this.alive[i];
      const hd = h.def.heal;
      if (!hd || !h.active) continue;
      const r2 = hd.radius * hd.radius;
      let healed = false;
      for (let j = 0; j < this.alive.length; j++) {
        const e = this.alive[j];
        if (e === h || !e.active || e.def.boss || e.hp >= e.maxHp) continue;
        const dx = e.x - h.x;
        const dy = e.y - h.y;
        if (dx * dx + dy * dy <= r2) {
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * hd.pct * dt);
          healed = true;
        }
      }
      if (healed) this.events.push(EV.HEAL, h.x, h.y);
    }
  }

  // ---------------------------------------------------------------- inimigos
  private updateEnemies(dt: number): void {
    for (let i = 0; i < this.alive.length; i++) {
      const e = this.alive[i];
      if (!e.active) continue;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.smoke > 0) e.smoke -= dt;
      // queimadura
      if (e.burnTime > 0) {
        e.burnTime -= dt;
        this.damageEnemy(e, e.burnDps * dt, 'FOG', e.burnSrc, false);
        if (!e.active) continue;
      }
      // escudo do gerador
      if (e.auraShieldMax > 0 && e.shield < e.auraShieldMax) {
        const regen = 40;
        e.shield = Math.min(e.auraShieldMax, e.shield + regen * dt);
      }
      if (e.def.boss) {
        this.updateBoss(e, dt);
        if (!e.active) continue;
      }
      // lentidão: radar (veículos) e arame (terrestres)
      let slow = 0;
      if (e.def.vehicle) {
        for (const s of this.slowSrc) {
          const dx = e.x - s.x;
          const dy = e.y - s.y;
          if (dx * dx + dy * dy <= s.r2 && s.slow > slow) slow = s.slow;
        }
      }
      if (!e.def.air) {
        for (const z of this.zones) {
          if (!z.active || z.kind !== 'wire') continue;
          const dx = e.x - z.x;
          const dy = e.y - z.y;
          if (dx * dx + dy * dy <= z.r * z.r) {
            const zs = e.def.vehicle ? z.slow * 0.6 : z.slow;
            if (zs > slow) slow = zs;
          }
        }
      }
      if (e.def.boss) slow *= 0.5;
      e.slow = slow;
      if (e.stun > 0) {
        e.stun -= dt;
        continue;
      }
      // kamikaze
      const kz = e.def.kamikaze;
      if (kz) {
        if (!e.diving) {
          e.scanT -= dt;
          if (e.scanT <= 0) {
            e.scanT = 0.25;
            let best: Tower | null = null;
            let bd = kz.radius * kz.radius;
            for (const t of this.towers) {
              if (!t.active || t.temp || t.disabled > 0) continue;
              const dx = t.x - e.x;
              const dy = t.y - e.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < bd) {
                bd = d2;
                best = t;
              }
            }
            if (best) {
              e.diving = true;
              e.diveTower = best;
            }
          }
        }
        if (e.diving) {
          const t = e.diveTower!;
          const dx = t.x - e.x;
          const dy = t.y - e.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const stepLen = kz.diveSpeed * dt;
          e.a = Math.atan2(dy, dx);
          if (d <= stepLen + 0.2 || !t.active) {
            this.kamikazeBlast(e);
          } else {
            e.x += (dx / d) * stepLen;
            e.y += (dy / d) * stepLen;
          }
          continue;
        }
      }
      // movimento no caminho
      const speed = e.def.speed * e.speedMult * (1 - slow);
      e.dist += speed * dt;
      if (e.dist >= e.path.length) {
        e.active = false;
        const lost = Math.min(e.def.lives, this.lives);
        this.lives -= e.def.lives;
        this.stat.livesLost += lost;
        this.stat.leaks++;
        this.events.push(EV.LEAK, e.x, e.y, e.def.lives, e.def.id);
        continue;
      }
      this.placeEnemy(e);
    }
  }

  private kamikazeBlast(e: Enemy): void {
    const kz = e.def.kamikaze!;
    const r2 = kz.blast * kz.blast;
    for (const t of this.towers) {
      if (!t.active || t.temp) continue;
      const dx = t.x - e.x;
      const dy = t.y - e.y;
      if (dx * dx + dy * dy <= r2 + 0.3) {
        t.disabled = Math.max(t.disabled, kz.disable);
        this.events.push(EV.DISABLED, t.x, t.y, kz.disable);
      }
    }
    e.active = false;
    this.events.push(EV.KAMIKAZE, e.x, e.y);
    this.events.push(EV.EXPLOSION, e.x, e.y, kz.blast, 'm');
  }

  private updateBoss(e: Enemy, dt: number): void {
    const p = e.def.bossParams!;
    switch (e.def.boss) {
      case 'escorpiao': {
        e.bossT1 += dt;
        if (e.bossT1 >= p.every) {
          e.bossT1 = 0;
          const r2 = p.smokeRadius * p.smokeRadius;
          for (const o of this.alive) {
            if (!o.active) continue;
            const dx = o.x - e.x;
            const dy = o.y - e.y;
            if (dx * dx + dy * dy <= r2) o.smoke = p.smokeTime;
          }
          this.events.push(EV.BOSS, e.x, e.y, p.smokeRadius, 'fumaca');
        }
        break;
      }
      case 'fortaleza': {
        if (e.bossDown > 0) e.bossDown -= dt;
        else if (e.shield < e.bossShieldMax) e.shield = Math.min(e.bossShieldMax, e.shield + e.bossShieldMax * p.regenPct * dt);
        break;
      }
      case 'ciclope': {
        e.bossT1 += dt;
        e.bossT2 += dt;
        if (e.bossT1 >= p.empEvery) {
          e.bossT1 = 0;
          const r2 = p.empRadius * p.empRadius;
          for (const t of this.towers) {
            if (!t.active || t.temp) continue;
            const dx = t.x - e.x;
            const dy = t.y - e.y;
            if (dx * dx + dy * dy <= r2) {
              t.disabled = Math.max(t.disabled, p.empTime);
              this.events.push(EV.DISABLED, t.x, t.y, p.empTime);
            }
          }
          this.events.push(EV.BOSS, e.x, e.y, p.empRadius, 'emp');
        }
        if (e.bossT2 >= p.dronesEvery) {
          e.bossT2 = 0;
          const drone = ENEMY_BY_ID['drone'];
          for (let i = 0; i < p.drones; i++) this.spawn(drone, e.path, e.pathIdx, Math.max(0, e.dist - 0.3 * i), e.wave);
          this.events.push(EV.BOSS, e.x, e.y, 0, 'drones');
        }
        break;
      }
    }
  }

  private fortalezaBreak(e: Enemy): void {
    const p = e.def.bossParams!;
    e.bossDown = p.downTime;
    e.stun = Math.max(e.stun, p.stun);
    this.events.push(EV.BOSS, e.x, e.y, 0, 'escudo');
  }

  /** Aplica dano considerando escudo e matriz. Retorna o dano efetivo. */
  damageEnemy(e: Enemy, raw: number, dtype: DamageType, src: Tower | null, show = true): number {
    if (!e.active || raw <= 0) return 0;
    const vs = src ? src.stats.vs : null;
    let dealt = 0;
    if (e.shield > 0) {
      const m = MATRIX[dtype].ESC * (1 + (vs ? vs.ESC : 0));
      if (m <= 0) return 0;
      const eff = raw * m;
      if (eff <= e.shield) {
        e.shield -= eff;
        dealt = eff;
        raw = 0;
      } else {
        dealt = e.shield;
        raw = raw * ((eff - e.shield) / eff);
        e.shield = 0;
        this.events.push(EV.SHIELD_BREAK, e.x, e.y);
        if (e.def.boss === 'fortaleza') this.fortalezaBreak(e);
      }
    }
    if (raw > 0) {
      const m2 = MATRIX[dtype][e.cls] * (1 + (vs ? vs[e.cls] : 0));
      const eff = raw * m2;
      e.hp -= eff;
      dealt += eff;
    }
    if (src) src.dmgDealt += dealt;
    if (show && dealt >= 1) this.events.push(EV.HIT, e.x, e.y - 0.3, dealt, dtype);
    e.hitFlash = 0.08;
    if (e.hp <= 0) this.kill(e, src);
    else if (e.def.boss === 'colosso' && e.phase === 0 && e.hp <= e.maxHp * e.def.bossParams!.phaseAt) {
      const p = e.def.bossParams!;
      e.phase = 1;
      e.cls = p.newCls;
      e.speedMult = p.speedMult;
      const def = ENEMY_BY_ID[p.spawn];
      for (let i = 0; i < p.n; i++) this.spawn(def, e.path, e.pathIdx, Math.max(0, e.dist - 0.35 * i), e.wave);
      this.events.push(EV.BOSS, e.x, e.y, 0, 'colosso');
    }
    return dealt;
  }

  private kill(e: Enemy, src: Tower | null): void {
    e.active = false;
    e.hp = 0;
    this.money += e.def.reward;
    this.stat.kills++;
    this.stat.earnKills += e.def.reward;
    if (src) src.kills++;
    this.events.push(EV.DEATH, e.x, e.y, e.def.air ? 1 : 0, e.def.id);
    this.events.push(EV.MONEY, e.x, e.y, e.def.reward, '');
    const sod = e.def.spawnOnDeath;
    if (sod) {
      const def = ENEMY_BY_ID[sod.id];
      for (let i = 0; i < sod.n; i++) this.spawn(def, e.path, e.pathIdx, Math.max(0, e.dist - 0.25 * i), e.wave);
    }
  }

  damageObstacle(o: Obstacle, raw: number, dtype: DamageType): void {
    if (!o.alive) return;
    const eff = raw * MATRIX[dtype][o.def.cls];
    if (eff <= 0) return;
    o.hp -= eff;
    this.events.push(EV.OBST_HIT, o.x, o.y, eff, dtype);
    if (o.hp <= 0) {
      o.alive = false;
      o.marked = false;
      if (this.markedObs === o) this.markedObs = null;
      const idx = o.cy * GRID_W + o.cx;
      this.grid[idx] = CELL_FREE;
      this.obstacleAt[idx] = -1;
      this.money += o.def.reward;
      this.stat.earnObst += o.def.reward;
      this.events.push(EV.OBST_DOWN, o.x, o.y, o.def.reward, o.def.id);
      this.events.push(EV.MONEY, o.x, o.y, o.def.reward, '');
      if (o.def.explode) {
        this.explode(o.x, o.y, o.def.explode.radius, o.def.explode.dmg, null, false);
        this.events.push(EV.EXPLOSION, o.x, o.y, o.def.explode.radius, 'barril');
      }
      for (const t of this.towers) if (t.targetObs === o) t.targetObs = null;
    }
  }

  /** Explosão em área (terrestre). */
  explode(x: number, y: number, r: number, dmg: number, src: Tower | null, hitObstacle = true): void {
    const r2 = r * r;
    for (let i = 0; i < this.alive.length; i++) {
      const e = this.alive[i];
      if (!e.active || e.def.air) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const f = 1 - 0.5 * (Math.sqrt(d2) / r);
      this.damageEnemy(e, dmg * f, 'EXP', src);
    }
    if (hitObstacle && this.markedObs) {
      const o = this.markedObs;
      const dx = o.x - x;
      const dy = o.y - y;
      if (dx * dx + dy * dy <= (r + 0.4) * (r + 0.4)) this.damageObstacle(o, dmg, 'EXP');
    }
  }

  // ---------------------------------------------------------------- torres
  private targetable(t: Tower, e: Enemy): boolean {
    if (!e.active) return false;
    if (e.def.air ? !t.canAir : !t.canGround) return false;
    if (e.smoke > 0) return false;
    if (e.def.camo && !e.revealed) return false;
    const dx = e.x - t.x;
    const dy = e.y - t.y;
    const d2 = dx * dx + dy * dy;
    const r = t.stats.range;
    const mr = t.stats.minRange;
    return d2 <= r * r && d2 >= mr * mr;
  }

  private obstacleInRange(t: Tower): Obstacle | null {
    const o = this.markedObs;
    if (!o || !o.alive || !t.canGround || t.temp) return null;
    const dx = o.x - t.x;
    const dy = o.y - t.y;
    const d2 = dx * dx + dy * dy;
    const r = t.stats.range + 0.3;
    const mr = t.stats.minRange;
    return d2 <= r * r && d2 >= mr * mr ? o : null;
  }

  private acquire(t: Tower): void {
    t.targetObs = this.obstacleInRange(t);
    if (t.targetObs) {
      t.target = null;
      return;
    }
    // laser mantém o alvo (dano acumulado)
    if (t.def.attack === 'beam' && t.target && t.target.uid === t.targetUid && this.targetable(t, t.target)) return;
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < this.alive.length; i++) {
      const e = this.alive[i];
      if (!this.targetable(t, e)) continue;
      let score: number;
      switch (t.priority) {
        case 0:
          score = -e.remaining;
          break;
        case 1:
          score = e.remaining;
          break;
        case 2:
          score = e.hp + e.shield;
          break;
        default:
          score = -(e.hp + e.shield);
      }
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    t.target = best;
    t.targetUid = best ? best.uid : 0;
  }

  private updateTowers(dt: number): void {
    for (let i = 0; i < this.towers.length; i++) {
      const t = this.towers[i];
      if (!t.active) continue;
      if (t.temp) {
        t.life -= dt;
        if (t.life <= 0) {
          t.active = false;
          this.towers.splice(i, 1);
          i--;
          continue;
        }
      }
      if (t.def.attack === 'support') continue;
      if (t.disabled > 0) {
        t.disabled -= dt;
        t.firing = false;
        continue;
      }
      if (t.cooldown > 0) t.cooldown -= dt;
      t.retarget -= dt;
      const tgtValid = t.target && t.target.uid === t.targetUid && this.targetable(t, t.target);
      const obsValid = t.targetObs && t.targetObs.alive && t.targetObs === this.markedObs;
      if (t.retarget <= 0 || (!tgtValid && !obsValid)) {
        t.retarget = 0.15;
        this.acquire(t);
      }
      const e = t.target && t.target.uid === t.targetUid && t.target.active ? t.target : null;
      const o = t.targetObs && t.targetObs.alive ? t.targetObs : null;
      if (!e && !o) {
        t.firing = false;
        if (t.cooldown < 0) t.cooldown = 0;
        t.rampT = 0;
        continue;
      }
      const tx = e ? e.x : o!.x;
      const ty = e ? e.y : o!.y;
      t.angle = Math.atan2(ty - t.y, tx - t.x);
      switch (t.def.attack) {
        case 'hitscan':
          if (t.cooldown <= 0) {
            t.cooldown += 1 / t.stats.rate;
            if (t.cooldown < 0) t.cooldown = 0;
            let dmg = t.stats.dmg;
            let crit = 0;
            if (t.stats.crit > 0 && this.rng.next() < t.stats.crit) {
              dmg *= 2;
              crit = 1;
            }
            t.shots++;
            this.events.push(EV.SHOT, t.x, t.y, crit, t.def.id, tx, ty);
            if (e) this.damageEnemy(e, dmg, t.def.dmgType, t, t.def.id !== 'mg' && t.def.id !== 'squad');
            else this.damageObstacle(o!, dmg, t.def.dmgType);
          }
          break;
        case 'shell':
          if (t.cooldown <= 0) {
            t.cooldown += 1 / t.stats.rate;
            if (t.cooldown < 0) t.cooldown = 0;
            this.launch(t, 'shell', e, o, tx, ty);
          }
          break;
        case 'mortar':
          if (t.cooldown <= 0) {
            t.cooldown += 1 / t.stats.rate;
            if (t.cooldown < 0) t.cooldown = 0;
            let px = tx;
            let py = ty;
            if (e) {
              // mira preditiva: onde o alvo estará ao fim do voo
              const fut = e.dist + e.def.speed * e.speedMult * (1 - e.slow) * t.stats.flight * (e.stun > 0 ? 0 : 1);
              const pos = { x: 0, y: 0, a: 0, seg: e.seg };
              e.path.posAt(Math.min(fut, e.path.length), pos);
              px = pos.x;
              py = pos.y;
            }
            this.launch(t, 'mortar', e, o, px, py);
          }
          break;
        case 'missile':
          if (t.cooldown <= 0 && t.burstLeft <= 0) {
            t.cooldown += 1 / t.stats.rate;
            if (t.cooldown < 0) t.cooldown = 0;
            t.burstLeft = t.stats.missiles;
            t.burstT = 0;
          }
          if (t.burstLeft > 0) {
            t.burstT -= dt;
            if (t.burstT <= 0 && e) {
              t.burstT = 0.14;
              t.burstLeft--;
              this.launch(t, 'missile', e, null, tx, ty);
            }
          }
          break;
        case 'flame': {
          t.firing = true;
          t.flameTick += dt;
          while (t.flameTick >= 0.1) {
            t.flameTick -= 0.1;
            this.flameTick(t, 0.1, o);
          }
          break;
        }
        case 'beam': {
          t.firing = true;
          const uid = e ? e.uid : -2 - (o ? o.idx : 0);
          if (t.rampUid === uid) t.rampT += dt;
          else {
            t.rampUid = uid;
            t.rampT = 0;
          }
          const f = 1 + (t.stats.rampMax - 1) * Math.min(1, t.rampT / t.stats.rampTime);
          const dmg = t.stats.dmg * f * dt;
          if (e) {
            const d = this.damageEnemy(e, dmg, 'ENE', t, false);
            t.numAcc += d;
          } else this.damageObstacle(o!, dmg, 'ENE');
          t.numT += dt;
          if (t.numT >= 0.5) {
            if (t.numAcc >= 1 && e) this.events.push(EV.HIT, tx, ty - 0.3, t.numAcc, 'ENE');
            t.numT = 0;
            t.numAcc = 0;
          }
          break;
        }
      }
    }
  }

  private flameTick(t: Tower, dt: number, o: Obstacle | null): void {
    const r = t.stats.range;
    const r2 = r * r;
    const ca = Math.cos(t.angle);
    const sa = Math.sin(t.angle);
    const dmg = t.stats.dmg * dt;
    for (let i = 0; i < this.alive.length; i++) {
      const e = this.alive[i];
      if (!e.active || e.def.air) continue;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2);
      if (d > 0.3 && (dx * ca + dy * sa) / d < t.stats.coneCos) continue;
      // fogo atinge camuflados e na fumaça (é área)
      if (t.stats.burnDps > 0) {
        if (t.stats.burnDps >= e.burnDps || e.burnTime <= 0) {
          e.burnDps = t.stats.burnDps;
          e.burnSrc = t;
        }
        e.burnTime = t.stats.burnTime;
      }
      this.damageEnemy(e, dmg, 'FOG', t, false);
    }
    if (o) this.damageObstacle(o, dmg, 'FOG');
  }

  private launch(t: Tower, kind: ProjKind, e: Enemy | null, o: Obstacle | null, tx: number, ty: number): void {
    const p = this.allocProj();
    if (!p) return;
    t.shots++;
    p.kind = kind;
    p.x = p.sx = t.x;
    p.y = p.sy = t.y;
    p.tx = tx;
    p.ty = ty;
    p.t = 0;
    p.tTotal = kind === 'mortar' ? t.stats.flight : 1;
    p.speed = t.stats.projSpeed;
    p.dmg = t.stats.dmg;
    p.dtype = t.def.dmgType;
    p.aoe = t.stats.aoe;
    p.target = e;
    p.targetUid = e ? e.uid : 0;
    p.obs = o;
    p.tower = t;
    p.a = t.angle;
    this.events.push(EV.LAUNCH, t.x, t.y, 0, kind, tx, ty);
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projPool) {
      if (!p.active) continue;
      if (p.kind === 'mortar') {
        p.t += dt;
        const f = Math.min(1, p.t / p.tTotal);
        p.x = p.sx + (p.tx - p.sx) * f;
        p.y = p.sy + (p.ty - p.sy) * f;
        if (f >= 1) {
          p.active = false;
          this.explode(p.tx, p.ty, p.aoe, p.dmg, p.tower, true);
          this.events.push(EV.EXPLOSION, p.tx, p.ty, p.aoe, 'm');
        }
        continue;
      }
      // projéteis guiados
      let tgt = p.target && p.target.uid === p.targetUid && p.target.active ? p.target : null;
      if (!tgt && p.kind === 'missile') {
        // procura outro alvo aéreo próximo
        let bd = 2.5 * 2.5;
        for (let i = 0; i < this.alive.length; i++) {
          const e = this.alive[i];
          if (!e.active || !e.def.air) continue;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bd) {
            bd = d2;
            tgt = e;
          }
        }
        if (tgt) {
          p.target = tgt;
          p.targetUid = tgt.uid;
        }
      }
      if (tgt) {
        p.tx = tgt.x;
        p.ty = tgt.y;
      } else if (p.obs && p.obs.alive) {
        p.tx = p.obs.x;
        p.ty = p.obs.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const stepLen = p.speed * dt;
      p.a = Math.atan2(dy, dx);
      if (d <= stepLen) {
        p.active = false;
        p.x = p.tx;
        p.y = p.ty;
        if (p.kind === 'shell') {
          if (tgt) this.damageEnemy(tgt, p.dmg, p.dtype, p.tower);
          else if (p.obs && p.obs.alive) this.damageObstacle(p.obs, p.dmg, p.dtype);
          this.events.push(EV.EXPLOSION, p.x, p.y, 0.3, 'p');
        } else {
          if (tgt) this.damageEnemy(tgt, p.dmg, p.dtype, p.tower);
          // fragmentação em outros aéreos
          const r2 = p.aoe * p.aoe;
          for (let i = 0; i < this.alive.length; i++) {
            const e = this.alive[i];
            if (!e.active || !e.def.air || e === tgt) continue;
            const ex = e.x - p.x;
            const ey = e.y - p.y;
            if (ex * ex + ey * ey <= r2) this.damageEnemy(e, p.dmg * 0.5, p.dtype, p.tower);
          }
          this.events.push(EV.EXPLOSION, p.x, p.y, p.aoe, 'ar');
        }
      } else {
        p.x += (dx / d) * stepLen;
        p.y += (dy / d) * stepLen;
      }
    }
  }

  private updateZones(dt: number): void {
    for (const z of this.zones) {
      if (!z.active) continue;
      z.t -= dt;
      switch (z.kind) {
        case 'strike':
          if (z.t <= 0) {
            z.active = false;
            this.explode(z.x, z.y, z.r, z.dmg, null, true);
            this.events.push(EV.EXPLOSION, z.x, z.y, z.r, 'g');
          }
          break;
        case 'mine': {
          if (z.t <= 0) {
            z.active = false;
            break;
          }
          const tr2 = z.trigger * z.trigger;
          for (let i = 0; i < this.alive.length; i++) {
            const e = this.alive[i];
            if (!e.active || e.def.air) continue;
            const dx = e.x - z.x;
            const dy = e.y - z.y;
            if (dx * dx + dy * dy <= tr2) {
              z.active = false;
              this.explode(z.x, z.y, z.r, z.dmg, null, false);
              this.events.push(EV.EXPLOSION, z.x, z.y, z.r, 'm');
              break;
            }
          }
          break;
        }
        case 'napalm': {
          if (z.t <= 0) {
            z.active = false;
            break;
          }
          const r2 = z.r * z.r;
          for (let i = 0; i < this.alive.length; i++) {
            const e = this.alive[i];
            if (!e.active || e.def.air) continue;
            const dx = e.x - z.x;
            const dy = e.y - z.y;
            if (dx * dx + dy * dy <= r2) this.damageEnemy(e, z.dmg * dt, 'FOG', null, false);
          }
          if (this.markedObs) {
            const o = this.markedObs;
            const dx = o.x - z.x;
            const dy = o.y - z.y;
            if (dx * dx + dy * dy <= r2 + 0.3) this.damageObstacle(o, z.dmg * dt, 'FOG');
          }
          break;
        }
        case 'wire':
          if (z.t <= 0) z.active = false;
          break;
      }
    }
  }

  /** Renda potencial total da fase (sem bônus opcionais). */
  potentialIncome(): number {
    let total = this.level.startMoney;
    for (let w = 0; w < this.level.waves.length; w++) {
      const wave = this.level.waves[w];
      total += wave.bonus;
      for (const g of wave.groups) {
        const def = ENEMY_BY_ID[g.enemy];
        let r = def.reward;
        if (def.spawnOnDeath) r += ENEMY_BY_ID[def.spawnOnDeath.id].reward * def.spawnOnDeath.n;
        if (def.boss === 'colosso') r += ENEMY_BY_ID[def.bossParams!.spawn].reward * def.bossParams!.n;
        total += r * g.count;
      }
    }
    for (const o of this.obstacles) total += o.def.reward;
    return total;
  }
}
