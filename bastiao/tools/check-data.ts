// Verificação dos dados do jogo (roda no GitHub Actions antes de compilar).
// Garante que qualquer fase nova (ex.: fase-21.json) está bem formada.
import { ABILITY_BY_ID, DAMAGE, ENEMY_BY_ID, GRID_H, GRID_W, OBSTACLE_BY_ID, RESEARCH, TOWERS, TOWER_BY_ID } from '../src/core/data';
import { Game } from '../src/core/game';
import { ARMOR_CLASSES, DAMAGE_TYPES } from '../src/core/types';
import { loadLevels } from './simlib';

const errors: string[] = [];
const err = (m: string) => errors.push(m);

// matriz de dano
for (const d of DAMAGE_TYPES)
  for (const c of ARMOR_CLASSES) {
    const v = DAMAGE.matrix[d]?.[c];
    if (typeof v !== 'number') err(`matriz: falta ${d}/${c}`);
    else if (v !== 0 && (v < 0.25 || v > 2)) err(`matriz: ${d}/${c}=${v} fora de 0,25–2`);
  }

// árvores de pesquisa
let purchasable = 0;
for (const t of TOWERS) {
  const tree = RESEARCH.towers[t.id];
  if (!tree) {
    err(`pesquisa: torre ${t.id} sem árvore`);
    continue;
  }
  if (tree.nodes.length < 10) err(`pesquisa: ${t.id} tem menos de 10 nós`);
  if (!tree.nodes.some((n) => n.excl.length)) err(`pesquisa: ${t.id} sem ramo exclusivo`);
  const ids = new Set(tree.nodes.map((n) => n.id));
  for (const n of tree.nodes) for (const r of [...n.req, ...n.excl]) if (!ids.has(r)) err(`pesquisa: ${t.id}/${n.id} referencia ${r}`);
  purchasable += tree.nodes.filter((n) => !n.id.startsWith('b')).reduce((a, n) => a + n.cost, 0);
}
for (const a of Object.keys(ABILITY_BY_ID)) {
  const tree = RESEARCH.abilities[a];
  if (!tree) err(`pesquisa: habilidade ${a} sem árvore`);
  else purchasable += tree.nodes.filter((n) => n.id !== 'y').reduce((s, n) => s + n.cost, 0);
}

// fases
const levels = loadLevels();
const seen = new Set<number>();
for (const l of levels) {
  const tag = `fase ${l.id}`;
  if (seen.has(l.id)) err(`${tag}: id repetido`);
  seen.add(l.id);
  if (!l.name) err(`${tag}: sem nome`);
  if (!['deserto', 'cidade', 'neve', 'industrial'].includes(l.biome)) err(`${tag}: bioma inválido ${l.biome}`);
  if (!(l.startMoney > 0)) err(`${tag}: dinheiro inicial inválido`);
  if (!(l.hpMult > 0)) err(`${tag}: hpMult inválido`);
  if (!l.paths?.length) err(`${tag}: sem caminhos`);
  for (const t of l.towers) if (!TOWER_BY_ID[t]) err(`${tag}: torre desconhecida ${t}`);
  for (const a of l.abilities) if (!ABILITY_BY_ID[a]) err(`${tag}: habilidade desconhecida ${a}`);
  const base = l.paths[0][l.paths[0].length - 1];
  for (const p of l.paths) {
    const end = p[p.length - 1];
    if (end[0] !== base[0] || end[1] !== base[1]) err(`${tag}: caminho não termina na base`);
    for (let i = 1; i < p.length; i++) if (p[i][0] !== p[i - 1][0] && p[i][1] !== p[i - 1][1]) err(`${tag}: trecho diagonal na estrada`);
  }
  for (const o of l.obstacles) {
    if (!OBSTACLE_BY_ID[o.type]) err(`${tag}: obstáculo desconhecido ${o.type}`);
    if (o.x < 0 || o.y < 0 || o.x >= GRID_W || o.y >= GRID_H) err(`${tag}: obstáculo fora do mapa`);
  }
  if (!l.waves?.length) err(`${tag}: sem ondas`);
  for (const [wi, w] of l.waves.entries()) {
    if (!w.groups.length) err(`${tag}: onda ${wi + 1} vazia`);
    for (const g of w.groups) {
      const e = ENEMY_BY_ID[g.enemy];
      if (!e) {
        err(`${tag}: inimigo desconhecido ${g.enemy}`);
        continue;
      }
      if (e.air && !l.airPaths?.length) err(`${tag}: inimigo aéreo sem rota aérea`);
      if (!(g.count > 0) || !(g.interval > 0)) err(`${tag}: grupo inválido na onda ${wi + 1}`);
    }
  }
  try {
    const g = new Game(l, { events: false });
    for (let i = 0; i < 600; i++) g.step(1 / 60);
    for (const o of l.obstacles) if (g.obstacleAtCell(o.x, o.y) === null) err(`${tag}: obstáculo em (${o.x},${o.y}) sobre a estrada`);
  } catch (e) {
    err(`${tag}: falha ao simular: ${(e as Error).message}`);
  }
}
const maxPoints = levels.length * 5;
if (purchasable <= maxPoints) err(`pesquisa: pontos do jogo (${maxPoints}) bastam para comprar tudo (${purchasable})`);

if (errors.length) {
  console.error('ERROS NOS DADOS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`dados ok: ${levels.length} fases, ${TOWERS.length} torres, pontos máximos ${maxPoints} < ${purchasable} necessários para um ramo completo de tudo`);
