import fs from 'node:fs';
import path from 'node:path';
import { DT } from '../src/core/data';
import { Game } from '../src/core/game';
import { expectedResearch } from '../src/core/research';
import type { LevelData } from '../src/core/types';
import { RandomBot, StrategistBot, type StrategistOptions } from './bots';

export const LEVEL_DIR = path.resolve(import.meta.dirname, '../src/data/levels');

export function loadLevels(): LevelData[] {
  return fs
    .readdirSync(LEVEL_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(LEVEL_DIR, f), 'utf8')) as LevelData);
}

/** Pontos de pesquisa esperados ao chegar na fase (vitória + 2 estrelas nas anteriores). */
export function expectedPoints(levelId: number): number {
  return 4 * (levelId - 1);
}

export interface RunResult {
  won: boolean;
  lives: number;
  stars: number;
  wave: number;
  time: number;
  spent: number;
  income: number;
  potential: number;
  towers: Record<string, number>;
  leaks: number;
}

const ABIL_PREF = ['aereo', 'minas', 'napalm', 'emp', 'arame', 'reforcos'];

export function runGame(
  level: LevelData,
  kind: 'strategist' | 'random',
  opts: StrategistOptions & { seed?: number; maxTime?: number } = {},
): RunResult {
  const researched = expectedResearch(expectedPoints(level.id), level.towers);
  const abil = ABIL_PREF.filter((a) => level.abilities.includes(a)).slice(0, 3);
  const g = new Game(level, { researched, abilities: abil, seed: opts.seed ?? 7, events: false });
  const bot = kind === 'strategist' ? new StrategistBot(g, opts) : new RandomBot(g, opts.seed ?? 1);
  const maxTime = opts.maxTime ?? 3600;
  while (!g.over && g.time < maxTime) {
    bot.update(DT);
    g.step(DT);
  }
  const towers: Record<string, number> = {};
  for (const t of g.towers) if (!t.temp) towers[t.def.id] = (towers[t.def.id] ?? 0) + 1;
  const s = g.stat;
  return {
    won: g.state === 'won',
    lives: g.lives,
    stars: g.stars,
    wave: g.waveIdx + 1,
    time: g.time,
    spent: s.spent,
    income: level.startMoney + s.earnKills + s.earnWaves + s.earnObst,
    potential: g.potentialIncome(),
    towers,
    leaks: s.leaks,
  };
}

/** Menor fração da renda com que o estrategista ainda vence (busca binária). */
export function minWinningCap(level: LevelData, iters = 6): { cap: number; full: RunResult } {
  const full = runGame(level, 'strategist', { cap: 1 });
  if (!full.won) return { cap: Infinity, full };
  let lo = 0.4;
  let hi = 1.0;
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    const r = runGame(level, 'strategist', { cap: mid });
    if (r.won) hi = mid;
    else lo = mid;
  }
  return { cap: hi, full };
}
