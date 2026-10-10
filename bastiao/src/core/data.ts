import damageJson from '../data/damage.json';
import towersJson from '../data/towers.json';
import enemiesJson from '../data/enemies.json';
import obstaclesJson from '../data/obstacles.json';
import abilitiesJson from '../data/abilities.json';
import researchJson from '../data/research.json';
import type {
  AbilityDef, ArmorClass, DamageType, EnemyDef, ObstacleDef, ResearchTree, TowerDef,
} from './types';

export const DAMAGE = damageJson as unknown as {
  damageTypes: Record<DamageType, { name: string; color: string; desc: string }>;
  armorClasses: Record<ArmorClass, { name: string; color: string }>;
  matrix: Record<DamageType, Record<ArmorClass, number>>;
  notes: string;
};
export const MATRIX = DAMAGE.matrix;

export const TOWERS = towersJson as unknown as TowerDef[];
export const ENEMIES = enemiesJson as unknown as EnemyDef[];
export const OBSTACLES = obstaclesJson as unknown as ObstacleDef[];
export const ABILITIES = abilitiesJson as unknown as AbilityDef[];
export const RESEARCH = researchJson as unknown as {
  towers: Record<string, ResearchTree>;
  abilities: Record<string, ResearchTree>;
};

export const TOWER_BY_ID: Record<string, TowerDef> = {};
for (const t of TOWERS) TOWER_BY_ID[t.id] = t;
export const ENEMY_BY_ID: Record<string, EnemyDef> = {};
for (const e of ENEMIES) ENEMY_BY_ID[e.id] = e;
export const OBSTACLE_BY_ID: Record<string, ObstacleDef> = {};
for (const o of OBSTACLES) OBSTACLE_BY_ID[o.id] = o;
export const ABILITY_BY_ID: Record<string, AbilityDef> = {};
for (const a of ABILITIES) ABILITY_BY_ID[a.id] = a;

export const GRID_W = 24;
export const GRID_H = 14;
export const DT = 1 / 60;
export const SELL_RATE = 0.7;
export const STAR_LIVES = [10, 20]; // >=10 vidas: 2 estrelas; 20 (nenhuma perdida): 3 estrelas
export const MAX_LIVES_DEFAULT = 20;

export function starsFor(lives: number): number {
  if (lives <= 0) return 0;
  if (lives >= STAR_LIVES[1]) return 3;
  if (lives >= STAR_LIVES[0]) return 2;
  return 1;
}

export function earlyBonusRate(waveNumber: number): number {
  return 2 + 0.3 * waveNumber;
}
