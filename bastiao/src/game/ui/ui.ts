import Phaser from 'phaser';
import { Sfx } from '../audio';
import { CSS, H, W, textStyle } from '../config';

export type BtnStyle = 'laranja' | 'verde' | 'cinza' | 'vermelho' | 'escuro';
const TEX: Record<BtnStyle, string> = {
  laranja: 'ui_botao',
  verde: 'ui_botao_verde',
  cinza: 'ui_botao_cinza',
  vermelho: 'ui_botao_vermelho',
  escuro: 'ui_painel_escuro',
};

export interface BtnOpts {
  style?: BtnStyle;
  icon?: string;
  iconSize?: number;
  fontSize?: number;
  color?: string;
  sound?: boolean;
}

/** Botão grande de painel metálico, pensado para toque. */
export class Button extends Phaser.GameObjects.Container {
  bg: Phaser.GameObjects.NineSlice;
  label: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  enabled = true;
  private style: BtnStyle;
  private onClick: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, onClick: () => void, opts: BtnOpts = {}) {
    super(scene, x, y);
    this.style = opts.style ?? 'laranja';
    this.onClick = onClick;
    this.bg = scene.add.nineslice(0, 0, TEX[this.style], undefined, w, h, 22, 22, 22, 22);
    this.add(this.bg);
    const fs = opts.fontSize ?? Math.min(34, Math.round(h * 0.38));
    let lx = 0;
    if (opts.icon) {
      const is = opts.iconSize ?? Math.round(h * 0.56);
      this.icon = scene.add.image(text ? -w / 2 + is / 2 + 16 : 0, 0, opts.icon).setDisplaySize(is, is);
      this.add(this.icon);
      if (text) lx = is / 2 + 4;
    }
    this.label = scene.add.text(lx, 0, text, textStyle(fs, opts.color ?? CSS.white)).setOrigin(0.5);
    this.add(this.label);
    this.setSize(w, h);
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerdown', () => {
      if (!this.enabled) return;
      this.setScale(0.95);
    });
    this.bg.on('pointerout', () => this.setScale(1));
    this.bg.on('pointerup', () => {
      this.setScale(1);
      if (!this.enabled) {
        Sfx.play('error');
        return;
      }
      if (opts.sound !== false) Sfx.play('click');
      this.onClick();
    });
    scene.add.existing(this);
  }

  setEnabled(b: boolean): this {
    this.enabled = b;
    this.bg.setAlpha(b ? 1 : 0.55);
    this.label.setAlpha(b ? 1 : 0.6);
    this.icon?.setAlpha(b ? 1 : 0.5);
    return this;
  }

  setText(t: string): this {
    this.label.setText(t);
    return this;
  }

  setStyle(s: BtnStyle): this {
    if (s !== this.style) {
      this.style = s;
      this.bg.setTexture(TEX[s]);
    }
    return this;
  }
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, dark = false): Phaser.GameObjects.NineSlice {
  return scene.add.nineslice(x, y, dark ? 'ui_painel_escuro' : 'ui_painel', undefined, w, h, 22, 22, 22, 22);
}

/** Faixa de perigo amarela e preta. */
export function hazardStrip(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.TileSprite {
  return scene.add.tileSprite(x, y, w, h, 'ui_faixa').setOrigin(0, 0);
}

/** Janela modal simples com botões. */
export function modal(
  scene: Phaser.Scene,
  title: string,
  body: string,
  buttons: { text: string; style?: BtnStyle; onClick: () => void }[],
  width = 820,
): Phaser.GameObjects.Container {
  const cont = scene.add.container(0, 0).setDepth(5000);
  const shade = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive();
  cont.add(shade);
  const bodyText = scene.add.text(W / 2, 0, body, { ...textStyle(28, CSS.white, false), wordWrap: { width: width - 80 }, align: 'center' }).setOrigin(0.5, 0);
  const h = 200 + bodyText.height + (buttons.length ? 110 : 0);
  const top = H / 2 - h / 2;
  cont.add(panel(scene, W / 2, H / 2, width, h));
  cont.add(scene.add.text(W / 2, top + 50, title, textStyle(40, CSS.yellow)).setOrigin(0.5));
  bodyText.setY(top + 100);
  cont.add(bodyText);
  const bw = Math.min(320, (width - 80) / Math.max(1, buttons.length) - 20);
  buttons.forEach((b, i) => {
    const bx = W / 2 + (i - (buttons.length - 1) / 2) * (bw + 24);
    const btn = new Button(scene, bx, top + h - 80, bw, 84, b.text, () => {
      cont.destroy();
      b.onClick();
    }, { style: b.style ?? 'laranja' });
    cont.add(btn);
  });
  return cont;
}

/** Linha de estrelas (0-3). */
export function stars(scene: Phaser.Scene, x: number, y: number, n: number, size = 40, gap = 6): Phaser.GameObjects.Image[] {
  const out: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < 3; i++) {
    out.push(scene.add.image(x + (i - 1) * (size + gap), y, i < n ? 'ic_estrela' : 'ic_estrela_vazia').setDisplaySize(size, size));
  }
  return out;
}

/** Fundo padrão das telas de menu (placa metálica com listras). */
export function screenBackground(scene: Phaser.Scene, tint = 0x2a3036): void {
  scene.add.rectangle(W / 2, H / 2, W, H, tint);
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.025);
  for (let x = -H; x < W; x += 60) {
    g.beginPath();
    g.moveTo(x, H);
    g.lineTo(x + 30, H);
    g.lineTo(x + 30 + H, 0);
    g.lineTo(x + H, 0);
    g.closePath();
    g.fillPath();
  }
  hazardStrip(scene, 0, 0, W, 14).setAlpha(0.9);
  hazardStrip(scene, 0, H - 14, W, 14).setAlpha(0.9);
}

/** Título de tela com botão voltar. */
export function screenHeader(scene: Phaser.Scene, title: string, onBack: () => void): void {
  panel(scene, W / 2, 70, W - 40, 100);
  scene.add.text(W / 2, 70, title, textStyle(48, CSS.yellow)).setOrigin(0.5);
  new Button(scene, 130, 70, 200, 76, 'VOLTAR', onBack, { style: 'cinza', icon: 'ic_voltar', fontSize: 28 });
}

export function towerIcon(scene: Phaser.Scene, x: number, y: number, id: string, size: number, level = 0): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  c.add(scene.add.image(0, 0, `base_${id}`).setDisplaySize(size, size));
  c.add(scene.add.image(0, 0, `tur_${id}_${level}`).setDisplaySize(size * 1.2, size * 1.2).setRotation(-Math.PI / 4));
  return c;
}
