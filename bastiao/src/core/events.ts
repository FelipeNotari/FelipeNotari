/** Tipos de evento que a simulação envia para a camada visual/sonora. */
export const EV = {
  SHOT: 1, // x,y -> x2,y2 ; k = id da torre ; v = 1 se crítico
  HIT: 2, // x,y ; v = dano
  EXPLOSION: 3, // x,y ; v = raio ; k = 'g' grande | 'm' média | 'p' pequena | 'barril'
  DEATH: 4, // x,y ; k = id do inimigo ; v = 1 se aéreo
  LEAK: 5, // x,y ; v = vidas perdidas
  OBST_DOWN: 6, // x,y ; k = tipo ; v = recompensa
  MONEY: 7, // x,y ; v = valor
  DISABLED: 8, // x,y ; v = segundos
  WAVE: 9, // v = número da onda
  ABILITY: 10, // x,y ; k = id ; v = raio
  BOSS: 11, // x,y ; k = mecânica
  BUILD: 12, // x,y ; k = id da torre
  SELL: 13, // x,y ; v = valor
  UPGRADE: 14, // x,y ; v = novo nível
  SHIELD_BREAK: 15, // x,y
  HEAL: 16, // x,y
  KAMIKAZE: 17, // x,y
  LAUNCH: 18, // x,y ; k = 'missil' | 'morteiro' | 'canhao'
  VICTORY: 19,
  DEFEAT: 20,
  OBST_HIT: 21, // x,y
} as const;

export interface GameEvent {
  type: number;
  x: number;
  y: number;
  x2: number;
  y2: number;
  v: number;
  k: string;
}

/** Fila circular pré-alocada (sem alocação por frame). */
export class EventQueue {
  enabled = true;
  private buf: GameEvent[];
  private head = 0;
  count = 0;
  constructor(private cap = 1024) {
    this.buf = [];
    for (let i = 0; i < cap; i++) this.buf.push({ type: 0, x: 0, y: 0, x2: 0, y2: 0, v: 0, k: '' });
  }
  push(type: number, x: number, y: number, v = 0, k = '', x2 = 0, y2 = 0): void {
    if (!this.enabled) return;
    if (this.count >= this.cap) {
      this.head = (this.head + 1) % this.cap;
      this.count--;
    }
    const e = this.buf[(this.head + this.count) % this.cap];
    e.type = type;
    e.x = x;
    e.y = y;
    e.x2 = x2;
    e.y2 = y2;
    e.v = v;
    e.k = k;
    this.count++;
  }
  get(i: number): GameEvent {
    return this.buf[(this.head + i) % this.cap];
  }
  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
