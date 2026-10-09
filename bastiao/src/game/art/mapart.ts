import Phaser from 'phaser';
import type { LevelData } from '../../core/types';
import { Rng } from '../../core/rng';
import { MAP_H, MAP_W, TILE } from '../config';

interface Pal {
  ground: string;
  light: string;
  dark: string;
  roadEdge: string;
  road: string;
  roadMark: string;
  detail: string[];
}

export const BIOME_PAL: Record<string, Pal> = {
  deserto: { ground: '#d6bd76', light: '#e6d394', dark: '#bfa35e', roadEdge: '#9a7f45', road: '#b8975a', roadMark: '#a2834a', detail: ['#a88d55', '#c9ad6a', '#8f7a4c'] },
  cidade: { ground: '#8e918b', light: '#a3a69f', dark: '#777a74', roadEdge: '#2f3235', road: '#4b4f53', roadMark: '#e8c547', detail: ['#6f726c', '#5d7a44', '#9a9d96'] },
  neve: { ground: '#e7eef3', light: '#ffffff', dark: '#cbd8e2', roadEdge: '#93a6b5', road: '#b8c8d4', roadMark: '#a4b6c4', detail: ['#d0dce6', '#b9c9d6', '#f6fbff'] },
  industrial: { ground: '#6f726a', light: '#83867d', dark: '#5a5d56', roadEdge: '#2c2e2b', road: '#8b8d86', roadMark: '#ffcc33', detail: ['#4f524c', '#3f4240', '#7d8076'] },
};

/** Desenha o chão da fase (bioma, estradas, rotas aéreas) numa textura de canvas. */
export function drawMap(scene: Phaser.Scene, level: LevelData, key: string): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, MAP_W, MAP_H)!;
  const g = tex.getContext();
  const pal = BIOME_PAL[level.biome] ?? BIOME_PAL.deserto;
  const rng = new Rng(level.id * 977 + 13);
  g.fillStyle = pal.ground;
  g.fillRect(0, 0, MAP_W, MAP_H);
  // manchas de textura
  for (let i = 0; i < 260; i++) {
    const x = rng.next() * MAP_W;
    const y = rng.next() * MAP_H;
    const rad = 20 + rng.next() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const col = rng.next() < 0.5 ? pal.light : pal.dark;
    gr.addColorStop(0, hexA(col, 0.35));
    gr.addColorStop(1, hexA(col, 0));
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // grade sutil para ajudar a posicionar
  g.strokeStyle = 'rgba(0,0,0,0.06)';
  g.lineWidth = 1;
  for (let x = 0; x <= MAP_W; x += TILE) {
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, MAP_H);
    g.stroke();
  }
  for (let y = 0; y <= MAP_H; y += TILE) {
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(MAP_W, y + 0.5);
    g.stroke();
  }
  // detalhes do bioma
  for (let i = 0; i < 180; i++) {
    const x = rng.next() * MAP_W;
    const y = rng.next() * MAP_H;
    const col = pal.detail[rng.int(pal.detail.length)];
    g.fillStyle = col;
    g.strokeStyle = 'rgba(27,31,34,0.5)';
    g.lineWidth = 1.5;
    switch (level.biome) {
      case 'deserto':
        if (i % 3 === 0) {
          // tufo seco
          g.strokeStyle = '#8f7a4c';
          for (let k = 0; k < 5; k++) {
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + (k - 2) * 4, y - 8 - rng.next() * 6);
            g.stroke();
          }
        } else {
          g.beginPath();
          g.ellipse(x, y, 3 + rng.next() * 5, 2 + rng.next() * 3, rng.next() * 3, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
        break;
      case 'cidade':
        if (i % 4 === 0) {
          g.strokeStyle = 'rgba(27,31,34,0.35)';
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + 18 * (rng.next() - 0.5) * 2, y + 14 * (rng.next() - 0.5) * 2);
          g.lineTo(x + 30 * (rng.next() - 0.5) * 2, y + 24 * (rng.next() - 0.5) * 2);
          g.stroke();
        } else {
          g.fillRect(x, y, 4 + rng.next() * 8, 3 + rng.next() * 6);
        }
        break;
      case 'neve':
        g.fillStyle = i % 2 ? '#ffffff' : '#c9d7e2';
        g.beginPath();
        g.arc(x, y, 1.5 + rng.next() * 3, 0, Math.PI * 2);
        g.fill();
        break;
      case 'industrial':
        if (i % 5 === 0) {
          g.fillStyle = 'rgba(20,20,20,0.25)';
          g.beginPath();
          g.ellipse(x, y, 10 + rng.next() * 20, 6 + rng.next() * 12, rng.next() * 3, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillRect(x, y, 3, 3);
        }
        break;
    }
  }
  if (level.biome === 'industrial' || level.biome === 'cidade') {
    // placas de concreto
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 2;
    for (let x = 0; x < MAP_W; x += TILE * 3) for (let y = 0; y < MAP_H; y += TILE * 2) g.strokeRect(x + 2, y + 2, TILE * 3 - 4, TILE * 2 - 4);
  }
  // rotas aéreas
  g.save();
  g.setLineDash([18, 22]);
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(80,150,220,0.28)';
  for (const p of level.airPaths ?? []) polyline(g, p);
  g.restore();
  // estradas
  const roads = level.paths;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = TILE * 0.98;
  for (const p of roads) polyline(g, p, 4, 6);
  g.strokeStyle = pal.roadEdge;
  g.lineWidth = TILE * 0.92;
  for (const p of roads) polyline(g, p);
  g.strokeStyle = pal.road;
  g.lineWidth = TILE * 0.74;
  for (const p of roads) polyline(g, p);
  // marcas da estrada
  g.save();
  if (level.biome === 'cidade') {
    g.setLineDash([22, 26]);
    g.lineWidth = 4;
    g.strokeStyle = pal.roadMark;
    for (const p of roads) polyline(g, p);
  } else if (level.biome === 'industrial') {
    g.setLineDash([16, 16]);
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,204,51,0.55)';
    for (const p of roads) polyline(g, p);
  } else {
    g.lineWidth = 5;
    g.strokeStyle = pal.roadMark;
    for (const p of roads) {
      offsetLine(g, p, -12);
      offsetLine(g, p, 12);
    }
  }
  g.restore();
  // setas de entrada
  for (const p of roads) {
    const [x0, y0] = p[0];
    const [x1, y1] = p[1];
    const ang = Math.atan2(y1 - y0, x1 - x0);
    let cx = (x0 + 0.5) * TILE;
    let cy = (y0 + 0.5) * TILE;
    cx = Math.min(MAP_W - 30, Math.max(30, cx + Math.cos(ang) * TILE));
    cy = Math.min(MAP_H - 30, Math.max(30, cy + Math.sin(ang) * TILE));
    g.save();
    g.translate(cx, cy);
    g.rotate(ang);
    g.fillStyle = 'rgba(224,69,58,0.85)';
    g.strokeStyle = '#1b1f22';
    g.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      g.moveTo(-14 + k * 16, -14);
      g.lineTo(2 + k * 16, 0);
      g.lineTo(-14 + k * 16, 14);
      g.lineTo(-8 + k * 16, 0);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.restore();
  }
  tex.refresh();
}

function polyline(g: CanvasRenderingContext2D, pts: number[][], dx = 0, dy = 0): void {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = (pts[i][0] + 0.5) * TILE + dx;
    const y = (pts[i][1] + 0.5) * TILE + dy;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}

/** Linha deslocada perpendicularmente (marcas de pneu). */
function offsetLine(g: CanvasRenderingContext2D, pts: number[][], off: number): void {
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = (pts[i][0] + 0.5) * TILE;
    const y0 = (pts[i][1] + 0.5) * TILE;
    const x1 = (pts[i + 1][0] + 0.5) * TILE;
    const y1 = (pts[i + 1][1] + 0.5) * TILE;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = (-(y1 - y0) / len) * off;
    const ny = ((x1 - x0) / len) * off;
    g.beginPath();
    g.moveTo(x0 + nx, y0 + ny);
    g.lineTo(x1 + nx, y1 + ny);
    g.stroke();
  }
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
