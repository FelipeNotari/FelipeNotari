export const W = 1920;
export const H = 1080;
export const TILE = 72;
export const MAP_X = 0;
export const MAP_Y = 72;
export const MAP_W = 24 * TILE;
export const MAP_H = 14 * TILE;
export const PANEL_X = MAP_W;
export const PANEL_W = W - MAP_W;
export const HUD_H = MAP_Y;

export const FONT = '"Roboto Condensed", "Arial Narrow", "Segoe UI", Roboto, Arial, sans-serif';
export const FONT_BOLD = '"Arial Black", "Roboto Condensed", Roboto, Arial, sans-serif';

/** Paleta da identidade visual. */
export const C = {
  outline: 0x1b1f22,
  bgDark: 0x15181b,
  panel: 0x3a4148,
  panelLight: 0x59636b,
  panelDark: 0x262b30,
  olive: 0x6b7a3a,
  oliveLight: 0x8a9a4f,
  sand: 0xd8c27a,
  orange: 0xff8a1f,
  yellow: 0xffcc33,
  red: 0xe0453a,
  green: 0x6fcf4a,
  cyan: 0x3fd0ff,
  white: 0xf2efe6,
  grey: 0x8f979e,
};

export const CSS = {
  yellow: '#ffcc33',
  orange: '#ff8a1f',
  white: '#f2efe6',
  grey: '#a9b0b6',
  red: '#ff5a4a',
  green: '#7ee05a',
  cyan: '#3fd0ff',
  dark: '#1b1f22',
};

export function tx(x: number): number {
  return MAP_X + x * TILE;
}
export function ty(y: number): number {
  return MAP_Y + y * TILE;
}

export function textStyle(size: number, color = CSS.white, bold = true): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: bold ? FONT_BOLD : FONT,
    fontSize: `${size}px`,
    color,
    stroke: CSS.dark,
    strokeThickness: Math.max(2, Math.round(size / 7)),
  };
}

/** Rótulos curtos das habilidades para botões. */
export const ABIL_SHORT: Record<string, string> = {
  aereo: 'Ataque\nAéreo', minas: 'Minas', suprimentos: 'Supri-\nmentos', arame: 'Arame\nFarpado', napalm: 'Napalm', emp: 'Pulso\nEMP', reforcos: 'Reforços',
};

/** Número com vírgula decimal (pt-BR). */
export function fmt(n: number, d = 1): string {
  return n.toFixed(d).replace('.', ',');
}
