// Bots usados pelo simulador de balanceamento (sem renderização).
import { ENEMY_BY_ID, GRID_H, GRID_W, MATRIX, TOWER_BY_ID } from '../src/core/data';
import { CELL_FREE, Game, Tower } from '../src/core/game';
import { Path } from '../src/core/path';
import { Rng } from '../src/core/rng';
import { ARMOR_CLASSES, type ArmorClass, type Priority } from '../src/core/types';

const SPEED_REF = 1.2;

/** DPS efetivo esperado de uma torre (com stats calculados) contra uma classe. */
export function effDps(t: Tower, c: ArmorClass): number {
  const s = t.stats;
  const air = c === 'AER';
  if (air && !t.canAir) return 0;
  if (!air && !t.canGround) return 0;
  const m = MATRIX[t.def.dmgType][c] * (1 + s.vs[c]);
  if (m <= 0) return 0;
  let dps = 0;
  switch (t.def.attack) {
    case 'hitscan':
      dps = s.dmg * s.rate * (1 + s.crit);
      // tiro grande em alvo pequeno desperdiça (excesso)
      if (t.def.id === 'sn' && c === 'INF') dps *= 0.7;
      break;
    case 'shell':
      dps = s.dmg * s.rate * (c === 'INF' ? 0.35 : 1);
      break;
    case 'mortar':
      dps = s.dmg * s.rate * (1 + 1.6 * s.aoe) * 0.75;
      break;
    case 'missile':
      dps = s.dmg * s.missiles * s.rate * 1.1;
      break;
    case 'flame':
      dps = (s.dmg + s.burnDps * 0.7) * (c === 'INF' ? 2.0 : 1.5);
      break;
    case 'beam':
      dps = s.dmg * (c === 'INF' ? 1.3 : (1 + s.rampMax) / 2);
      break;
    default:
      dps = 0;
  }
  return dps * m;
}

interface ClassInfo {
  hp: number; // vida total a destruir (ponderada)
  maxHp: number; // maior inimigo individual
  gap: number; // espaçamento médio entre inimigos (casas)
  speed: number; // velocidade média (casas/s)
  dur: number; // duração do fluxo (s)
}

interface Window {
  cls: Record<ArmorClass, ClassInfo>;
  /** fração do HP de cada classe que passa por cada caminho */
  share: Record<ArmorClass, number[]>;
  camo: number;
}

export interface StrategistOptions {
  cap?: number; // fração da renda que pode ser gasta
  allowed?: string[]; // tipos de torre permitidos
  abilities?: boolean;
}

function emptyCls(): ClassInfo {
  return { hp: 0, maxHp: 0, gap: 0, speed: 0, dur: 0 };
}

export class StrategistBot {
  private t = 0;
  private game: Game;
  private cap: number;
  private allowed: string[];
  private useAbil: boolean;
  private probes: Record<string, Tower> = {};
  /** cobertura por tipo de torre -> por caminho -> por casa */
  private covCache = new Map<string, Float32Array[]>();

  constructor(game: Game, opts: StrategistOptions = {}) {
    this.game = game;
    this.cap = opts.cap ?? 1;
    this.allowed = (opts.allowed ?? game.level.towers).filter((id) => game.level.towers.includes(id));
    this.useAbil = opts.abilities ?? true;
    for (const id of this.allowed) {
      const t = new Tower(TOWER_BY_ID[id]);
      game.computeStats(t);
      this.probes[id] = t;
    }
  }

  private budget(): number {
    const g = this.game;
    const s = g.stat;
    const income = g.level.startMoney + s.earnKills + s.earnWaves + s.earnObst + s.earnEarly + s.earnSupply;
    return Math.min(g.money, this.cap * income - s.spent);
  }

  /** Cobertura (comprimento de caminho no alcance) de um tipo de torre em cada casa. */
  private coverage(id: string, range: number, minRange: number, air: boolean): Float32Array[] {
    const key = `${id}|${range.toFixed(2)}|${minRange.toFixed(2)}|${air ? 1 : 0}`;
    let c = this.covCache.get(key);
    if (c) return c;
    const paths = air ? this.game.airPaths : this.game.paths;
    c = paths.map((p) => {
      const arr = new Float32Array(GRID_W * GRID_H);
      for (let cy = 0; cy < GRID_H; cy++)
        for (let cx = 0; cx < GRID_W; cx++) arr[cy * GRID_W + cx] = p.coverage(cx + 0.5, cy + 0.5, range, minRange);
      return arr;
    });
    this.covCache.set(key, c);
    return c;
  }

  private window(): Window {
    const g = this.game;
    const cls = {} as Record<ArmorClass, ClassInfo>;
    const share = {} as Record<ArmorClass, number[]>;
    for (const c of ARMOR_CLASSES) {
      cls[c] = emptyCls();
      const n = c === 'AER' ? g.airPaths.length : g.paths.length;
      share[c] = new Array(Math.max(1, n)).fill(0);
    }
    let camo = 0;
    // acumuladores de média ponderada
    const wsum: Record<string, number> = {};
    const add = (c: ArmorClass, hp: number, single: number, count: number, interval: number, speed: number, pathIdx: number, w: number) => {
      const ci = cls[c];
      ci.hp += hp * w;
      ci.maxHp = Math.max(ci.maxHp, single * (w >= 1 ? 1 : 0.7));
      const ww = hp * w;
      wsum[c] = (wsum[c] ?? 0) + ww;
      ci.gap += (count > 1 ? interval : 8) * speed * ww;
      ci.speed += speed * ww;
      ci.dur = Math.max(ci.dur, count * interval * (w >= 1 ? 1 : 0.6));
      share[c][Math.min(pathIdx, share[c].length - 1)] += ww;
    };
    const next = g.waveIdx + 1;
    for (let k = 0; k < 3; k++) {
      const wv = g.level.waves[next + k];
      if (!wv) break;
      const w = k === 0 ? 1 : k === 1 ? 0.6 : 0.3;
      for (const gr of wv.groups) {
        const def = ENEMY_BY_ID[gr.enemy];
        const hp = g.hpFor(def, next + k);
        add(def.cls, hp * gr.count, hp, gr.count, gr.interval, def.speed, gr.path, w);
        if (def.boss === 'fortaleza') {
          const sh = hp * def.bossParams!.shieldPct * 3;
          add('ESC', sh, sh, 1, 1, def.speed, 0, w);
        }
        if (def.spawnOnDeath) {
          const sd = ENEMY_BY_ID[def.spawnOnDeath.id];
          const h2 = g.hpFor(sd, next + k);
          add(sd.cls, h2 * def.spawnOnDeath.n * gr.count, h2, def.spawnOnDeath.n * gr.count, gr.interval / 2, sd.speed, gr.path, w);
        }
        if (def.shieldAura) {
          // escudos projetados nos vizinhos
          const sh = Math.min(def.shieldAura.cap, 300 * g.level.hpMult) * gr.count * 4;
          add('ESC', sh, sh / gr.count / 4, gr.count * 4, gr.interval, def.speed, gr.path, w);
        }
        if (def.camo) camo += hp * gr.count * w;
      }
    }
    for (const e of g.alive) {
      if (!e.active) continue;
      add(e.cls, (e.hp + e.shield) * 0.5, e.hp, 1, 1, e.def.speed, e.pathIdx, 1);
      if (e.def.camo) camo += e.hp;
    }
    for (const c of ARMOR_CLASSES) {
      const ci = cls[c];
      const ws = wsum[c] ?? 0;
      if (ws > 0) {
        ci.gap /= ws;
        ci.speed /= ws;
      } else {
        ci.gap = 2;
        ci.speed = 1.2;
      }
      const tot = share[c].reduce((a, b) => a + b, 0);
      if (tot > 0) share[c] = share[c].map((v) => v / tot);
      else share[c] = share[c].map(() => 1 / share[c].length);
    }
    return { cls, share, camo };
  }

  /** Capacidade (vida que a torre consegue destruir no próximo fluxo) por classe.
   *  `burst` recebe o dano num único inimigo durante a passagem dele. */
  private potential(t: Tower, idx: number, win: Window, out: Record<ArmorClass, number>, burst?: Record<ArmorClass, number>): void {
    const s = t.stats;
    const covG = t.canGround ? this.coverage(t.def.id, s.range, s.minRange, false) : null;
    const covA = t.canAir ? this.coverage(t.def.id, s.range, 0, true) : null;
    for (const c of ARMOR_CLASSES) {
      const ci = win.cls[c];
      const d = ci.hp > 0 ? effDps(t, c) : 0;
      if (burst) burst[c] = 0;
      if (d <= 0) {
        out[c] = 0;
        continue;
      }
      let cov = 0;
      if (c === 'AER') {
        if (covA) for (let p = 0; p < covA.length; p++) cov += covA[p][idx] * win.share.AER[p];
      } else if (covG) for (let p = 0; p < covG.length; p++) cov += covG[p][idx] * win.share[c][p];
      if (cov <= 0) {
        out[c] = 0;
        continue;
      }
      const gap = Math.max(0.3, ci.gap);
      let hits = 1;
      if (t.def.attack === 'mortar') hits = Math.min(4, 1 + (2 * s.aoe) / gap) * 0.8;
      else if (t.def.attack === 'flame') hits = Math.min(2.4, 1 + (0.6 * s.range) / gap);
      else if (t.def.attack === 'missile' && c === 'AER') hits = Math.min(2.5, 1 + (s.aoe * 0.5) / gap);
      const T = cov / Math.max(0.3, ci.speed); // segundos de cada inimigo no alcance
      const spacing = gap / Math.max(0.3, ci.speed);
      const engage = 1 - Math.exp(-T / Math.max(0.3, spacing));
      out[c] = d * hits * (0.5 * ci.dur * engage + T);
      if (burst) burst[c] = d * T;
    }
  }

  private haveCapacity(win: Window): { have: Record<ArmorClass, number>; burst: Record<ArmorClass, number> } {
    const have: Record<ArmorClass, number> = { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 };
    const burst: Record<ArmorClass, number> = { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 };
    const tmp: Record<ArmorClass, number> = { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 };
    const tmpB: Record<ArmorClass, number> = { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 };
    for (const t of this.game.towers) {
      if (t.temp || !t.active || t.def.attack === 'support') continue;
      this.potential(t, t.cy * GRID_W + t.cx, win, tmp, tmpB);
      for (const c of ARMOR_CLASSES) {
        have[c] += tmp[c];
        burst[c] += tmpB[c];
      }
    }
    return { have, burst };
  }

  /** Pesos por classe: [capacidade, rajada]. */
  private weights(win: Window, h: { have: Record<ArmorClass, number>; burst: Record<ArmorClass, number> }) {
    const w: Record<ArmorClass, number> = { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 };
    const wb: Record<ArmorClass, number> = { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 };
    for (const c of ARMOR_CLASSES) {
      const ci = win.cls[c];
      if (ci.hp <= 0) continue;
      w[c] = Math.exp(-1.6 * (h.have[c] / ci.hp)) + 0.02;
      const needB = ci.maxHp * 1.6;
      wb[c] = (Math.exp(-1.6 * (h.burst[c] / needB)) * ci.hp) / needB;
    }
    return { w, wb };
  }

  private revealCoverage(): number {
    const g = this.game;
    let covered = 0;
    let total = 0;
    for (let p = 0; p < g.paths.length; p++) {
      const path = g.paths[p];
      for (let i = 0; i < path.sx.length; i += 4) {
        total++;
        for (const t of g.towers) {
          if (!t.stats.reveal) continue;
          const dx = path.sx[i] - t.x;
          const dy = path.sy[i] - t.y;
          if (dx * dx + dy * dy <= t.stats.range * t.stats.range) {
            covered++;
            break;
          }
        }
      }
    }
    return total ? covered / total : 1;
  }

  update(dt: number): void {
    const g = this.game;
    if (g.over) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.5;
    if (this.useAbil) this.abilities();
    this.manageObstacles();
    for (let k = 0; k < 4; k++) if (!this.act()) break;
  }

  private act(): boolean {
    const g = this.game;
    const win = this.window();
    const have = this.haveCapacity(win);
    const { w, wb } = this.weights(win, have);
    const budget = this.budget();
    let best: { score: number; cost: number; run: () => void } | null = null;
    let bestAff: { score: number; cost: number; run: () => void } | null = null;
    const consider = (score: number, cost: number, run: () => void) => {
      if (!(score > 0)) return;
      if (!best || score > best.score) best = { score, cost, run };
      if (cost <= budget && (!bestAff || score > bestAff.score)) bestAff = { score, cost, run };
    };
    const tmp: Record<ArmorClass, number> = { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 };
    const tmp2: Record<ArmorClass, number> = { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 };
    const tb: Record<ArmorClass, number> = { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 };
    const tb2: Record<ArmorClass, number> = { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 };
    const value = (pot: Record<ArmorClass, number>, b?: Record<ArmorClass, number>) => {
      let v = 0;
      for (const c of ARMOR_CLASSES) v += w[c] * pot[c] + (b ? wb[c] * b[c] : 0);
      return v;
    };
    // camuflados exigem revelação
    const needReveal = win.camo > 0 && this.revealCoverage() < 0.3;
    // construções
    for (const id of this.allowed) {
      const probe = this.probes[id];
      const cost = g.buildCost(id);
      if (probe.def.attack === 'support') {
        // radar: revelação + bônus às vizinhas
        for (let idx = 0; idx < GRID_W * GRID_H; idx++) {
          if (g.grid[idx] !== CELL_FREE) continue;
          const cx = idx % GRID_W;
          const cy = Math.floor(idx / GRID_W);
          let v = 0;
          for (const t of g.towers) {
            if (t.temp || t.def.attack === 'support') continue;
            const dx = t.x - (cx + 0.5);
            const dy = t.y - (cy + 0.5);
            if (dx * dx + dy * dy <= probe.stats.auraRadius * probe.stats.auraRadius + 0.01 && t.stats.auraRangeBonus < probe.stats.aura) {
              this.potential(t, t.cy * GRID_W + t.cx, win, tmp);
              v += value(tmp) * (probe.stats.aura - t.stats.auraRangeBonus) * 1.2;
            }
          }
          if (needReveal) {
            let cov = 0;
            for (const p of g.paths) cov += p.coverage(cx + 0.5, cy + 0.5, probe.stats.range);
            v += cov * win.camo * 0.01;
          }
          consider(v / cost, cost, () => g.build(id, cx, cy));
        }
        continue;
      }
      let bestIdx = -1;
      let bestV = 0;
      for (let idx = 0; idx < GRID_W * GRID_H; idx++) {
        if (g.grid[idx] !== CELL_FREE) continue;
        this.potential(probe, idx, win, tmp, tb);
        const v = value(tmp, tb);
        if (v > bestV) {
          bestV = v;
          bestIdx = idx;
        }
      }
      if (bestIdx >= 0) {
        const cx = bestIdx % GRID_W;
        const cy = Math.floor(bestIdx / GRID_W);
        consider(bestV / cost, cost, () => g.build(id, cx, cy));
      }
    }
    // melhorias
    for (const t of g.towers) {
      if (t.temp || t.level >= t.def.levels.length - 1) continue;
      const cost = g.upgradeCost(t);
      const idx = t.cy * GRID_W + t.cx;
      if (t.def.attack === 'support') {
        let v = 0;
        for (const o of g.towers) {
          if (o.temp || o.def.attack === 'support') continue;
          const dx = o.x - t.x;
          const dy = o.y - t.y;
          if (dx * dx + dy * dy <= t.stats.auraRadius * t.stats.auraRadius + 0.01) {
            this.potential(o, o.cy * GRID_W + o.cx, win, tmp);
            v += value(tmp) * 0.05;
          }
        }
        consider(v / cost, cost, () => g.upgrade(t));
        continue;
      }
      this.potential(t, idx, win, tmp, tb);
      const before = value(tmp, tb);
      const keepLevel = t.level;
      const keepAura = t.stats.auraRangeBonus;
      const keepDmg = t.stats.auraDmgBonus;
      t.level++;
      g.computeStats(t);
      t.stats.range *= 1 + keepAura;
      t.stats.dmg *= 1 + keepDmg;
      this.potential(t, idx, win, tmp2, tb2);
      const after = value(tmp2, tb2);
      // sniper nível 3 revela camuflados
      let bonus = 0;
      if (needReveal && t.def.id === 'sn' && t.level === 2) bonus = win.camo * 0.2;
      t.level = keepLevel;
      g.computeStats(t);
      t.stats.range *= 1 + keepAura;
      t.stats.dmg *= 1 + keepDmg;
      t.stats.auraRangeBonus = keepAura;
      t.stats.auraDmgBonus = keepDmg;
      consider(((after - before) * 1.05 + bonus) / cost, cost, () => g.upgrade(t));
    }
    const b = best as { score: number; cost: number; run: () => void } | null;
    const a = bestAff as { score: number; cost: number; run: () => void } | null;
    if (!a) return false;
    if (b && a !== b && a.score < 0.7 * b.score) return false; // espera juntar dinheiro
    a.run();
    // prioridade: antitanque e sniper miram o mais forte
    return true;
  }

  private manageObstacles(): void {
    const g = this.game;
    const busy = g.alive.length > 0;
    if (busy) {
      if (g.markedObs) g.toggleMark(g.markedObs);
      return;
    }
    if (g.markedObs) return;
    // escolhe o obstáculo cujo terreno é mais valioso e que alguma torre alcança
    const win = this.window();
    const tmp: Record<ArmorClass, number> = { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 };
    let best = null as null | { o: (typeof g.obstacles)[number]; v: number };
    for (const o of g.obstacles) {
      if (!o.alive) continue;
      let canHit = false;
      for (const t of g.towers) {
        if (t.temp || !t.canGround || t.def.attack === 'support') continue;
        const dx = o.x - t.x;
        const dy = o.y - t.y;
        const r = t.stats.range + 0.3;
        if (dx * dx + dy * dy <= r * r && dx * dx + dy * dy >= t.stats.minRange * t.stats.minRange) {
          canHit = true;
          break;
        }
      }
      if (!canHit) continue;
      const idx = o.cy * GRID_W + o.cx;
      let v = 0;
      for (const id of this.allowed) {
        const probe = this.probes[id];
        if (probe.def.attack === 'support') continue;
        this.potential(probe, idx, win, tmp);
        let s = 0;
        for (const c of ARMOR_CLASSES) s += tmp[c] * (win.cls[c].hp > 0 ? 1 : 0);
        v = Math.max(v, s);
      }
      v = v / (1 + o.hp / 400) + o.def.reward * 0.2;
      if (!best || v > best.v) best = { o, v };
    }
    if (best) g.toggleMark(best.o);
  }

  private abilities(): void {
    const g = this.game;
    if (g.alive.length === 0) return;
    for (let i = 0; i < g.abilities.length; i++) {
      const s = g.abilities[i];
      if (s.cd > 0) continue;
      const id = s.def.id;
      if (id === 'suprimentos') {
        g.cast(i, 0, 0);
        continue;
      }
      // ponto com mais vida inimiga concentrada (prioriza quem está perto da base)
      const r = (s.def.params.radius ?? 1.5) * 1.0;
      let bx = 0;
      let by = 0;
      let bv = 0;
      for (const e of g.alive) {
        if (!e.active) continue;
        if ((id === 'aereo' || id === 'napalm' || id === 'minas' || id === 'arame') && e.def.air) continue;
        let v = 0;
        for (const o of g.alive) {
          if (!o.active || (o.def.air && id !== 'emp' && id !== 'reforcos')) continue;
          const dx = o.x - e.x;
          const dy = o.y - e.y;
          if (dx * dx + dy * dy <= r * r) v += (o.hp + o.shield) * (1 + 2 * (1 - o.remaining / o.path.length));
        }
        if (v > bv) {
          bv = v;
          bx = e.x;
          by = e.y;
        }
      }
      const thr = 500 * g.level.hpMult;
      if (bv >= thr) g.cast(i, bx, by);
    }
  }
}

/** Bot aleatório: torres e posições aleatórias. */
export class RandomBot {
  private t = 0;
  private rng: Rng;
  constructor(private game: Game, seed: number) {
    this.rng = new Rng(seed);
  }
  update(dt: number): void {
    const g = this.game;
    if (g.over) return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1.0;
    const types = g.level.towers;
    for (let k = 0; k < 3; k++) {
      if (this.rng.next() < 0.7 || g.towers.length === 0) {
        const id = this.rng.pick(types);
        if (g.money < g.buildCost(id)) continue;
        const free: number[] = [];
        for (let i = 0; i < g.grid.length; i++) if (g.grid[i] === CELL_FREE) free.push(i);
        if (!free.length) return;
        const idx = this.rng.pick(free);
        const t = g.build(id, idx % GRID_W, Math.floor(idx / GRID_W));
        if (t) g.setPriority(t, this.rng.int(4) as Priority);
      } else {
        const ts = g.towers.filter((t) => !t.temp && t.level < 2);
        if (!ts.length) continue;
        const t = this.rng.pick(ts);
        if (g.money >= g.upgradeCost(t)) g.upgrade(t);
      }
    }
    // marca obstáculos aleatórios de vez em quando
    if (this.rng.next() < 0.05) {
      const alive = g.obstacles.filter((o) => o.alive);
      if (alive.length) g.toggleMark(this.rng.pick(alive));
    }
    // habilidades em pontos aleatórios do caminho
    for (let i = 0; i < g.abilities.length; i++) {
      if (g.abilities[i].cd > 0 || g.alive.length === 0 || this.rng.next() < 0.7) continue;
      const p: Path = this.rng.pick(g.paths);
      const pos = { x: 0, y: 0, a: 0, seg: 0 };
      p.posAt(this.rng.next() * p.length, pos);
      g.cast(i, pos.x, pos.y);
    }
  }
}
