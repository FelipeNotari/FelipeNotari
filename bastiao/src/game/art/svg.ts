// Arte vetorial do jogo, toda gerada por código (SVG). Estilo cartoon militar,
// contorno grosso escuro, sombreamento em duas tonalidades. Nenhum arquivo externo.

const O = '#1b1f22';
const SW = 4;

export function svgDoc(body: string, vbW = 100, vbH = 100): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}">${body}</svg>`;
}

const r = (x: number, y: number, w: number, h: number, fill: string, rx = 3, sw = SW) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${O}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const rf = (x: number, y: number, w: number, h: number, fill: string, rx = 2, op = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" opacity="${op}"/>`;
const c = (x: number, y: number, rad: number, fill: string, sw = SW) =>
  `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}" stroke="${O}" stroke-width="${sw}"/>`;
const cf = (x: number, y: number, rad: number, fill: string, op = 1) => `<circle cx="${x}" cy="${y}" r="${rad}" fill="${fill}" opacity="${op}"/>`;
const e = (x: number, y: number, rx: number, ry: number, fill: string, sw = SW) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${O}" stroke-width="${sw}"/>`;
const p = (pts: string, fill: string, sw = SW) => `<polygon points="${pts}" fill="${fill}" stroke="${O}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const pf = (pts: string, fill: string, op = 1) => `<polygon points="${pts}" fill="${fill}" opacity="${op}"/>`;
const path = (d: string, fill: string, sw = SW) => `<path d="${d}" fill="${fill}" stroke="${O}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
const line = (x1: number, y1: number, x2: number, y2: number, col = O, w = SW) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;

// ---------------------------------------------------------------- paleta
const OL = { base: '#6b7a3a', light: '#8a9a4f', dark: '#4d5a28' };
const MT = { base: '#5d676f', light: '#7f8a92', dark: '#3f474d' };
const EN = { base: '#7d848c', light: '#a0a7ae', dark: '#555c63', red: '#c8402f', track: '#2a2e32', glass: '#3a5a78' };
const ORANGE = '#ff8a1f';
const YELLOW = '#ffcc33';
const CYAN = '#3fd0ff';

// ---------------------------------------------------------------- torres
const ACCENT: Record<string, string> = {
  mg: YELLOW, at: '#e0453a', aa: '#4fa3e0', mo: ORANGE, sn: '#7ee05a', fl: '#ff5a2a', su: '#b98cff', la: CYAN,
};

export function towerBase(id: string): string {
  const a = ACCENT[id] ?? YELLOW;
  let s = `<polygon points="22,8 78,8 92,22 92,78 78,92 22,92 8,78 8,22" fill="#000" opacity="0.25" transform="translate(4,5)"/>`;
  s += p('22,8 78,8 92,22 92,78 78,92 22,92 8,78 8,22', '#857e6c');
  s += pf('24,13 76,13 87,24 87,60 13,60 13,24', '#9a927e');
  // sacos de areia
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const x = 50 + Math.cos(ang) * 33;
    const y = 50 + Math.sin(ang) * 33;
    s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="6" transform="rotate(${((ang * 180) / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#c9b787" stroke="${O}" stroke-width="2.5"/>`;
  }
  s += c(50, 50, 22, MT.dark, 3);
  s += cf(50, 50, 17, MT.base);
  s += rf(40, 84, 20, 6, a, 2);
  return svgDoc(s);
}

export function towerTurret(id: string, lvl: number): string {
  let s = '';
  const sh = (body: string) => `<g transform="translate(3,4)" opacity="0.28">${body.replace(/fill="[^"]+"/g, 'fill="#000"').replace(/stroke="[^"]+"/g, 'stroke="none"')}</g>${body}`;
  switch (id) {
    case 'mg': {
      let b = '';
      const barrels = lvl === 0 ? [50] : lvl === 1 ? [44, 56] : [43, 50, 57];
      for (const y of barrels) b += r(54, y - 3.5, lvl === 2 ? 40 : 36, 7, MT.dark, 2, 3);
      if (lvl === 2) b += r(84, 38, 8, 24, MT.base, 2, 3);
      b += c(46, 50, lvl === 0 ? 17 : 19, OL.base);
      b += cf(42, 45, 9, OL.light);
      b += r(26, 36, 12, 28, lvl === 0 ? OL.dark : MT.base, 2, 3);
      if (lvl >= 1) b += r(56, 30, 8, 40, OL.dark, 2, 3);
      b += cf(46, 50, 4, YELLOW);
      s = sh(b);
      break;
    }
    case 'at': {
      let b = '';
      const len = 40 + lvl * 4;
      b += r(52, 45, len, 10 + lvl, MT.dark, 2, 3.5);
      b += r(52 + len - 8, 42, 10, 16 + lvl, MT.base, 2, 3);
      b += r(24, 32 - lvl * 2, 38, 36 + lvl * 4, OL.base, 6);
      b += rf(28, 36 - lvl * 2, 30, 12, OL.light, 3);
      if (lvl >= 1) b += r(20, 30 - lvl * 2, 10, 40 + lvl * 4, OL.dark, 3, 3);
      if (lvl === 2) b += rf(60, 46, 6, 8, '#e0453a', 1) + rf(70, 46, 6, 8, '#e0453a', 1);
      b += c(40, 50, 6, MT.dark, 2.5);
      s = sh(b);
      break;
    }
    case 'aa': {
      let b = '';
      b += r(26, 26, 44, 48, OL.base, 6);
      b += rf(30, 30, 36, 14, OL.light, 3);
      const tubes = lvl === 0 ? 2 : lvl === 1 ? 4 : 6;
      const cols = tubes <= 2 ? 1 : 2;
      const rows = Math.ceil(tubes / cols);
      for (let i = 0; i < tubes; i++) {
        const cx = 62 + (i % cols) * 12;
        const cy = 50 + (Math.floor(i / cols) - (rows - 1) / 2) * 13;
        b += r(cx - 4, cy - 5, 24, 10, MT.light, 3, 3);
        b += cf(cx + 18, cy, 3, '#e0453a');
      }
      b += r(16, 40, 12, 20, MT.dark, 2, 3);
      s = sh(b);
      break;
    }
    case 'mo': {
      let b = c(50, 50, 30, MT.base);
      b += cf(46, 45, 22, MT.light, 0.6);
      const n = lvl + 1;
      const pts = n === 1 ? [[56, 50]] : n === 2 ? [[58, 40], [58, 60]] : [[60, 50], [44, 36], [44, 64]];
      for (const [x, y] of pts) {
        b += c(x, y, 10, OL.dark, 3.5);
        b += cf(x, y, 6, '#111');
      }
      b += line(30, 30, 40, 40, O, 3) + line(30, 70, 40, 60, O, 3);
      s = sh(b);
      break;
    }
    case 'sn': {
      let b = path('M20,20 Q50,6 70,26 L62,34 Q48,20 28,30 Z', '#c9b787', 3);
      b += path('M20,80 Q50,94 70,74 L62,66 Q48,80 28,70 Z', '#c9b787', 3);
      b += e(40, 50, 18, 11, '#5b6e3a');
      b += c(56, 50, 7, '#4a5a2e', 3);
      b += r(56, 47, 38 + lvl * 4, 6, '#2b2f33', 2, 2.5);
      b += r(64, 44, 12, 12, '#2b2f33', 2, 2);
      for (let i = 0; i < 5; i++) b += cf(30 + i * 6, 42 + (i % 2) * 14, 4, '#7f9150', 0.9);
      if (lvl === 2) b += cf(76, 50, 3, CYAN);
      s = sh(b);
      break;
    }
    case 'fl': {
      let b = '';
      const tanks = lvl + 1;
      for (let i = 0; i < Math.min(3, tanks + 1); i++) b += r(18, 26 + i * 16, 26, 14, i % 2 ? '#c8402f' : '#d9562f', 7, 3);
      b += r(40, 40, 22, 20, MT.base, 4);
      b += p(`60,44 ${86 + lvl * 3},40 ${86 + lvl * 3},60 60,56`, MT.dark, 3);
      b += cf(88 + lvl * 3, 50, 4, ORANGE);
      if (lvl >= 1) b += rf(22, 74, 20, 4, YELLOW);
      s = sh(b);
      break;
    }
    case 'su': {
      let b = r(40, 44, 16, 12, MT.dark, 2, 3);
      const rr = 26 + lvl * 4;
      b += path(`M${50 - 6},${50 - rr} Q${50 + rr},50 ${50 - 6},${50 + rr} Q${50 + 8},50 ${50 - 6},${50 - rr} Z`, '#d5dbe0', 3.5);
      b += line(50, 50, 50 + rr * 0.8, 50, O, 3);
      b += cf(50 + rr * 0.8, 50, 4, '#b98cff');
      if (lvl >= 1) b += line(40, 50, 22, 36, O, 3) + cf(22, 36, 3, '#b98cff');
      if (lvl >= 2) b += line(40, 50, 22, 64, O, 3) + cf(22, 64, 3, '#b98cff');
      s = sh(b);
      break;
    }
    case 'la': {
      let b = p('34,30 58,30 70,50 58,70 34,70 22,50', MT.dark);
      b += pf('36,34 56,34 64,48 28,48', MT.base);
      b += r(60, 44 - lvl, 22 + lvl * 3, 12 + lvl * 2, MT.light, 3, 3);
      if (lvl === 2) b += r(58, 30, 26, 6, MT.base, 2, 2.5) + r(58, 64, 26, 6, MT.base, 2, 2.5);
      b += c(46, 50, 9 + lvl, CYAN, 3);
      b += cf(44, 47, 4, '#e8fbff');
      b += cf(82 + lvl * 3, 50, 4, CYAN);
      s = sh(b);
      break;
    }
  }
  return svgDoc(s);
}

// ---------------------------------------------------------------- inimigos (virados para a direita)
function soldierBody(col: string, helmet: string, extra = ''): string {
  let s = e(48, 50, 16, 22, col);
  s += r(52, 60, 30, 5, '#2b2f33', 2, 2.5); // fuzil
  s += c(52, 50, 12, helmet, 3.5);
  s += cf(49, 46, 4, '#fff', 0.35);
  return s + extra;
}

export function enemySvg(id: string): string {
  let s = '';
  switch (id) {
    case 'soldado':
      s = soldierBody(EN.base, EN.dark);
      break;
    case 'elite':
      s = soldierBody('#4d5157', '#2f3338', cf(56, 50, 4, EN.red));
      s += r(30, 36, 10, 28, EN.red, 2, 2.5);
      break;
    case 'camuflado':
      s = soldierBody('#5d7040', '#4a5a30');
      for (let i = 0; i < 6; i++) s += cf(36 + (i % 3) * 10, 36 + Math.floor(i / 3) * 24, 6, '#7f9150', 0.9);
      break;
    case 'escudo':
      s = soldierBody(EN.base, EN.dark);
      s += path('M66,18 Q80,50 66,82 L74,82 Q88,50 74,18 Z', '#9aa3ab', 3.5);
      s += rf(72, 44, 4, 12, '#2b2f33');
      break;
    case 'moto':
      s = r(14, 44, 72, 12, EN.track, 6);
      s += r(26, 38, 44, 24, EN.base, 8);
      s += c(46, 50, 10, EN.dark, 3);
      s += r(66, 30, 6, 40, '#2b2f33', 2, 2.5);
      s += cf(80, 50, 3, YELLOW);
      break;
    case 'jipe':
      s = r(12, 18, 76, 64, EN.base, 10);
      s += r(18, 12, 18, 10, EN.track, 3, 3) + r(18, 78, 18, 10, EN.track, 3, 3) + r(64, 12, 18, 10, EN.track, 3, 3) + r(64, 78, 18, 10, EN.track, 3, 3);
      s += rf(16, 24, 70, 18, EN.light, 6, 0.6);
      s += r(56, 26, 12, 48, EN.glass, 3, 3);
      s += c(36, 50, 9, EN.dark, 3) + line(36, 50, 60, 50, O, 4);
      s += rf(76, 30, 6, 40, EN.red, 2);
      break;
    case 'caminhao':
      s = r(4, 16, 92, 68, EN.track, 8);
      s += r(8, 20, 60, 60, EN.dark, 4);
      for (let i = 0; i < 4; i++) s += rf(12 + i * 14, 24, 8, 52, EN.base, 2);
      s += r(66, 22, 28, 56, EN.base, 6);
      s += r(80, 28, 10, 44, EN.glass, 3, 3);
      s += rf(68, 26, 10, 48, EN.light, 3, 0.5);
      break;
    case 'reparo':
      s = r(4, 18, 92, 64, EN.track, 8);
      s += r(8, 22, 58, 56, '#8a8f6a', 4);
      s += r(66, 24, 26, 52, EN.base, 6);
      s += r(80, 30, 9, 40, EN.glass, 3, 3);
      s += rf(26, 34, 8, 32, '#fff') + rf(14, 46, 32, 8, '#fff');
      s += rf(27, 35, 6, 30, '#39b54a') + rf(15, 47, 30, 6, '#39b54a');
      s += line(52, 30, 60, 70, O, 4) + c(52, 30, 4, YELLOW, 2);
      break;
    case 'gerador':
      s = r(6, 16, 88, 68, EN.track, 8);
      s += r(10, 20, 80, 60, EN.dark, 6);
      s += c(46, 50, 20, '#2f6f8f', 3.5);
      s += c(46, 50, 12, CYAN, 3);
      s += cf(43, 46, 5, '#e8fbff');
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        s += c(46 + Math.cos(a) * 26, 50 + Math.sin(a) * 26, 5, CYAN, 2.5);
      }
      s += r(76, 30, 10, 40, EN.glass, 3, 3);
      break;
    case 'tanque_leve':
      s = r(6, 14, 88, 72, EN.track, 8);
      s += r(10, 22, 80, 56, EN.base, 6);
      s += rf(14, 26, 72, 18, EN.light, 4, 0.55);
      s += r(50, 45, 46, 10, EN.dark, 2, 3.5);
      s += c(46, 50, 18, EN.dark);
      s += cf(42, 46, 8, EN.base);
      s += rf(18, 70, 30, 4, EN.red, 1);
      break;
    case 'tanque_pesado':
      s = r(2, 8, 96, 84, EN.track, 8);
      for (let i = 0; i < 8; i++) s += rf(6 + i * 11, 10, 6, 6, '#444', 1) + rf(6 + i * 11, 84, 6, 6, '#444', 1);
      s += r(8, 18, 84, 64, '#5f666d', 6);
      s += rf(12, 22, 76, 20, '#7a828a', 4, 0.6);
      s += r(52, 43, 46, 14, EN.dark, 2, 4);
      s += r(88, 40, 10, 20, EN.dark, 2, 3);
      s += path('M24,30 L60,30 L70,50 L60,70 L24,70 L18,50 Z', '#4a5056');
      s += cf(38, 44, 6, '#7a828a');
      s += rf(14, 74, 30, 4, EN.red, 1);
      break;
    case 'drone':
      s = line(22, 22, 78, 78, O, 7) + line(22, 78, 78, 22, O, 7);
      for (const [x, y] of [[22, 22], [78, 22], [22, 78], [78, 78]]) s += c(x, y, 14, '#9aa1a8', 3) + cf(x, y, 9, '#ffffff', 0.35);
      s += c(50, 50, 13, EN.dark, 3.5);
      s += cf(56, 50, 4, EN.red);
      break;
    case 'kamikaze':
      s = p('92,50 30,14 40,50 30,86', '#6b7178');
      s += pf('88,50 36,20 44,50', '#8d949b');
      s += c(70, 50, 9, EN.red, 3);
      s += r(8, 44, 26, 12, EN.dark, 3, 3);
      s += cf(10, 50, 4, ORANGE);
      break;
    case 'heli':
      s = r(4, 46, 46, 8, EN.dark, 3, 3);
      s += r(2, 38, 8, 24, EN.dark, 2, 3);
      s += e(62, 50, 30, 18, EN.base);
      s += e(64, 46, 22, 9, EN.light, 0);
      s += e(80, 50, 10, 11, EN.glass, 3);
      s += rf(46, 32, 20, 5, EN.red, 1) + rf(46, 63, 20, 5, EN.red, 1);
      break;
    case 'boss_escorpiao':
      s = r(10, 14, 72, 72, EN.track, 10);
      s += r(14, 22, 64, 56, '#8a7a5a', 8);
      s += path('M78,24 Q100,18 96,34 L84,36 Z', '#6d6048') + path('M78,76 Q100,82 96,66 L84,64 Z', '#6d6048');
      s += path('M14,50 Q-2,40 4,20 Q12,30 20,40 Z', '#6d6048');
      s += c(46, 50, 20, '#5f553f');
      s += r(60, 44, 36, 12, '#3f3a2c', 2, 3.5);
      s += cf(42, 44, 7, '#a08f6a');
      s += cf(46, 50, 4, EN.red);
      break;
    case 'boss_colosso':
      s = r(2, 6, 96, 88, EN.track, 10);
      s += r(8, 14, 84, 72, '#5a6168', 8);
      s += rf(12, 18, 76, 22, '#7a828a', 5, 0.6);
      s += r(60, 26, 36, 9, EN.dark, 2, 3) + r(60, 65, 36, 9, EN.dark, 2, 3);
      s += c(34, 30, 9, EN.dark, 3) + c(34, 70, 9, EN.dark, 3);
      s += c(52, 50, 17, '#454b51');
      s += r(64, 45, 34, 10, '#33383d', 2, 3);
      s += rf(12, 46, 20, 8, EN.red, 2);
      break;
    case 'boss_fortaleza':
      s = r(2, 4, 96, 92, EN.track, 10);
      s += r(8, 12, 84, 76, '#d7dde2', 8);
      s += rf(12, 16, 76, 24, '#ffffff', 5, 0.55);
      for (const [x, y] of [[22, 24], [22, 76], [70, 24], [70, 76]]) s += c(x, y, 8, CYAN, 3);
      s += c(46, 50, 20, '#8a96a0');
      s += c(46, 50, 10, CYAN, 3);
      s += r(62, 44, 36, 12, '#4a535c', 2, 3.5);
      break;
    case 'boss_ciclope':
      s = r(2, 44, 30, 12, EN.dark, 3, 3);
      s += p('30,50 52,12 70,20 76,50 70,80 52,88', '#555c63');
      s += pf('34,48 52,18 66,24 70,46', '#7d848c');
      s += c(62, 50, 16, '#2a2e32');
      s += c(64, 50, 10, EN.red, 3);
      s += cf(66, 47, 4, '#ffd0c0');
      for (const [x, y] of [[44, 20], [44, 80]]) s += c(x, y, 12, '#9aa1a8', 3);
      break;
  }
  return svgDoc(s);
}

export function rotorSvg(): string {
  return svgDoc(
    `<g opacity="0.75">${line(50, 4, 50, 96, '#2b2f33', 6)}${line(4, 50, 96, 50, '#2b2f33', 6)}</g>` +
      `<circle cx="50" cy="50" r="44" fill="#ffffff" opacity="0.08"/>` + c(50, 50, 6, EN.dark, 3),
  );
}

// ---------------------------------------------------------------- obstáculos
export function obstacleSvg(id: string, biome: string): string {
  let s = '';
  switch (id) {
    case 'arvore':
      if (biome === 'neve') {
        s = `<ellipse cx="54" cy="56" rx="38" ry="34" fill="#000" opacity="0.25"/>`;
        s += p('50,6 62,30 82,30 66,48 78,72 50,58 22,72 34,48 18,30 38,30', '#2f6a3c');
        s += pf('50,14 58,32 70,34 50,46', '#3f8a4f');
        s += cf(50, 22, 6, '#ffffff', 0.9) + cf(30, 34, 5, '#ffffff', 0.8) + cf(70, 34, 5, '#ffffff', 0.8);
        s += c(50, 44, 6, '#5a3d24', 3);
      } else if (biome === 'deserto') {
        s = `<ellipse cx="54" cy="56" rx="36" ry="32" fill="#000" opacity="0.25"/>`;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * 360;
          s += `<g transform="rotate(${a} 50 50)">${path('M50,50 Q62,30 52,8 Q46,28 50,50 Z', i % 2 ? '#4f8a3a' : '#6aa44a', 3)}</g>`;
        }
        s += c(50, 50, 7, '#8a6a3a', 3);
      } else {
        s = `<ellipse cx="54" cy="56" rx="34" ry="30" fill="#000" opacity="0.25"/>`;
        s += c(42, 44, 20, '#5e7a3a') + c(60, 40, 16, '#6e8a46') + c(56, 60, 18, '#557236');
        s += cf(40, 38, 7, '#8aa65a', 0.8) + cf(60, 34, 5, '#8aa65a', 0.8);
      }
      break;
    case 'pedra': {
      const col = biome === 'neve' ? '#8e98a0' : biome === 'deserto' ? '#b59a6a' : '#8a8580';
      const light = biome === 'neve' ? '#b8c2ca' : biome === 'deserto' ? '#d1b886' : '#a8a39c';
      s = `<ellipse cx="54" cy="58" rx="40" ry="32" fill="#000" opacity="0.25"/>`;
      s += p('14,62 22,30 46,16 72,22 88,46 82,74 52,86 26,80', col);
      s += pf('24,34 46,20 70,26 60,44 34,48', light);
      s += p('56,56 72,50 80,64 64,72', col, 3);
      if (biome === 'neve') s += pf('26,34 46,20 66,24 50,32', '#ffffff', 0.95);
      break;
    }
    case 'destrocos':
      s = `<ellipse cx="52" cy="58" rx="40" ry="30" fill="#000" opacity="0.25"/>`;
      s += p('10,70 20,40 40,48 34,76', '#9a958c');
      s += p('36,30 62,22 70,46 46,54', '#b3ada2');
      s += p('50,60 78,50 90,74 60,84', '#8a857c');
      s += line(30, 20, 46, 40, '#6b4a2a', 3) + line(64, 56, 84, 36, '#6b4a2a', 3);
      s += cf(24, 52, 3, '#6d6a64') + cf(66, 70, 3, '#6d6a64');
      break;
    case 'barril':
      s = `<ellipse cx="54" cy="56" rx="26" ry="26" fill="#000" opacity="0.25"/>`;
      s += c(50, 50, 24, '#c8402f');
      s += `<circle cx="50" cy="50" r="17" fill="none" stroke="${O}" stroke-width="2.5"/>`;
      s += p('50,36 62,58 38,58', YELLOW, 2.5);
      s += rf(48.5, 43, 3, 9, O) + cf(50, 54, 1.8, O);
      break;
    case 'carcaca':
      s = `<ellipse cx="54" cy="58" rx="44" ry="34" fill="#000" opacity="0.3"/>`;
      s += r(8, 18, 84, 64, '#2f2b28', 8);
      s += r(14, 26, 72, 48, '#4a443e', 6);
      s += c(46, 50, 16, '#3a3530');
      s += `<g transform="rotate(25 46 50)">${r(56, 45, 40, 9, '#2f2b28', 2, 3)}</g>`;
      s += cf(30, 34, 8, '#1a1715', 0.7) + cf(66, 64, 6, '#1a1715', 0.6) + cf(36, 64, 4, ORANGE, 0.5);
      break;
    case 'conteiner': {
      const col = biome === 'industrial' ? '#2f7fb8' : '#c86a2a';
      s = `<rect x="8" y="22" width="88" height="62" fill="#000" opacity="0.25"/>`;
      s += r(4, 16, 88, 64, col, 3);
      for (let i = 0; i < 8; i++) s += rf(10 + i * 10, 20, 4, 56, '#000', 0, 0.15);
      s += rf(8, 20, 80, 10, '#ffffff', 2, 0.2);
      break;
    }
  }
  return svgDoc(s);
}

// ---------------------------------------------------------------- base e projéteis
export function baseSvg(): string {
  let s = `<ellipse cx="54" cy="58" rx="46" ry="42" fill="#000" opacity="0.3"/>`;
  s += p('20,10 80,10 94,24 94,80 80,94 20,94 6,80 6,24', '#6b6658');
  s += pf('22,14 78,14 90,26 90,50 10,50 10,26', '#857f6e');
  s += r(30, 30, 40, 40, OL.dark, 4);
  s += r(36, 36, 28, 28, OL.base, 3);
  s += line(50, 40, 50, 14, O, 3);
  s += p('50,14 72,20 50,26', ORANGE, 2.5);
  s += rf(38, 56, 24, 4, YELLOW);
  return svgDoc(s);
}

export function shellSvg(): string {
  return svgDoc(r(20, 40, 56, 20, '#c9a24a', 9, 3) + rf(26, 44, 20, 6, '#f2d27a', 3));
}
export function missileSvg(): string {
  return svgDoc(p('96,50 74,40 14,40 4,30 4,70 14,60 74,60', '#d8dde2', 3) + rf(72, 42, 8, 16, '#e0453a', 2));
}
export function mortarShellSvg(): string {
  return svgDoc(e(50, 50, 30, 18, '#3f474d') + cf(42, 44, 7, '#7f8a92'));
}

// ---------------------------------------------------------------- ícones da interface
export function iconSvg(id: string): string {
  let s = '';
  switch (id) {
    case 'moeda':
      s = c(50, 50, 38, '#f2b632') + `<circle cx="50" cy="50" r="27" fill="none" stroke="#b07a10" stroke-width="5"/>` + `<text x="50" y="66" font-size="44" font-family="Arial Black,Arial" font-weight="900" text-anchor="middle" fill="#8a5a08">$</text>`;
      break;
    case 'vida':
      s = path('M50,88 L14,52 Q2,36 14,22 Q30,8 50,28 Q70,8 86,22 Q98,36 86,52 Z', '#e0453a') + cf(32, 34, 8, '#ffffff', 0.5);
      break;
    case 'estrela':
      s = p('50,6 62,36 94,38 69,58 78,90 50,72 22,90 31,58 6,38 38,36', YELLOW) + pf('50,16 58,38 40,40', '#fff3b0', 0.8);
      break;
    case 'estrela_vazia':
      s = p('50,6 62,36 94,38 69,58 78,90 50,72 22,90 31,58 6,38 38,36', '#3a4148');
      break;
    case 'onda':
      s = line(22, 90, 22, 10, O, 7) + p('22,12 82,24 22,46', ORANGE);
      break;
    case 'pausa':
      s = r(24, 18, 18, 64, '#f2efe6', 4) + r(58, 18, 18, 64, '#f2efe6', 4);
      break;
    case 'play':
      s = p('28,16 84,50 28,84', '#f2efe6');
      break;
    case 'rapido':
      s = p('10,18 50,50 10,82', '#f2efe6') + p('48,18 88,50 48,82', '#f2efe6');
      break;
    case 'engrenagem': {
      let g = '';
      for (let i = 0; i < 8; i++) g += `<rect x="43" y="6" width="14" height="22" rx="3" fill="#c9ced3" stroke="${O}" stroke-width="4" transform="rotate(${i * 45} 50 50)"/>`;
      s = g + c(50, 50, 30, '#c9ced3') + c(50, 50, 11, '#59636b');
      break;
    }
    case 'cadeado':
      s = `<path d="M30,46 V32 Q30,12 50,12 Q70,12 70,32 V46" fill="none" stroke="${O}" stroke-width="14"/>` +
        `<path d="M30,46 V32 Q30,12 50,12 Q70,12 70,32 V46" fill="none" stroke="#a9b0b6" stroke-width="7"/>` + r(20, 44, 60, 44, '#ffcc33', 6) + c(50, 62, 6, O, 0) + rf(47, 62, 6, 14, O);
      break;
    case 'caveira':
      s = path('M50,10 Q86,10 86,46 Q86,62 72,68 V84 H28 V68 Q14,62 14,46 Q14,10 50,10 Z', '#f2efe6') + c(36, 46, 9, O, 0) + c(64, 46, 9, O, 0) + rf(40, 70, 4, 12, O) + rf(56, 70, 4, 12, O);
      break;
    case 'pesquisa':
      s = path('M38,8 H62 V36 L86,82 Q88,92 78,92 H22 Q12,92 14,82 L38,36 Z', '#d5dbe0') + pf('28,62 72,62 82,84 18,84', '#7ee05a') + rf(34, 4, 32, 8, '#a9b0b6', 3);
      break;
    case 'livro':
      s = r(14, 10, 72, 80, '#8a4a2a', 6) + rf(22, 16, 56, 68, '#c96a3a', 3) + rf(30, 28, 40, 6, '#f2d27a') + rf(30, 40, 30, 5, '#f2d27a');
      break;
    case 'som':
      s = p('10,38 30,38 54,16 54,84 30,62 10,62', '#f2efe6') + `<path d="M66,30 Q80,50 66,70 M76,20 Q96,50 76,80" fill="none" stroke="#f2efe6" stroke-width="7" stroke-linecap="round"/>`;
      break;
    case 'mudo':
      s = p('10,38 30,38 54,16 54,84 30,62 10,62', '#a9b0b6') + line(66, 34, 92, 66, '#e0453a', 9) + line(92, 34, 66, 66, '#e0453a', 9);
      break;
    case 'voltar':
      s = p('8,50 46,14 46,34 92,34 92,66 46,66 46,86', '#f2efe6');
      break;
    case 'ok':
      s = `<path d="M14,52 L38,76 L88,22" fill="none" stroke="${O}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M14,52 L38,76 L88,22" fill="none" stroke="#7ee05a" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`;
      break;
    case 'x':
      s = `<path d="M18,18 L82,82 M82,18 L18,82" fill="none" stroke="${O}" stroke-width="20" stroke-linecap="round"/>` +
        `<path d="M18,18 L82,82 M82,18 L18,82" fill="none" stroke="#ff5a4a" stroke-width="11" stroke-linecap="round"/>`;
      break;
    case 'melhorar':
      s = p('50,8 90,52 66,52 66,92 34,92 34,52 10,52', '#7ee05a');
      break;
    case 'vender':
      s = c(50, 50, 40, '#ffcc33') + `<text x="50" y="68" font-size="52" font-family="Arial Black,Arial" font-weight="900" text-anchor="middle" fill="#8a5a08">$</text>`;
      break;
    case 'mira':
      s = `<circle cx="50" cy="50" r="32" fill="none" stroke="${O}" stroke-width="14"/><circle cx="50" cy="50" r="32" fill="none" stroke="#ff5a4a" stroke-width="7"/>` +
        line(50, 4, 50, 30, O, 12) + line(50, 70, 50, 96, O, 12) + line(4, 50, 30, 50, O, 12) + line(70, 50, 96, 50, O, 12) +
        line(50, 6, 50, 28, '#ff5a4a', 6) + line(50, 72, 50, 94, '#ff5a4a', 6) + line(6, 50, 28, 50, '#ff5a4a', 6) + line(72, 50, 94, 50, '#ff5a4a', 6);
      break;
    case 'info':
      s = c(50, 50, 40, '#4fa3e0') + `<text x="50" y="72" font-size="56" font-family="Georgia,serif" font-weight="900" text-anchor="middle" fill="#fff">i</text>`;
      break;
    case 'alvo':
      s = c(50, 50, 38, '#f2efe6') + c(50, 50, 24, '#e0453a') + c(50, 50, 10, '#f2efe6');
      break;
    case 'escudo':
      s = path('M50,6 L88,20 Q88,66 50,94 Q12,66 12,20 Z', '#4fa3e0') + pf('50,16 78,26 76,40 50,40', '#ffffff', 0.4);
      break;
    case 'raio':
      s = p('58,4 18,56 46,56 36,96 82,40 54,40 66,4', YELLOW);
      break;
    // habilidades
    case 'hab_aereo':
      s = p('50,4 58,34 94,52 94,60 58,52 56,80 70,90 70,96 50,90 30,96 30,90 44,80 42,52 6,60 6,52 42,34', '#c9ced3');
      break;
    case 'hab_minas':
      s = e(50, 56, 36, 26, '#5b6e3a') + e(50, 50, 24, 16, '#4d5a28') + c(50, 46, 7, '#e0453a', 3);
      break;
    case 'hab_suprimentos':
      s = path('M20,40 Q50,0 80,40 Z', '#f2efe6') + line(22, 40, 36, 60, O, 3) + line(78, 40, 64, 60, O, 3) + r(30, 56, 40, 34, '#b8863a', 3) + line(30, 56, 70, 90, O, 3) + line(70, 56, 30, 90, O, 3);
      break;
    case 'hab_arame':
      s = `<path d="M6,60 Q18,30 30,60 T54,60 T78,60 T98,60" fill="none" stroke="${O}" stroke-width="12"/><path d="M6,60 Q18,30 30,60 T54,60 T78,60 T98,60" fill="none" stroke="#c9ced3" stroke-width="6"/>` +
        [18, 42, 66, 88].map((x) => line(x - 6, 40, x + 6, 52, O, 5)).join('');
      break;
    case 'hab_napalm':
      s = path('M50,6 Q84,48 76,70 Q68,94 50,94 Q32,94 24,70 Q16,48 50,6 Z', '#ff5a2a') + path('M50,40 Q66,62 60,76 Q56,86 50,86 Q44,86 40,76 Q34,62 50,40 Z', '#ffcc33', 0);
      break;
    case 'hab_emp':
      s = c(50, 50, 40, '#2f6f8f') + p('58,10 28,54 48,54 40,90 74,44 54,44 64,10', CYAN, 3);
      break;
    case 'hab_reforcos':
      s = path('M14,62 Q14,22 50,22 Q86,22 86,62 Z', OL.base) + rf(10, 60, 80, 10, OL.dark, 3) + pf('24,34 50,28 62,34 30,44', OL.light, 0.8);
      break;
  }
  return svgDoc(s);
}

export const ICON_IDS = [
  'moeda', 'vida', 'estrela', 'estrela_vazia', 'onda', 'pausa', 'play', 'rapido', 'engrenagem', 'cadeado', 'caveira', 'pesquisa',
  'livro', 'som', 'mudo', 'voltar', 'ok', 'x', 'melhorar', 'vender', 'mira', 'info', 'alvo', 'escudo', 'raio',
  'hab_aereo', 'hab_minas', 'hab_suprimentos', 'hab_arame', 'hab_napalm', 'hab_emp', 'hab_reforcos',
];
