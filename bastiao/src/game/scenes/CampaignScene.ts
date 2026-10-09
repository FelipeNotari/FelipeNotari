import Phaser from 'phaser';
import { Sfx } from '../audio';
import { BIOME_PAL } from '../art/mapart';
import { C, CSS, H, W, textStyle } from '../config';
import { LEVELS } from '../levels';
import { Save } from '../save';
import { Button, panel, stars } from '../ui/ui';

const BIOME_NAMES: Record<string, string> = { deserto: 'DESERTO', cidade: 'CIDADE EM RUÍNAS', neve: 'NEVE', industrial: 'COMPLEXO INDUSTRIAL' };
const AREA = { x: 40, y: 150, w: W - 80, h: H - 190 };

export class CampaignScene extends Phaser.Scene {
  constructor() {
    super('Campaign');
  }

  create(): void {
    this.cameras.main.fadeIn(180);
    this.add.rectangle(W / 2, H / 2, W, H, 0x20252a);
    // faixas dos biomas
    const biomes = ['deserto', 'cidade', 'neve', 'industrial'];
    const bw = AREA.w / 4;
    const g = this.add.graphics();
    biomes.forEach((b, i) => {
      const pal = BIOME_PAL[b];
      const x = AREA.x + i * bw;
      g.fillStyle(Phaser.Display.Color.HexStringToColor(pal.ground).color, 1);
      g.fillRoundedRect(x + 4, AREA.y, bw - 8, AREA.h, 18);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(pal.dark).color, 0.5);
      for (let k = 0; k < 26; k++) {
        const px = x + 20 + ((k * 97) % (bw - 40));
        const py = AREA.y + 30 + ((k * 151) % (AREA.h - 60));
        g.fillCircle(px, py, 6 + (k % 5) * 4);
      }
      g.lineStyle(5, C.outline, 1);
      g.strokeRoundedRect(x + 4, AREA.y, bw - 8, AREA.h, 18);
      this.add.text(x + bw / 2, AREA.y + 34, BIOME_NAMES[b], textStyle(28, CSS.white)).setOrigin(0.5);
      // decoração com obstáculos do bioma
      const deco = b === 'deserto' ? ['arvore', 'pedra', 'carcaca'] : b === 'cidade' ? ['destrocos', 'carcaca', 'barril'] : b === 'neve' ? ['arvore', 'pedra', 'arvore'] : ['conteiner', 'barril', 'destrocos'];
      for (let k = 0; k < 7; k++) {
        const px = x + 40 + ((k * 131 + i * 37) % (bw - 80));
        const py = AREA.y + 90 + ((k * 211 + i * 53) % (AREA.h - 140));
        this.add.image(px, py, `obs_${deco[k % 3]}_${b}`).setDisplaySize(64, 64).setAlpha(0.85);
      }
    });
    // posições
    const pos = (l: (typeof LEVELS)[number]) => ({ x: AREA.x + l.map.x * AREA.w, y: AREA.y + l.map.y * AREA.h });
    const line = this.add.graphics();
    line.lineStyle(10, C.outline, 0.8);
    for (let i = 0; i < LEVELS.length - 1; i++) {
      const a = pos(LEVELS[i]);
      const b = pos(LEVELS[i + 1]);
      line.lineBetween(a.x, a.y, b.x, b.y);
    }
    line.lineStyle(4, C.sand, 0.9);
    for (let i = 0; i < LEVELS.length - 1; i++) {
      const a = pos(LEVELS[i]);
      const b = pos(LEVELS[i + 1]);
      const steps = Math.floor(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 18);
      for (let k = 0; k < steps; k += 2) {
        const t0 = k / steps;
        const t1 = (k + 1) / steps;
        line.lineBetween(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0, a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
      }
    }
    let current: Phaser.GameObjects.Image | null = null;
    for (const l of LEVELS) {
      const p = pos(l);
      const unlocked = Save.isLevelUnlocked(l.id);
      const rec = Save.d.levels[l.id];
      const boss = l.waves[l.waves.length - 1].groups.some((gr) => gr.enemy.startsWith('boss_'));
      const col = rec?.won ? 0x6fcf4a : unlocked ? 0xff8a1f : 0x6f7a83;
      const ring = this.add.circle(p.x, p.y, boss ? 46 : 40, col).setStrokeStyle(6, C.outline);
      this.add.circle(p.x - 8, p.y - 10, boss ? 18 : 14, 0xffffff, 0.25);
      if (boss) this.add.image(p.x + 34, p.y - 34, 'ic_caveira').setDisplaySize(40, 40);
      if (unlocked) {
        this.add.text(p.x, p.y, String(l.id), textStyle(34, CSS.white)).setOrigin(0.5);
        ring.setInteractive({ useHandCursor: true });
        ring.on('pointerup', () => {
          Sfx.play('click');
          this.scene.start('PreLevel', { levelId: l.id });
        });
        if (!rec?.won && !current) {
          current = this.add.image(p.x, p.y - 74, 'ic_onda').setDisplaySize(48, 48);
          this.tweens.add({ targets: current, y: p.y - 86, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.inOut' });
          this.tweens.add({ targets: ring, scale: 1.1, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.inOut' });
        }
      } else {
        this.add.image(p.x, p.y, 'ic_cadeado').setDisplaySize(40, 40);
      }
      if (rec?.won) stars(this, p.x, p.y + 58, rec.stars, 28, 2);
    }
    // cabeçalho
    panel(this, W / 2, 70, W - 40, 100);
    this.add.text(W / 2, 70, 'CAMPANHA', textStyle(48, CSS.yellow)).setOrigin(0.5);
    new Button(this, 130, 70, 200, 76, 'MENU', () => this.scene.start('Menu'), { style: 'cinza', icon: 'ic_voltar', fontSize: 28 });
    this.add.image(330, 70, 'ic_estrela').setDisplaySize(44, 44);
    this.add.text(360, 70, `${Save.totalStars()}/${LEVELS.length * 3}`, textStyle(32, CSS.white)).setOrigin(0, 0.5);
    new Button(this, W - 470, 70, 280, 76, `PESQUISA (${Save.freePoints()})`, () => this.scene.start('Research'), { style: 'verde', icon: 'ic_pesquisa', fontSize: 26 });
    new Button(this, W - 170, 70, 260, 76, 'ENCICLOPÉDIA', () => this.scene.start('Encyclopedia'), { style: 'cinza', icon: 'ic_livro', fontSize: 24 });
  }
}
