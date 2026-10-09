import { RESEARCH, TOWERS, ABILITIES } from './data';
import type { AbilityMods, Mods, ResearchTree, TowerMods } from './types';

export function emptyTowerMods(): TowerMods {
  return {
    dmg: 0, rate: 0, range: 0, cost: 0, upg: 0, aoe: 0, burn: 0, ramp: 0, rampSpeed: 0, crit: 0,
    minRange: 0, slow: 0, aura: 0, auraDmg: 0, reveal: 0,
    vs: { INF: 0, LEV: 0, PES: 0, AER: 0, ESC: 0 },
  };
}

export function emptyAbilityMods(): AbilityMods {
  return { power: 0, radius: 0, duration: 0, cd: 0 };
}

/** Chave de nó: "torre:mg:n1" ou "hab:aereo:x". */
export function nodeKey(kind: 'torre' | 'hab', owner: string, node: string): string {
  return `${kind}:${owner}:${node}`;
}

export function treeOf(kind: 'torre' | 'hab', owner: string): ResearchTree {
  return kind === 'torre' ? RESEARCH.towers[owner] : RESEARCH.abilities[owner];
}

/** Soma os bônus dos nós pesquisados. */
export function computeMods(researched: Iterable<string>): Mods {
  const mods: Mods = { towers: {}, abilities: {} };
  for (const t of TOWERS) mods.towers[t.id] = emptyTowerMods();
  for (const a of ABILITIES) mods.abilities[a.id] = emptyAbilityMods();
  for (const key of researched) {
    const [kind, owner, nodeId] = key.split(':');
    const tree = treeOf(kind as 'torre' | 'hab', owner);
    if (!tree) continue;
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (!node) continue;
    if (kind === 'torre') {
      const m = mods.towers[owner];
      for (const [k, v] of Object.entries(node.fx)) {
        if (k.startsWith('vs.')) (m.vs as any)[k.slice(3)] += v;
        else (m as any)[k] += v;
      }
    } else {
      const m = mods.abilities[owner];
      for (const [k, v] of Object.entries(node.fx)) (m as any)[k] += v;
    }
  }
  return mods;
}

export type NodeState = 'pesquisado' | 'disponivel' | 'bloqueado' | 'excluido';

export function nodeState(
  kind: 'torre' | 'hab', owner: string, nodeId: string, researched: Set<string>,
): NodeState {
  const tree = treeOf(kind, owner);
  const node = tree.nodes.find((n) => n.id === nodeId)!;
  if (researched.has(nodeKey(kind, owner, nodeId))) return 'pesquisado';
  // travado por escolha de ramo
  for (const other of tree.nodes) {
    if (other.excl.includes(nodeId) && researched.has(nodeKey(kind, owner, other.id))) return 'excluido';
  }
  // ramo exclusivo: se o nó pertence a uma cadeia cuja raiz foi excluída
  if (node.req.length === 0) return 'disponivel';
  const ok = node.req.some((r) => researched.has(nodeKey(kind, owner, r)));
  if (!ok) {
    // se todos os pré-requisitos estão excluídos, o nó também está
    const allExcluded = node.req.every((r) => nodeState(kind, owner, r, researched) === 'excluido');
    return allExcluded ? 'excluido' : 'bloqueado';
  }
  return 'disponivel';
}

export function spentPoints(researched: Iterable<string>): number {
  let s = 0;
  for (const key of researched) {
    const [kind, owner, nodeId] = key.split(':');
    const tree = treeOf(kind as 'torre' | 'hab', owner);
    const node = tree?.nodes.find((n) => n.id === nodeId);
    if (node) s += node.cost;
  }
  return s;
}

/**
 * "Árvore esperada" usada pelos bots: distribui `points` entre as torres indicadas,
 * em ordem de nós (tronco comum e depois o ramo A), uma torre por vez.
 */
export function expectedResearch(points: number, towerIds: string[], abilityIds: string[] = []): Set<string> {
  const set = new Set<string>();
  const order = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'a1', 'a2', 'a3'];
  const ptr: Record<string, number> = {};
  const owners: { kind: 'torre' | 'hab'; id: string }[] = [
    ...towerIds.map((id) => ({ kind: 'torre' as const, id })),
    ...abilityIds.map((id) => ({ kind: 'hab' as const, id })),
  ];
  if (owners.length === 0) return set;
  let left = points;
  let guard = 0;
  while (left > 0 && guard++ < 500) {
    let progressed = false;
    for (const o of owners) {
      const tree = treeOf(o.kind, o.id);
      const ord = o.kind === 'torre' ? order : ['n1', 'n2', 'n3', 'x', 'n6'];
      const i = ptr[o.kind + o.id] ?? 0;
      if (i >= ord.length) continue;
      const node = tree.nodes.find((n) => n.id === ord[i])!;
      if (node.cost > left) continue;
      set.add(nodeKey(o.kind, o.id, node.id));
      left -= node.cost;
      ptr[o.kind + o.id] = i + 1;
      progressed = true;
      if (left <= 0) break;
    }
    if (!progressed) break;
  }
  return set;
}
