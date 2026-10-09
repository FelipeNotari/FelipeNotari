import type { LevelData } from '../core/types';

// Todas as fases são lidas da pasta de dados: criar fase-21.json basta para ela aparecer.
const mods = import.meta.glob('../data/levels/*.json', { eager: true }) as Record<string, { default: LevelData }>;

export const LEVELS: LevelData[] = Object.values(mods)
  .map((m) => m.default)
  .sort((a, b) => a.id - b.id);

export function levelById(id: number): LevelData | undefined {
  return LEVELS.find((l) => l.id === id);
}
