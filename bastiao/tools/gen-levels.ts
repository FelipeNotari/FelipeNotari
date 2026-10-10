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

const GROUP: Record<string, string> = {
  soldado: 'INF', elite: 'INF', camuflado: 'INF', moto: 'LEV', jipe: 'LEV', escudo: 'LEV', caminhao: 'LEV', reparo: 'LEV',
  tanque_leve: 'PES', tanque_pesado: 'PES', drone: 'AER', heli: 'AER', kamikaze: 'KAM', gerador: 'ESC',
};

/** Proporção (em recompensa) de cada grupo de classe numa onda. */
function waveShares(spec: LevelSpec, theme: string, groups: Set<string>): Record<string, number> {
  // cotas fixas por onda: cada classe precisa de um counter próprio
  const base: Record<string, number> = { INF: 0.34, LEV: 0.17, PES: 0.2, AER: 0.24, ESC: spec.id >= 8 ? 0.05 : 0, KAM: spec.id >= 11 ? 0.06 : 0 };
  if (spec.id < 3) {
    for (const k of Object.keys(base)) base[k] = 0;
    base.INF = spec.id === 1 ? 1 : 0.5;
    base.LEV = spec.id === 1 ? 0 : 0.5;
  }
  const tilt: Record<string, string> = { infantaria: 'INF', blindado: 'PES', aereo: 'AER', rapido: 'LEV' };
  if (tilt[theme] && base[tilt[theme]] > 0) base[tilt[theme]] *= 1.6;
  let tot = 0;
  for (const k of Object.keys(base)) {
    if (!groups.has(k)) base[k] = 0;
    tot += base[k];
  }
  for (const k of Object.keys(base)) base[k] /= tot || 1;
  return base;
}

function pickType(spec: LevelSpec, grp: string, theme: string, rng: Rng, w: number): string | null {
  const ids = Object.keys(spec.pool).filter((id) => GROUP[id] === grp);
  if (!ids.length) return null;
  // ondas de apresentação: o inimigo novo aparece com destaque
  const intro = spec.intro[w - 1];
  if (intro && GROUP[intro] === grp) return intro;
  const weights = ids.map((id) => spec.pool[id] * THEMES[theme](id) * (spec.intro.includes(id) && w < 4 ? 1.5 : 1));
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i];
    if (r <= 0) return ids[i];
  }
  return ids[ids.length - 1];
}

function makeWaves(spec: LevelSpec, rng: Rng): WaveDef[] {
  const waves: WaveDef[] = [];
  const nGround = spec.paths.length;
  const nAir = Math.max(1, spec.airPaths.length);
  const groupsAvail = new Set(Object.keys(spec.pool).map((id) => GROUP[id]));
  let pathRot = 0;
  let airRot = 0;
  for (let w = 0; w < spec.waves; w++) {
    const budget = (spec.budget * (1 + spec.growth * w) * 5) / 70; // em unidades de recompensa
    const isBoss = !!spec.boss && w === spec.waves - 1;
    let theme = THEME_ORDER[w % THEME_ORDER.length];
    if (theme === 'aereo' && !groupsAvail.has('AER')) theme = 'blindado';
    const shares = waveShares(spec, theme, groupsAvail);
    const groups: WaveGroup[] = [];
    const dur = Math.min(22, 10 + 0.5 * w); // duração alvo da onda (s)
    let delay = 0;
    const share = isBoss ? 0.55 : 1;
    for (const grp of ['PES', 'LEV', 'INF', 'ESC', 'AER', 'KAM']) {
      const sh = shares[grp] ?? 0;
      if (sh <= 0) continue;
      // às vezes divide o grupo em dois tipos para variar
      const split = sh * budget > 40 && rng.next() < 0.45 ? 2 : 1;
      const used = new Set<string>();
      for (let k = 0; k < split; k++) {
        let id = pickType(spec, grp, theme, rng, w);
        if (id && used.has(id)) id = pickType(spec, grp, theme, rng, w + 99);
        if (!id || used.has(id)) continue;
        used.add(id);
        const def = ENEMY_BY_ID[id];
        let count = Math.round((budget * share * sh) / split / def.reward);
        if (count < 1) {
          // escudos só quando o orçamento permite; os demais sempre aparecem
          if (grp === 'ESC' || grp === 'KAM') continue;
          count = 1;
        }
        if (MAXCOUNT[id]) count = Math.min(count, MAXCOUNT[id] + (spec.id >= 12 ? 2 : 0));
        // infantaria e drones vêm em colunas densas (exigem cadência ou área); veículos espaçados
        const dense = grp === 'INF' || id === 'drone';
        const interval = count > 1 ? (dense ? INTERVAL[id] ?? 1 : Math.max(INTERVAL[id] ?? 1, Math.round((dur / count) * 100) / 100)) : 1;
        const air = !!def.air;
        const p = air ? airRot++ % nAir : pathRot++ % nGround;
        groups.push({ enemy: id, count, interval, delay: Math.round(delay * 10) / 10, path: p });
        delay += 1.2 + rng.next() * 1.5;
      }
    }
    if (isBoss) groups.push({ enemy: spec.boss!, count: 1, interval: 1, delay: Math.round(delay * 10) / 10 + 4, path: 0 });
    waves.push({ bonus: Math.round(25 + 6 * w + 2 * spec.id), groups });
  }
  return waves;
}

export function generate(hpOverride: Record<string, number> = {}, moneyOverride: Record<string, number> = {}): LevelData[] {
  const levels: LevelData[] = [];
  for (const spec of SPECS) {
    const rng = new Rng(1000 + spec.id * 7919);
    const paths = completePaths(spec.paths);
    const { obstacles } = placeObstacles(spec, paths, rng);
    const waves = makeWaves(spec, rng);
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
