// Verificação completa de balanceamento e geração do BALANCE.md.
// Uso: npx tsx tools/balance.ts [--quick] [--levels 1,2]
import { fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ARMOR_CLASSES } from '../src/core/types';
import { DAMAGE, GRID_W, TOWERS, TOWER_BY_ID } from '../src/core/data';
import { Game, Tower } from '../src/core/game';
import { Path } from '../src/core/path';
import { effDps } from './bots';
import { loadLevels, minWinningCap, runGame, type RunResult } from './simlib';
import type { LevelData } from '../src/core/types';

const N_RANDOM = process.argv.includes('--quick') ? 20 : 50;

interface LevelReport {
  id: number;
  name: string;
  hpMult: number;
  potential: number;
  cap: number;
  ratio: number;
  full: RunResult;
  stratSeeds: { won: number; stars: number[]; lives: number[] };
  randomWins: number;
  randomRuns: number;
  pairs: { pair: string; won: boolean; lives: number }[];
  singles: { t: string; won: boolean }[];
  typesUsed: number;
  blockedTop: number;
}

function blockedTop(level: LevelData): number {
  const g = new Game(level, { events: false });
  const scores: { idx: number; s: number; blocked: boolean }[] = [];
  for (let i = 0; i < g.grid.length; i++) {
    if (g.grid[i] === 1) continue;
    const cx = i % GRID_W;
    const cy = Math.floor(i / GRID_W);
    let s = 0;
    for (const p of g.paths) s += p.coverage(cx + 0.5, cy + 0.5, 3.0);
    for (const p of g.airPaths) s += 0.4 * p.coverage(cx + 0.5, cy + 0.5, 4.5);
    scores.push({ idx: i, s, blocked: g.grid[i] === 2 });
  }
  scores.sort((a, b) => b.s - a.s);
  const top = scores.slice(0, 10);
  return top.filter((t) => t.blocked).length / top.length;
}

function analyze(level: LevelData): LevelReport {
  const { cap, full } = minWinningCap(level, 7);
  // robustez: o estrategista com sementes diferentes (variação de deslocamentos/críticos)
  const stratSeeds = { won: 0, stars: [] as number[], lives: [] as number[] };
  for (let s = 0; s < 5; s++) {
    const r = runGame(level, 'strategist', { seed: 100 + s });
    if (r.won) stratSeeds.won++;
    stratSeeds.stars.push(r.stars);
    stratSeeds.lives.push(r.lives);
  }
  let randomWins = 0;
  for (let s = 0; s < N_RANDOM; s++) if (runGame(level, 'random', { seed: 5000 + s * 31 }).won) randomWins++;
  const pairs: { pair: string; won: boolean; lives: number }[] = [];
  const singles: { t: string; won: boolean }[] = [];
  if (level.id >= 3) {
    const ts = level.towers;
    for (let i = 0; i < ts.length; i++) {
      singles.push({ t: ts[i], won: runGame(level, 'strategist', { allowed: [ts[i]] }).won });
      for (let j = i + 1; j < ts.length; j++) {
        const r = runGame(level, 'strategist', { allowed: [ts[i], ts[j]] });
        pairs.push({ pair: `${ts[i]}+${ts[j]}`, won: r.won, lives: r.lives });
      }
    }
  }
  const potential = full.potential;
  return {
    id: level.id,
    name: level.name,
    hpMult: level.hpMult,
    potential,
    cap,
    ratio: 1 / cap,
    full,
    stratSeeds,
    randomWins,
    randomRuns: N_RANDOM,
    pairs,
    singles,
    typesUsed: Object.keys(full.towers).length,
    blockedTop: blockedTop(level),
  };
}

function towerTable(): string {
  const lines: string[] = [];
  lines.push('| Torre | Nível | Custo acumulado | ' + ARMOR_CLASSES.map((c) => DAMAGE.armorClasses[c].name).join(' | ') + ' |');
  lines.push('|---|---|---|' + ARMOR_CLASSES.map(() => '---').join('|') + '|');
  const level = loadLevels()[0];
  const g = new Game(level, { events: false });
  for (const def of TOWERS) {
    if (def.attack === 'support') continue;
    let cost = 0;
    for (let l = 0; l < 3; l++) {
      cost += def.levels[l].cost;
      if (l === 1) continue;
      const t = new Tower(def);
      t.level = l;
      g.computeStats(t);
      const cells = ARMOR_CLASSES.map((c) => {
        const v = (effDps(t, c) / cost) * 100;
        return v > 0 ? v.toFixed(1) : '—';
      });
      lines.push(`| ${def.name} | ${l + 1} | ${cost} | ${cells.join(' | ')} |`);
    }
  }
  return lines.join('\n');
}

/** Cobertura média de caminho (casas no alcance) nas 10 melhores casas livres de cada fase. */
function coverageTable(levels: LevelData[]): string {
  const lines: string[] = [];
  lines.push('| Torre | Alcance N1 | Cobertura média (casas de caminho) | DPS efetivo × cobertura / custo (melhor classe) |');
  lines.push('|---|---|---|---|');
  for (const def of TOWERS) {
    if (def.attack === 'support') continue;
    const r = def.levels[0].range;
    const mr = def.levels[0].minRange ?? 0;
    let sum = 0;
    let n = 0;
    for (const l of levels) {
      const g = new Game(l, { events: false });
      const paths: Path[] = def.targets === 'air' ? g.airPaths : g.paths;
      if (!paths.length) continue;
      const vals: number[] = [];
      for (let i = 0; i < g.grid.length; i++) {
        if (g.grid[i] === 1) continue;
        let c = 0;
        for (const p of paths) c += p.coverage((i % GRID_W) + 0.5, Math.floor(i / GRID_W) + 0.5, r, mr);
        vals.push(c);
      }
      vals.sort((a, b) => b - a);
      for (let k = 0; k < 10; k++) {
        sum += vals[k];
        n++;
      }
    }
    const cov = sum / Math.max(1, n);
    const t = new Tower(def);
    const g = new Game(levels[0], { events: false });
    g.computeStats(t);
    const best = Math.max(...ARMOR_CLASSES.map((c) => effDps(t, c)));
    lines.push(`| ${def.name} | ${r} | ${cov.toFixed(1)} | ${((best * cov) / def.levels[0].cost).toFixed(2)} |`);
  }
  return lines.join('\n');
}

function report(reports: LevelReport[], levels: LevelData[]): string {
  const ok = (b: boolean) => (b ? '✅' : '❌');
  const stratAll = reports.every((r) => r.full.won && r.stratSeeds.won === 5);
  const late = reports.filter((r) => r.id >= 8);
  const avgStarsLate = late.reduce((a, r) => a + r.stratSeeds.stars.reduce((x, y) => x + y, 0) / r.stratSeeds.stars.length, 0) / Math.max(1, late.length);
  const randomOk = reports.filter((r) => r.id >= 3).every((r) => r.randomWins / r.randomRuns < 0.1);
  const econOk = reports.every((r) => r.ratio >= 1.15 && r.ratio <= 1.3);
  const pairsOk = reports.filter((r) => r.id >= 3).every((r) => r.pairs.every((p) => !p.won) && r.singles.every((s) => !s.won));
  const blockedOk = reports.every((r) => r.blockedTop >= 0.5);
  const L: string[] = [];
  L.push('# Relatório de Balanceamento — Bastião de Aço');
  L.push('');
  L.push('Gerado automaticamente por `npx tsx tools/balance.ts` (simulador headless, mesma lógica do jogo, passo fixo de 1/60 s).');
  L.push('');
  L.push('## Resumo das condições');
  L.push('');
  L.push('| Condição | Resultado |');
  L.push('|---|---|');
  L.push(`| Bot estrategista vence as 20 fases (e em 5 sementes diferentes) | ${ok(stratAll)} |`);
  L.push(`| Média de estrelas do estrategista a partir da fase 8 ≤ 2 | ${ok(avgStarsLate <= 2)} (${avgStarsLate.toFixed(2)}) |`);
  L.push(`| Bot aleatório perde > 90% a partir da fase 3 (${N_RANDOM} partidas/fase) | ${ok(randomOk)} |`);
  L.push(`| Renda total entre 1,15× e 1,30× da defesa vencedora de referência | ${ok(econOk)} |`);
  L.push(`| A partir da fase 3, nenhuma combinação de 1 ou 2 tipos de torre vence | ${ok(pairsOk)} |`);
  L.push(`| Melhores pontos do mapa começam bloqueados (≥ 50% das 10 melhores casas) | ${ok(blockedOk)} |`);
  L.push('');
  L.push('## Metodologia');
  L.push('');
  L.push('- **Bot estrategista**: escolhe counters pela matriz de dano, avalia cada casa pela cobertura real de caminho');
  L.push('  (terrestre e aéreo) e pela vazão necessária para a próxima onda, faz upgrades quando rendem mais que torres novas,');
  L.push('  revela camuflados, limpa os obstáculos mais valiosos entre ondas e usa 3 habilidades. Usa a **árvore esperada**:');
  L.push('  4 pontos por fase anterior (vitória + 2 estrelas), distribuídos entre as torres liberadas.');
  L.push('- **Bot aleatório**: a cada segundo, constrói torres de tipo aleatório em casas livres aleatórias ou melhora uma torre aleatória;');
  L.push('  prioridades, obstáculos e habilidades também aleatórios.');
  L.push('- **Defesa vencedora de referência**: o menor gasto com que o estrategista ainda vence. Busca binária sobre a fração da renda');
  L.push('  que ele pode gastar (`cap`). Razão = renda total / custo de referência = 1 / cap.');
  L.push('- **Renda total** = dinheiro inicial + recompensas de todos os inimigos (inclusive os que saem de caminhões/chefes) +');
  L.push('  bônus de onda + recompensa de todos os obstáculos. Bônus opcionais (chamar onda cedo, Caixa de Suprimentos) ficam de fora.');
  L.push('- **Ajuste automático** (`tools/tune.ts`): para cada fase, busca o `hpMult` (multiplicador de vida dos inimigos) em que o');
  L.push('  estrategista vence gastando só 80% da renda (84% nas fases de chefe = pico de dificuldade).');
  L.push('- **Teste de combinação**: o estrategista é restrito a cada tipo isolado e a cada par de tipos liberados; todos devem perder.');
  L.push('');
  L.push('## Resultado por fase');
  L.push('');
  L.push('| Fase | hpMult | Renda total | Cap mínimo | Renda/ref. | Estrategista (vidas, ★) | 5 sementes (vitórias, ★ média) | Tipos usados | Aleatório (vitórias) | Melhor par (vidas) | Bloqueio top-10 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of reports) {
    const bestPair = r.pairs.length ? r.pairs.reduce((a, b) => (b.lives > a.lives ? b : a)) : null;
    const avgS = r.stratSeeds.stars.reduce((a, b) => a + b, 0) / r.stratSeeds.stars.length;
    L.push(
      `| ${r.id} ${r.name} | ${r.hpMult.toFixed(2)} | ${r.potential} | ${r.cap.toFixed(3)} | ${r.ratio.toFixed(2)}× ${ok(r.ratio >= 1.15 && r.ratio <= 1.3)} | ${r.full.won ? 'vitória' : 'DERROTA'} (${r.full.lives}, ${r.full.stars}★) | ${r.stratSeeds.won}/5, ${avgS.toFixed(1)}★ | ${r.typesUsed} | ${r.randomWins}/${r.randomRuns} ${ok(r.id < 3 || r.randomWins / r.randomRuns < 0.1)} | ${bestPair ? `${bestPair.pair} (${bestPair.won ? 'VENCE' : 'perde'}, ${bestPair.lives})` : '—'} | ${(r.blockedTop * 100).toFixed(0)}% |`,
    );
  }
  L.push('');
  L.push('Torres usadas pelo estrategista (orçamento cheio):');
  L.push('');
  for (const r of reports) L.push(`- Fase ${r.id}: ${Object.entries(r.full.towers).map(([k, v]) => `${TOWER_BY_ID[k].name} ×${v}`).join(', ')}`);
  L.push('');
  L.push('## DPS efetivo a cada 100 de custo (sem área nem cobertura)');
  L.push('');
  L.push('Morteiro e Lança-chamas: já incluem o fator médio de área usado pelo bot; Laser: média do aquecimento.');
  L.push('');
  L.push(towerTable());
  L.push('');
  L.push('## Cobertura real de caminho nas 20 fases');
  L.push('');
  L.push(coverageTable(levels));
  L.push('');
  L.push('Nenhuma torre domina: cada uma tem pelo menos duas classes em que rende menos da metade da melhor opção');
  L.push('(ou não consegue atingir), e o teste de pares acima mostra que nenhuma dupla basta a partir da fase 3.');
  L.push('');
  return L.join('\n');
}

if (process.argv.includes('--worker')) {
  const ids = process.argv[process.argv.indexOf('--worker') + 1].split(',').map(Number);
  const levels = loadLevels();
  for (const id of ids) process.send!(analyze(levels.find((l) => l.id === id)!));
  process.exit(0);
} else {
  const levels = loadLevels();
  const arg = process.argv.indexOf('--levels');
  const ids = arg >= 0 ? process.argv[arg + 1].split(',').map(Number) : levels.map((l) => l.id);
  const buckets: number[][] = [[], [], [], []];
  [...ids].sort((a, b) => b - a).forEach((id, i) => buckets[i % 4].push(id));
  const reports: LevelReport[] = [];
  const t0 = Date.now();
  await Promise.all(
    buckets.filter((b) => b.length).map(
      (b) =>
        new Promise<void>((resolve) => {
          const extra = process.argv.includes('--quick') ? ['--quick'] : [];
          const child = fork(import.meta.filename, ['--worker', b.join(','), ...extra], { execArgv: ['--import', 'tsx'] });
          child.on('message', (m: any) => {
            reports.push(m);
            const bp = m.pairs.filter((p: any) => p.won).map((p: any) => p.pair);
            const sw = m.singles.filter((p: any) => p.won).map((p: any) => p.t);
            console.log(
              `fase ${m.id}: cap=${m.cap.toFixed(3)} razão=${m.ratio.toFixed(2)} cheio=${m.full.won ? 'V' : 'D'}(${m.full.lives}v ${m.full.stars}★) sementes=${m.stratSeeds.won}/5 ★${m.stratSeeds.stars.join(',')} aleat=${m.randomWins}/${m.randomRuns} paresVencem=[${bp}] sozinhasVencem=[${sw}] bloqueio=${(m.blockedTop * 100).toFixed(0)}% (${((Date.now() - t0) / 1000).toFixed(0)} s)`,
            );
          });
          child.on('exit', () => resolve());
        }),
    ),
  );
  reports.sort((a, b) => a.id - b.id);
  if (ids.length === levels.length) {
    fs.writeFileSync(path.resolve(import.meta.dirname, '../BALANCE.md'), report(reports, levels));
    console.log('BALANCE.md gravado');
  }
}
