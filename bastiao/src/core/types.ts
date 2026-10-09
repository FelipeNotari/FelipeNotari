export type DamageType = 'BAL' | 'PER' | 'EXP' | 'ENE' | 'FOG';
export type ArmorClass = 'INF' | 'LEV' | 'PES' | 'AER' | 'ESC';
export const DAMAGE_TYPES: DamageType[] = ['BAL', 'PER', 'EXP', 'ENE', 'FOG'];
export const ARMOR_CLASSES: ArmorClass[] = ['INF', 'LEV', 'PES', 'AER', 'ESC'];

export type Biome = 'deserto' | 'cidade' | 'neve' | 'industrial';
export type TargetKind = 'ground' | 'air' | 'both' | 'none';
export type AttackKind = 'hitscan' | 'shell' | 'mortar' | 'missile' | 'flame' | 'beam' | 'support';

export interface TowerLevelDef {
  cost: number;
  dmg?: number;
  rate?: number;
  range: number;
  minRange?: number;
  aoe?: number;
  flight?: number;
  projSpeed?: number;
  missiles?: number;
  cone?: number;
  burnDps?: number;
  burnTime?: number;
  rampMax?: number;
  rampTime?: number;
  slow?: number;
  aura?: number;
  auraRadius?: number;
  auraDmg?: number;
  revealCamo?: boolean;
}

export interface TowerDef {
  id: string;
  name: string;
  short: string;
  role: string;
  dmgType: DamageType;
  targets: TargetKind;
  attack: AttackKind;
  unlock: number;
  levels: TowerLevelDef[];
}

export interface EnemyDef {
  id: string;
  name: string;
  cls: ArmorClass;
  hp: number;
  speed: number;
  reward: number;
  lives: number;
  size: number;
  intro: number;
  desc: string;
  air?: boolean;
  vehicle?: boolean;
  camo?: boolean;
  spawnOnDeath?: { id: string; n: number };
  heal?: { radius: number; pct: number };
  shieldAura?: { radius: number; pct: number; cap: number; regen: number };
  kamikaze?: { radius: number; disable: number; blast: number; diveSpeed: number };
  boss?: 'escorpiao' | 'colosso' | 'fortaleza' | 'ciclope';
  bossParams?: Record<string, any>;
}

export interface ObstacleDef {
  id: string;
  name: string;
  cls: ArmorClass;
  hp: number;
  reward: number;
  explode?: { dmg: number; radius: number };
}

export interface AbilityDef {
  id: string;
  name: string;
  unlock: number;
  cooldown: number;
  target: 'any' | 'path' | 'none';
  desc: string;
  params: Record<string, number>;
}

export interface ResearchNode {
  id: string;
  name: string;
  desc: string;
  cost: number;
  row: number;
  col: number;
  req: string[]; // basta um deles (vazio = raiz)
  excl: string[]; // pesquisar este trava os listados
  fx: Record<string, number>;
}

export interface ResearchTree {
  branchA: string;
  branchB: string;
  nodes: ResearchNode[];
}

export interface WaveGroup {
  enemy: string;
  count: number;
  interval: number;
  delay: number;
  path: number; // indice em paths (terra) ou airPaths (ar)
}

export interface WaveDef {
  bonus: number;
  groups: WaveGroup[];
}

export interface LevelData {
  id: number;
  name: string;
  biome: Biome;
  map: { x: number; y: number };
  startMoney: number;
  lives: number;
  hpMult: number;
  waveGap: number;
  towers: string[];
  abilities: string[];
  paths: number[][][];
  airPaths: number[][][];
  obstacles: { type: string; x: number; y: number }[];
  decor?: { type: string; x: number; y: number }[];
  waves: WaveDef[];
  tutorial?: boolean;
  briefing?: string;
}

/** Bônus de pesquisa já somados para uma torre. */
export interface TowerMods {
  dmg: number;
  rate: number;
  range: number;
  cost: number;
  upg: number;
  aoe: number;
  burn: number;
  ramp: number;
  rampSpeed: number;
  crit: number;
  minRange: number;
  slow: number;
  aura: number;
  auraDmg: number;
  reveal: number;
  vs: Record<ArmorClass, number>;
}

export interface AbilityMods {
  power: number;
  radius: number;
  duration: number;
  cd: number;
}

export interface Mods {
  towers: Record<string, TowerMods>;
  abilities: Record<string, AbilityMods>;
}

export type Priority = 0 | 1 | 2 | 3; // primeiro, último, mais forte, mais fraco
export const PRIORITY_NAMES = ['Primeiro', 'Último', 'Mais forte', 'Mais fraco'];
