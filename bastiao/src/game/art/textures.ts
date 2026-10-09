import Phaser from 'phaser';
import { ENEMIES, OBSTACLES, TOWERS } from '../../core/data';
import {
  ICON_IDS, baseSvg, enemySvg, iconSvg, missileSvg, mortarShellSvg, obstacleSvg, rotorSvg, shellSvg, towerBase, towerTurret,
} from './svg';

/** Escala de rasterização (texturas um pouco maiores que o tamanho exibido). */
export const RS = 1.5;
export const BIOMES = ['deserto', 'cidade', 'neve', 'industrial'];

export function enemyDisplaySize(size: number): number {
  return Math.round(size * 150);
}

function svgToCanvas(svg: string, w: number, h: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    img.onload = () => {
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas);
    };
    img.onerror = () => resolve(canvas);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

async function addSvg(scene: Phaser.Scene, key: string, svg: string, w: number, h = w): Promise<void> {
  if (scene.textures.exists(key)) return;
  const cv = await svgToCanvas(svg, Math.round(w * RS), Math.round(h * RS));
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, cv);
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  scene.textures.addCanvas(key, cv);
}

function radial(g: CanvasRenderingContext2D, w: number, stops: [number, string][]): void {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, w);
}

/** Placa metálica para NineSlice. */
function metalPlate(g: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string, edge: string, rivets = true): void {
  const rr = 14;
  g.beginPath();
  g.moveTo(rr, 0);
  g.lineTo(w - rr, 0);
  g.quadraticCurveTo(w, 0, w, rr);
  g.lineTo(w, h - rr);
  g.quadraticCurveTo(w, h, w - rr, h);
  g.lineTo(rr, h);
  g.quadraticCurveTo(0, h, 0, h - rr);
  g.lineTo(0, rr);
  g.quadraticCurveTo(0, 0, rr, 0);
  g.closePath();
  g.fillStyle = '#1b1f22';
  g.fill();
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  g.save();
  g.beginPath();
  g.rect(4, 4, w - 8, h - 8);
  g.clip();
  g.fillStyle = gr;
  g.fillRect(4, 4, w - 8, h - 8);
  // listras de escovado
  g.globalAlpha = 0.06;
  g.fillStyle = '#ffffff';
  for (let y = 6; y < h - 6; y += 6) g.fillRect(6, y, w - 12, 1);
  g.globalAlpha = 1;
  g.restore();
  g.strokeStyle = edge;
  g.lineWidth = 3;
  g.strokeRect(6.5, 6.5, w - 13, h - 13);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(8, 8, w - 16, 3);
  if (rivets) {
    for (const [x, y] of [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]]) {
      g.fillStyle = '#1b1f22';
      g.beginPath();
      g.arc(x, y, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#b8c0c6';
      g.beginPath();
      g.arc(x - 0.5, y - 0.5, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  }
}

export async function loadArt(scene: Phaser.Scene): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const t of TOWERS) {
    jobs.push(addSvg(scene, `base_${t.id}`, towerBase(t.id), 72));
    for (let l = 0; l < 3; l++) jobs.push(addSvg(scene, `tur_${t.id}_${l}`, towerTurret(t.id, l), 88));
  }
  for (const e of ENEMIES) jobs.push(addSvg(scene, `ini_${e.id}`, enemySvg(e.id), enemyDisplaySize(e.size)));
  jobs.push(addSvg(scene, 'rotor', rotorSvg(), 96));
  for (const o of OBSTACLES) for (const b of BIOMES) jobs.push(addSvg(scene, `obs_${o.id}_${b}`, obstacleSvg(o.id, b), 72));
  jobs.push(addSvg(scene, 'base_qg', baseSvg(), 120));
  jobs.push(addSvg(scene, 'proj_shell', shellSvg(), 24));
  jobs.push(addSvg(scene, 'proj_missil', missileSvg(), 30));
  jobs.push(addSvg(scene, 'proj_morteiro', mortarShellSvg(), 22));
  for (const id of ICON_IDS) jobs.push(addSvg(scene, `ic_${id}`, iconSvg(id), 64));
  await Promise.all(jobs);
  proceduralTextures(scene);
}

function proceduralTextures(scene: Phaser.Scene): void {
  canvasTex(scene, 'px', 4, 4, (g) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 4, 4);
  });
  canvasTex(scene, 'glow', 64, 64, (g) => radial(g, 64, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]));
  canvasTex(scene, 'fogo', 48, 48, (g) =>
    radial(g, 48, [[0, 'rgba(255,255,220,1)'], [0.3, 'rgba(255,200,60,0.95)'], [0.6, 'rgba(255,100,20,0.6)'], [1, 'rgba(200,40,10,0)']]),
  );
  canvasTex(scene, 'fumaca', 64, 64, (g) => {
    for (let i = 0; i < 7; i++) {
      const x = 20 + Math.random() * 24;
      const y = 20 + Math.random() * 24;
      const gr = g.createRadialGradient(x, y, 0, x, y, 20);
      gr.addColorStop(0, 'rgba(210,210,210,0.55)');
      gr.addColorStop(1, 'rgba(210,210,210,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    }
  });
  canvasTex(scene, 'faisca', 24, 6, (g) => {
    const gr = g.createLinearGradient(0, 0, 24, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr;
    g.fillRect(0, 1, 24, 4);
  });
  canvasTex(scene, 'detrito', 12, 12, (g) => {
    g.fillStyle = '#1b1f22';
    g.beginPath();
    g.moveTo(1, 4);
    g.lineTo(7, 0);
    g.lineTo(11, 6);
    g.lineTo(6, 11);
    g.lineTo(1, 9);
    g.fill();
    g.fillStyle = '#8a857c';
    g.fillRect(4, 4, 4, 3);
  });
  canvasTex(scene, 'marca', 96, 96, (g) => {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 14;
      const x = 48 + Math.cos(a) * d;
      const y = 48 + Math.sin(a) * d;
      const gr = g.createRadialGradient(x, y, 0, x, y, 26 + Math.random() * 14);
      gr.addColorStop(0, 'rgba(20,16,12,0.5)');
      gr.addColorStop(1, 'rgba(20,16,12,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 96, 96);
    }
  });
  canvasTex(scene, 'sombra', 64, 40, (g) => {
    const gr = g.createRadialGradient(32, 20, 0, 32, 20, 30);
    gr.addColorStop(0, 'rgba(0,0,0,0.45)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.scale(1, 0.62);
    g.fillRect(0, 0, 64, 64);
  });
  canvasTex(scene, 'anel', 256, 256, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.arc(128, 128, 124, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 4;
    g.setLineDash([14, 8]);
    g.beginPath();
    g.arc(128, 128, 125, 0, Math.PI * 2);
    g.stroke();
  });
  canvasTex(scene, 'circulo', 128, 128, (g) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(64, 64, 63, 0, Math.PI * 2);
    g.fill();
  });
  canvasTex(scene, 'onda_choque', 128, 128, (g) => {
    g.strokeStyle = 'rgba(255,255,255,1)';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(64, 64, 58, 0, Math.PI * 2);
    g.stroke();
  });
  canvasTex(scene, 'feixe', 64, 24, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 24);
    gr.addColorStop(0, 'rgba(63,208,255,0)');
    gr.addColorStop(0.35, 'rgba(63,208,255,0.9)');
    gr.addColorStop(0.5, 'rgba(240,255,255,1)');
    gr.addColorStop(0.65, 'rgba(63,208,255,0.9)');
    gr.addColorStop(1, 'rgba(63,208,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 24);
  });
  canvasTex(scene, 'tracer', 48, 6, (g) => {
    const gr = g.createLinearGradient(0, 0, 48, 0);
    gr.addColorStop(0, 'rgba(255,220,120,0)');
    gr.addColorStop(1, 'rgba(255,250,200,1)');
    g.fillStyle = gr;
    g.fillRect(0, 1, 48, 4);
  });
  canvasTex(scene, 'bolha', 128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 30, 64, 64, 62);
    gr.addColorStop(0, 'rgba(63,208,255,0)');
    gr.addColorStop(0.75, 'rgba(63,208,255,0.25)');
    gr.addColorStop(0.95, 'rgba(160,240,255,0.85)');
    gr.addColorStop(1, 'rgba(63,208,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
  canvasTex(scene, 'arame', 64, 64, (g) => {
    g.strokeStyle = '#1b1f22';
    g.lineWidth = 5;
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      for (let i = 0; i <= 64; i += 4) g.lineTo(i, 32 + Math.sin(i / 6 + k * 2) * 14);
      g.stroke();
    }
    g.strokeStyle = '#c9ced3';
    g.lineWidth = 2;
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      for (let i = 0; i <= 64; i += 4) g.lineTo(i, 32 + Math.sin(i / 6 + k * 2) * 14);
      g.stroke();
    }
  });
  canvasTex(scene, 'mina', 24, 24, (g) => {
    g.fillStyle = '#1b1f22';
    g.beginPath();
    g.arc(12, 12, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5b6e3a';
    g.beginPath();
    g.arc(12, 12, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e0453a';
    g.beginPath();
    g.arc(12, 12, 3, 0, Math.PI * 2);
    g.fill();
  });
  // placas da interface (NineSlice)
  canvasTex(scene, 'ui_painel', 96, 96, (g) => metalPlate(g, 96, 96, '#4a535b', '#2c3238', '#5f6a73'));
  canvasTex(scene, 'ui_painel_escuro', 96, 96, (g) => metalPlate(g, 96, 96, '#2e3439', '#1d2125', '#3a4148', false));
  canvasTex(scene, 'ui_botao', 96, 96, (g) => metalPlate(g, 96, 96, '#ffa64a', '#d96a10', '#ffc27a', false));
  canvasTex(scene, 'ui_botao_verde', 96, 96, (g) => metalPlate(g, 96, 96, '#8fb04a', '#55702a', '#b0d070', false));
  canvasTex(scene, 'ui_botao_cinza', 96, 96, (g) => metalPlate(g, 96, 96, '#6f7a83', '#454e56', '#8a959e', false));
  canvasTex(scene, 'ui_botao_vermelho', 96, 96, (g) => metalPlate(g, 96, 96, '#e86a5a', '#a8302a', '#f29a8a', false));
  canvasTex(scene, 'ui_faixa', 64, 64, (g) => {
    g.fillStyle = '#ffcc33';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#1b1f22';
    for (let i = -64; i < 64; i += 24) {
      g.beginPath();
      g.moveTo(i, 64);
      g.lineTo(i + 12, 64);
      g.lineTo(i + 76, 0);
      g.lineTo(i + 64, 0);
      g.fill();
    }
  });
  damageFont(scene);
}

/** Fonte bitmap para números de dano (barata de atualizar). */
function damageFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists('dano')) return;
  const chars = '0123456789+-$!';
  const cw = 28;
  const ch = 36;
  canvasTex(scene, 'fonte_dano', cw * chars.length, ch, (g) => {
    g.font = `900 30px "Arial Black", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (let i = 0; i < chars.length; i++) {
      g.lineWidth = 6;
      g.strokeStyle = '#1b1f22';
      g.strokeText(chars[i], i * cw + cw / 2, ch / 2 + 1);
      g.fillStyle = '#ffffff';
      g.fillText(chars[i], i * cw + cw / 2, ch / 2 + 1);
    }
  });
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: 'fonte_dano',
    width: cw,
    height: ch,
    chars,
    charsPerRow: chars.length,
    'spacing.x': 0,
    'spacing.y': 0,
    'offset.x': 0,
    'offset.y': 0,
    lineSpacing: 0,
  });
  scene.cache.bitmapFont.add('dano', data);
}
