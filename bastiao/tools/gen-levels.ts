// Gera src/data/levels/fase-XX.json a partir de tools/levels-spec.ts.
// Uso: npx tsx tools/gen-levels.ts [--hp tools/out/hpmult.json]
import fs from 'node:fs';
import path from 'node:path';
import { SPECS, type LevelSpec } from './levels-spec';
import { ENEMY_BY_ID, GRID_H, GRID_W } from '../src/core/data';
import { Path } from '../src/core/path';
import { Rng } from '../src/core/rng';
import type { LevelData, WaveDef, WaveGroup } from '../src/core/types';

const OUT = path.resolve(import.meta.dirname, '../src/data/levels');

const INTERVAL: Record<string, number> = {
  soldado: 0.8, elite: 1.0, escudo: 1.2, moto: 0.7, jipe: 1.5, tanque_leve: 2.4, drone: 0.35, heli: 2.6,
  caminhao: 3.0, reparo: 3.0, camuflado: 1.1, gerador: 3.0, tanque_pesado: 3.8, kamikaze: 1.4,
};
const MAXCOUNT: Record<string, number> = { reparo: 3, gerador: 3, heli: 8, tanque_pesado: 8 };

const OBST_BY_BIOME: Record<string, { strong: string[]; mid: string[]; light: string[] }> = {
  deserto: { strong: ['carcaca', 'pedra'], mid: ['pedra', 'destrocos'], light: ['arvore', 'barril', 'destrocos'] },
  cidade: { strong: ['carcaca', 'conteiner'], mid: ['destrocos', 'carcaca'], light: ['destrocos', 'barril', 'arvore'] },
  neve: { strong: ['pedra', 'carcaca'], mid: ['pedra', 'arvore'], light: ['arvore', 'arvore', 'barril'] },
  industrial: { strong: ['conteiner', 'carcaca'], mid: ['conteiner', 'destrocos'], light: ['barril', 'barril', 'destrocos'] },
};

const THEMES: Record<string, (id: string) => number> = {
  misto: () => 1,
  infantaria: (id) => (ENEMY_BY_ID[id].cls === 'INF' ? 3 : 0.6),
  blindado: (id) => (ENEMY_BY_ID[id].cls === 'PES' ? 3 : ENEMY_BY_ID[id].cls === 'LEV' ? 2 : 0.4),
  aereo: (id) => (ENEMY_BY_ID[id].air ? 4 : 0.5),
  rapido: (id) => (id === 'moto' ? 3 : id === 'jipe' || id === 'drone' || id === 'kamikaze' ? 2 : 0.6),
};
const THEME_ORDER = ['misto', 'infantaria', 'blindado', 'misto', 'aereo', 'rapido'];

/** Completa caminhos secundários até a base seguindo o caminho principal. */
function completePaths(paths: number[][][]): number[][][] {
  const main = paths[0];
  const base = main[main.length - 1];
  return paths.map((p, i) => {
    if (i === 0) return p;
    const last = p[p.length - 1];
    if (last[0] === base[0] && last[1] === base[1]) return p;
    for (let s = 0; s < main.length - 1; s++) {
      const a = main[s];
      const b = main[s + 1];
      const onX = a[0] === b[0] && last[0] === a[0] && last[1] >= Math.min(a[1], b[1]) && last[1] <= Math.max(a[1], b[1]);
      const onY = a[1] === b[1] && last[1] === a[1] && last[0] >= Math.min(a[0], b[0]) && last[0] <= Math.max(a[0], b[0]);
      if (onX || onY) return [...p, ...main.slice(s + 1)];
    }
    // procura em outros caminhos já completos
    for (let j = 1; j < i; j++) {
      const other = paths[j];
      for (let s = 0; s < other.length - 1; s++) {
        const a = other[s];
        const b = other[s + 1];
        const onX = a[0] === b[0] && last[0] === a[0] && last[1] >= Math.min(a[1], b[1]) && last[1] <= Math.max(a[1], b[1]);
        const onY = a[1] === b[1] && last[1] === a[1] && last[0] >= Math.min(a[0], b[0]) && last[0] <= Math.max(a[0], b[0]);
        if (onX || onY) return completePaths([main, [...p, ...other.slice(s + 1)]])[1];
      }
    }
    throw new Error('caminho não chega à base: ' + JSON.stringify(p));
  });
}

function pathCells(paths: number[][][]): Set<number> {
  const cells = new Set<number>();
  for (const p of paths) {
    const pa = new Path(p, false);
    for (let i = 0; i < pa.sx.length; i++) {
      const cx = Math.floor(pa.sx[i]);
      const cy = Math.floor(pa.sy[i]);
      if (cx >= 0 && cy >= 0 && cx < GRID_W && cy < GRID_H) cells.add(cy * GRID_W + cx);
    }
  }
  return cells;
}

function placeObstacles(spec: LevelSpec, paths: number[][][], rng: Rng) {
  const cells = pathCells(paths);
  const ground = paths.map((p) => new Path(p, false));
  const air = spec.airPaths.map((p) => new Path(p, true));
  const scores: { idx: number; s: number }[] = [];
  for (let cy = 0; cy < GRID_H; cy++)
    for (let cx = 0; cx < GRID_W; cx++) {
      const idx = cy * GRID_W + cx;
      if (cells.has(idx)) continue;
      let s = 0;
      for (const g of ground) s += g.coverage(cx + 0.5, cy + 0.5, 3.0);
      for (const a of air) s += 0.4 * a.coverage(cx + 0.5, cy + 0.5, 4.5);
      scores.push({ idx, s });
    }
  scores.sort((a, b) => b.s - a.s);
  const pal = OBST_BY_BIOME[spec.biome];
  const obstacles: { type: string; x: number; y: number }[] = [];
  const used = new Set<number>();
  // os melhores pontos começam bloqueados
  for (let i = 0; i < spec.blocked && i < scores.length; i++) {
    const idx = scores[i].idx;
    const tier = i < Math.ceil(spec.blocked / 3) ? pal.strong : i < Math.ceil((2 * spec.blocked) / 3) ? pal.mid : pal.light;
    obstacles.push({ type: rng.pick(tier), x: idx % GRID_W, y: Math.floor(idx / GRID_W) });
    used.add(idx);
  }
  // decoração bloqueante espalhada (menos valiosa)
  const rest = scores.slice(spec.blocked);
  for (const r of rest) {
    if (rng.next() < 0.07 + (r.s < 2 ? 0.08 : 0)) {
      obstacles.push({ type: rng.pick(pal.light.concat(pal.mid)), x: r.idx % GRID_W, y: Math.floor(r.idx / GRID_W) });
      used.add(r.idx);
    }
  }
  return { obstacles, top: scores.slice(0, 12).map((s) => s.idx), used };
}

function makeWaves(spec: LevelSpec, rng: Rng): WaveDef[] {
  const waves: WaveDef[] = [];
  const ids = Object.keys(spec.pool);
  const nGround = spec.paths.length;
  const nAir = Math.max(1, spec.airPaths.length);
  let pathRot = 0;
  let airRot = 0;
  for (let w = 0; w < spec.waves; w++) {
    const budget = (spec.budget * (1 + spec.growth * w) * 5) / 70; // em unidades de recompensa
    const groups: WaveGroup[] = [];
    const isBoss = !!spec.boss && w === spec.waves - 1;
    let theme = THEME_ORDER[w % THEME_ORDER.length];
    if (theme === 'aereo' && !ids.some((id) => ENEMY_BY_ID[id].air)) theme = 'blindado';
    if (theme === 'blindado' && !ids.some((id) => ENEMY_BY_ID[id].cls !== 'INF')) theme = 'infantaria';
    let chosen: string[] = [];
    const introIdx = w - 1;
    if (introIdx >= 0 && introIdx < spec.intro.length && !isBoss) {
      chosen = [spec.intro[introIdx], rng.pick(ids.filter((i) => i !== spec.intro[introIdx]) .concat(['soldado']))];
    } else {
      const nTypes = Math.min(ids.length, w < 2 ? 1 + (ids.length > 1 ? 1 : 0) : 2 + (rng.next() < 0.5 ? 1 : 0));
      const weights = ids.map((id) => spec.pool[id] * THEMES[theme](id));
      while (chosen.length < nTypes) {
        let tot = 0;
        for (let i = 0; i < ids.length; i++) if (!chosen.includes(ids[i])) tot += weights[i];
        let r = rng.next() * tot;
        for (let i = 0; i < ids.length; i++) {
          if (chosen.includes(ids[i])) continue;
          r -= weights[i];
          if (r <= 0) {
            chosen.push(ids[i]);
            break;
          }
        }
      }
      // garante mistura de classes a partir da fase 3
      if (spec.id >= 3 && w >= 1) {
        const classes = new Set(chosen.map((c) => ENEMY_BY_ID[c].cls));
        if (classes.size < 2) {
          const other = ids.filter((i) => !classes.has(ENEMY_BY_ID[i].cls));
          if (other.length) chosen.push(rng.pick(other));
        }
      }
    }
    let delay = 0;
    let share = isBoss ? 0.55 : 1;
    // apoio (reparo/gerador) ocupa pouco do orçamento
    const supportIds: string[] = chosen.filter((c) => c === 'reparo' || c === 'gerador');
    const mainIds = chosen.filter((c) => !supportIds.includes(c));
    if (mainIds.length === 0) mainIds.push('soldado');
    for (const id of chosen) {
      const def = ENEMY_BY_ID[id];
      const isSup = supportIds.includes(id);
      const portion = isSup ? 0.15 : (1 - 0.15 * supportIds.length) / mainIds.length;
      let count = Math.max(1, Math.round((budget * share * portion) / def.reward));
      if (MAXCOUNT[id]) count = Math.min(count, MAXCOUNT[id]);
      const air = !!def.air;
      const p = air ? airRot++ % nAir : pathRot++ % nGround;
      groups.push({ enemy: id, count, interval: INTERVAL[id] ?? 1, delay: Math.round(delay * 10) / 10, path: p });
      delay += isSup ? 1.5 : Math.min(8, count * (INTERVAL[id] ?? 1) * 0.5 + 1.5);
    }
    if (isBoss) {
      groups.push({ enemy: spec.boss!, count: 1, interval: 1, delay: Math.round(delay * 10) / 10 + 2, path: 0 });
    }
    waves.push({ bonus: Math.round(25 + 6 * w + 2 * spec.id), groups });
  }
  return waves;
}

const GROUP: Record<string, 'INF' | 'ARM' | 'AER' | 'ESC'> = {
  soldado: 'INF', elite: 'INF', camuflado: 'INF', moto: 'ARM', jipe: 'ARM', escudo: 'ARM', caminhao: 'ARM', reparo: 'ARM',
  tanque_leve: 'ARM', tanque_pesado: 'ARM', drone: 'AER', heli: 'AER', kamikaze: 'AER', gerador: 'ESC',
};

/** Garante a mistura de classes da fase (a partir da 3): ninguém vence com 1 ou 2 tipos de torre. */
function enforceMix(spec: LevelSpec, waves: WaveDef[]): void {
  if (spec.id < 3) return;
  const target: Record<string, number> = spec.id >= 8 ? { INF: 0.27, ARM: 0.38, AER: 0.25, ESC: 0.1 } : { INF: 0.3, ARM: 0.42, AER: 0.28, ESC: 0 };
  const share = () => {
    const s: Record<string, number> = { INF: 0, ARM: 0, AER: 0, ESC: 0, PES: 0 };
    let tot = 0;
    for (const w of waves)
      for (const g of w.groups) {
        const grp = GROUP[g.enemy];
        if (!grp) continue;
        const hp = ENEMY_BY_ID[g.enemy].hp * g.count;
        s[grp] += hp;
        if (ENEMY_BY_ID[g.enemy].cls === 'PES') s.PES += hp;
        tot += hp;
      }
    for (const k of Object.keys(s)) s[k] /= tot || 1;
    return s;
  };
  for (let pass = 0; pass < 4; pass++) {
    const s = share();
    const reward0 = waves.map((w) => w.groups.reduce((a, g) => a + ENEMY_BY_ID[g.enemy].reward * g.count, 0));
    for (const w of waves)
      for (const g of w.groups) {
        const grp = GROUP[g.enemy];
        if (!grp || s[grp] <= 0) continue;
        let f = target[grp] / s[grp];
        if (ENEMY_BY_ID[g.enemy].cls === 'PES' && s.PES < 0.16) f *= 0.16 / Math.max(0.02, s.PES);
        g.count = Math.max(1, Math.round(g.count * Math.min(3, Math.max(0.34, f))));
        if (MAXCOUNT[g.enemy]) g.count = Math.min(g.count, MAXCOUNT[g.enemy] + (spec.id >= 12 ? 2 : 0));
      }
    // mantém o orçamento (recompensa) de cada onda
    waves.forEach((w, i) => {
      const r = w.groups.reduce((a, g) => a + ENEMY_BY_ID[g.enemy].reward * g.count, 0);
      const k = reward0[i] / Math.max(1, r);
      for (const g of w.groups) if (!g.enemy.startsWith('boss_')) g.count = Math.max(1, Math.round(g.count * k));
    });
  }
}

export function generate(hpOverride: Record<string, number> = {}, moneyOverride: Record<string, number> = {}): LevelData[] {
  const levels: LevelData[] = [];
  for (const spec of SPECS) {
    const rng = new Rng(1000 + spec.id * 7919);
    const paths = completePaths(spec.paths);
    const { obstacles } = placeObstacles(spec, paths, rng);
    const waves = makeWaves(spec, rng);
    enforceMix(spec, waves);
    const region = ['deserto', 'cidade', 'neve', 'industrial'].indexOf(spec.biome);
    const k = (spec.id - 1) % 5;
    const level: LevelData = {
      id: spec.id,
      name: spec.name,
      biome: spec.biome,
      map: {
        x: Math.round((region * 0.25 + [0.06, 0.17, 0.07, 0.17, 0.12][k]) * 1000) / 1000,
        y: Math.round((region % 2 === 0 ? [0.86, 0.69, 0.52, 0.35, 0.17][k] : [0.17, 0.35, 0.52, 0.69, 0.86][k]) * 1000) / 1000,
      },
      startMoney: moneyOverride[spec.id] ?? spec.startMoney,
      lives: 20,
      hpMult: hpOverride[spec.id] ?? spec.hpMult,
      waveGap: 15,
      towers: spec.towers,
      abilities: spec.abilities,
      paths,
      airPaths: spec.airPaths,
      obstacles,
      waves,
      tutorial: spec.id === 1 ? true : undefined,
      briefing: spec.briefing,
    };
    (level as any).waveHpGrowth = 0.025;
    levels.push(level);
  }
  return levels;
}

export function writeLevels(levels: LevelData[]): void {
  fs.mkdirSync(OUT, { recursive: true });
  for (const l of levels) {
    const file = path.join(OUT, `fase-${String(l.id).padStart(2, '0')}.json`);
    fs.writeFileSync(file, JSON.stringify(l, null, 1) + '\n');
  }
}

export function ascii(l: LevelData): string {
  const g: string[][] = [];
  for (let y = 0; y < GRID_H; y++) g.push(new Array(GRID_W).fill('.'));
  for (const c of pathCells(l.paths)) g[Math.floor(c / GRID_W)][c % GRID_W] = '#';
  for (const o of l.obstacles) g[o.y][o.x] = o.type[0].toUpperCase();
  return g.map((r) => r.join('')).join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('gen-levels.ts')) {
  const hpFile = process.argv.indexOf('--hp');
  let hp: Record<string, number> = {};
  let money: Record<string, number> = {};
  const file = hpFile > 0 ? process.argv[hpFile + 1] : path.resolve(import.meta.dirname, 'tuning.json');
  if (!process.argv.includes('--sem-ajuste') && fs.existsSync(file)) {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    hp = j.hp ?? j;
    money = j.money ?? {};
  }
  const levels = generate(hp, money);
  writeLevels(levels);
  if (process.argv.includes('--ascii')) for (const l of levels) console.log(`\nFase ${l.id} ${l.name}\n` + ascii(l));
  console.log(`${levels.length} fases geradas em ${OUT}`);
}
