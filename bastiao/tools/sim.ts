// Simulador headless. Uso:
//   npx tsx tools/sim.ts                 -> estrategista em todas as fases
//   npx tsx tools/sim.ts --level 3       -> só a fase 3
//   npx tsx tools/sim.ts --random 50     -> também 50 partidas do bot aleatório por fase
import { loadLevels, runGame } from './simlib';

const args = process.argv.slice(2);
const lvlArg = args.indexOf('--level');
const only = lvlArg >= 0 ? Number(args[lvlArg + 1]) : 0;
const rndArg = args.indexOf('--random');
const nRandom = rndArg >= 0 ? Number(args[rndArg + 1]) : 0;
const capArg = args.indexOf('--cap');
const cap = capArg >= 0 ? Number(args[capArg + 1]) : 1;

for (const level of loadLevels()) {
  if (only && level.id !== only) continue;
  const t0 = Date.now();
  const r = runGame(level, 'strategist', { cap });
  const ms = Date.now() - t0;
  let line = `Fase ${String(level.id).padStart(2)} ${level.name.padEnd(20)} estrategista: ${r.won ? 'VITÓRIA' : 'derrota'} vidas=${r.lives} ★${r.stars} onda=${r.wave}/${level.waves.length} gasto=${r.spent} renda=${r.income}/${r.potential} torres=${JSON.stringify(r.towers)} (${ms} ms, ${r.time.toFixed(0)} s de jogo)`;
  if (nRandom > 0) {
    let wins = 0;
    for (let s = 0; s < nRandom; s++) if (runGame(level, 'random', { seed: 1000 + s }).won) wins++;
    line += ` | aleatório: ${wins}/${nRandom} vitórias`;
  }
  console.log(line);
}
