import { ABILITIES, TOWERS } from '../core/data';
import { spentPoints } from '../core/research';
import { LEVELS } from './levels';

export interface Settings {
  music: boolean;
  sfx: boolean;
  numbers: boolean;
  shake: boolean;
  particles: 'alta' | 'baixa';
}

export interface SaveData {
  version: number;
  levels: Record<string, { won: boolean; stars: number; bestLives: number }>;
  researched: string[];
  settings: Settings;
  lastAbilities: string[];
  tutorialDone: boolean;
}

const KEY = 'bastiao.save.v1';

function fresh(): SaveData {
  return {
    version: 1,
    levels: {},
    researched: [],
    settings: { music: true, sfx: true, numbers: true, shake: true, particles: 'alta' },
    lastAbilities: [],
    tutorialDone: false,
  };
}

let data: SaveData = load();

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const d = JSON.parse(raw) as SaveData;
    const f = fresh();
    return { ...f, ...d, settings: { ...f.settings, ...(d.settings ?? {}) } };
  } catch {
    return fresh();
  }
}

export const Save = {
  get d(): SaveData {
    return data;
  },
  write(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* armazenamento indisponível */
    }
  },
  reset(): void {
    const s = data.settings;
    data = fresh();
    data.settings = s;
    Save.write();
  },
  /** Pontos ganhos: vitória = 2, cada estrela = 1. */
  earnedPoints(): number {
    let p = 0;
    for (const l of Object.values(data.levels)) p += (l.won ? 2 : 0) + l.stars;
    return p;
  },
  freePoints(): number {
    return Save.earnedPoints() - spentPoints(data.researched);
  },
  isLevelUnlocked(id: number): boolean {
    if (id === LEVELS[0]?.id) return true;
    const idx = LEVELS.findIndex((l) => l.id === id);
    if (idx <= 0) return idx === 0;
    return !!data.levels[LEVELS[idx - 1].id]?.won;
  },
  highestUnlocked(): number {
    let h = LEVELS[0]?.id ?? 1;
    for (const l of LEVELS) if (Save.isLevelUnlocked(l.id)) h = l.id;
    return h;
  },
  isTowerUnlocked(id: string): boolean {
    const t = TOWERS.find((x) => x.id === id);
    return !!t && t.unlock <= Save.highestUnlocked();
  },
  isAbilityUnlocked(id: string): boolean {
    const a = ABILITIES.find((x) => x.id === id);
    return !!a && a.unlock <= Save.highestUnlocked();
  },
  /** Registra resultado; retorna pontos novos ganhos. */
  recordResult(levelId: number, won: boolean, stars: number, lives: number): number {
    const before = Save.earnedPoints();
    const cur = data.levels[levelId] ?? { won: false, stars: 0, bestLives: 0 };
    if (won) {
      cur.won = true;
      cur.stars = Math.max(cur.stars, stars);
      cur.bestLives = Math.max(cur.bestLives, lives);
    }
    data.levels[levelId] = cur;
    Save.write();
    return Save.earnedPoints() - before;
  },
  totalStars(): number {
    let s = 0;
    for (const l of Object.values(data.levels)) s += l.stars;
    return s;
  },
};
