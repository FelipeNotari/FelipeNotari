// Ajustador automático: para cada fase, encontra o maior multiplicador de vida (hpMult)
// com que o bot estrategista ainda vence gastando só CAP da renda. Assim a renda total
// fica ~1/CAP do custo da defesa vencedora de referência.
// Uso: npx tsx tools/tune.ts [--levels 1,2,3]   (grava tools/out/tuning.json e regera as fases)
import { fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { generate, writeLevels } from './gen-levels';
import { minWinningCap, runGame } from './simlib';
import type { LevelData } from '../src/core/types';

const OUT_DIR = path.resolve(import.meta.dirname, 'out');
const TUNING = path.resolve(import.meta.dirname, 'tuning.json');

export function capTarget(level: LevelData): number {
  const boss = level.waves[level.waves.length - 1].groups.some((g) => g.enemy.startsWith('boss_'));
  // curva crescente e suave: 0,77 na fase 1 até ~0,855 na 20; chefes um pouco acima (pico)
  // curva crescente e suave até o limite da faixa econômica (renda >= 1,15x); chefes no topo
  const base = Math.min(0.84, 0.775 + 0.011 * (level.id - 1));
  return Math.min(0.855, base + (boss ? 0.015 : 0));
}

const r3 = (h: number) => Math.round(h * 1000) / 1000;

function capAt(level: LevelData, h: number): number {
  return minWinningCap({ ...level, hpMult: r3(h) }, 7).cap;
}

function robust(level: LevelData, h: number): boolean {
  for (let s = 0; s < 5; s++) if (!runGame({ ...level, hpMult: r3(h) }, 'strategist', { seed: 100 + s }).won) return false;
  return true;
}

/** Busca o hpMult em que o gasto mínimo para vencer fica no alvo (com folga em várias sementes). */
function tuneLevel(level: LevelData, start: number): { h: number; cap: number } {
  const target = capTarget(level);
  let h = start;
  let c = capAt(level, h);
  let lo = 0;
  let hi = 0;
  let cLo = 0;
  let cHi = 0;
  let guard = 0;
  if (c <= target) {
    lo = h;
    cLo = c;
    hi = h * 1.3;
    cHi = capAt(level, hi);
    while (cHi <= target && guard++ < 12) {
      lo = hi;
      cLo = cHi;
      hi *= 1.3;
      cHi = capAt(level, hi);
    }
  } else {
    hi = h;
    cHi = c;
    lo = h / 1.3;
    cLo = capAt(level, lo);
    while (cLo > target && guard++ < 12) {
      hi = lo;
      cHi = cLo;
      lo /= 1.3;
      cLo = capAt(level, lo);
    }
  }
  for (let i = 0; i < 6; i++) {
    const mid = Math.sqrt(lo * hi);
    const cm = capAt(level, mid);
    if (cm <= target) {
      lo = mid;
      cLo = cm;
    } else {
      hi = mid;
      cHi = cm;
    }
    if (Math.abs(cm - target) < 0.012) {
      lo = mid;
      cLo = cm;
      break;
    }
  }
  // garante vitória com orçamento cheio em várias sementes
  let tries = 0;
  while (!robust(level, lo) && tries++ < 4) {
    lo *= 0.96;
    cLo = capAt(level, lo);
  }
  // busca local se ficou fora da faixa (a resposta do bot não é perfeitamente monótona)
  if (Math.abs(cLo - target) > 0.02 || cLo < 0.771 || cLo > 0.868) {
    let best = { h: lo, c: cLo, d: Math.abs(cLo - target) };
    for (const f of [1.02, 0.98, 1.04, 0.96, 1.07, 0.93, 1.1, 0.9, 1.14, 0.86]) {
      const h2 = lo * f;
      const c2 = capAt(level, h2);
      const d2 = Math.abs(c2 - target);
      if (d2 < best.d && robust(level, h2)) best = { h: h2, c: c2, d: d2 };
      if (best.d <= 0.02) break;
    }
    lo = best.h;
    cLo = best.c;
  }
  return { h: r3(lo), cap: cLo };
}

function loadTuning(): { hp: Record<string, number>; money: Record<string, number> } {
  try {
    return JSON.parse(fs.readFileSync(TUNING, 'utf8'));
  } catch {
    return { hp: {}, money: {} };
  }
}

if (process.argv.includes('--worker')) {
  const ids = process.argv[process.argv.indexOf('--worker') + 1].split(',').map(Number);
  const tuning = loadTuning();
  const levels = generate(tuning.hp, tuning.money);
  for (const id of ids) {
    const level = levels.find((l) => l.id === id)!;
    const r = tuneLevel(level, tuning.hp[id] ?? 1);
    process.send!({ id, h: r.h, cap: r.cap });
  }
  process.exit(0);
} else {
  const arg = process.argv.indexOf('--levels');
  const all = generate().map((l) => l.id);
  const ids = arg >= 0 ? process.argv[arg + 1].split(',').map(Number) : all;
  const tuning = loadTuning();
  const nWorkers = Math.min(4, ids.length);
  const buckets: number[][] = Array.from({ length: nWorkers }, () => []);
  // fases longas primeiro, distribuídas
  [...ids].sort((a, b) => b - a).forEach((id, i) => buckets[i % nWorkers].push(id));
  let done = 0;
  const t0 = Date.now();
  await Promise.all(
    buckets.map(
      (b) =>
        new Promise<void>((resolve) => {
          const child = fork(import.meta.filename, ['--worker', b.join(',')], { execArgv: ['--import', 'tsx'] });
          child.on('message', (m: any) => {
            tuning.hp[m.id] = m.h;
            done++;
            console.log(`fase ${m.id}: hpMult=${m.h} capMin=${m.cap.toFixed(3)} (${done}/${ids.length}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
          });
          child.on('exit', () => resolve());
        }),
    ),
  );
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(TUNING, JSON.stringify(tuning, null, 1));
  writeLevels(generate(tuning.hp, tuning.money));
  console.log('ajuste gravado em', TUNING);
}
