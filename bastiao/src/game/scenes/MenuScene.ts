import Phaser from 'phaser';
import { Sfx } from '../audio';
import { drawMap } from '../art/mapart';
import { enemyDisplaySize } from '../art/textures';
import { CSS, H, MAP_H, MAP_W, TILE, W, textStyle } from '../config';
import { ENEMY_BY_ID } from '../../core/data';
import { Path } from '../../core/path';
import { LEVELS } from '../levels';
import { Save } from '../save';
import { Button, hazardStrip, panel } from '../ui/ui';

export class MenuScene extends Phaser.Scene {
  private path!: Path;
  private units: { s: Phaser.GameObjects.Image; d: number; speed: number; rot?: Phaser.GameObjects.Image }[] = [];
  private turrets: Phaser.GameObjects.Image[] = [];
  constructor() {
    super('Menu');
  }

  create(): void {
    this.units = [];
    this.turrets = [];
    const level = LEVELS.find((l) => l.id === 4) ?? LEVELS[0];
    drawMap(this, level, 'mapa_menu');
    const sx = W / MAP_W;
    const sy = H / MAP_H;
    const s = Math.max(sx, sy);
    const bg = this.add.image(W / 2, H / 2, 'mapa_menu').setScale(s);
    this.path = new Path(level.paths[0], false);
    const ox = W / 2 - (MAP_W * s) / 2;
    const oy = H / 2 - (MAP_H * s) / 2;
    const toX = (x: number) => ox + x * TILE * s;
    const toY = (y: number) => oy + y * TILE * s;
    // torres decorativas
    const spots: [string, number, number][] = [['mg', 4, 5], ['at', 10, 7], ['aa', 15, 3], ['mo', 16, 8], ['la', 20, 9]];
    for (const [id, x, y] of spots) {
      this.add.image(toX(x + 0.5), toY(y + 0.5), `base_${id}`).setDisplaySize(TILE * s, TILE * s);
      this.turrets.push(this.add.image(toX(x + 0.5), toY(y + 0.5), `tur_${id}_2`).setDisplaySize(TILE * s * 1.22, TILE * s * 1.22));
    }
    const ids = ['soldado', 'jipe', 'tanque_leve', 'soldado', 'moto', 'caminhao', 'elite', 'tanque_pesado'];
    ids.forEach((id, i) => {
      const def = ENEMY_BY_ID[id];
      const sz = enemyDisplaySize(def.size) * s;
      const img = this.add.image(0, 0, `ini_${id}`).setDisplaySize(sz, sz);
      this.units.push({ s: img, d: -i * 3.2, speed: def.speed * 0.8 });
    });
    const heli = this.add.image(0, 0, 'ini_heli').setDisplaySize(enemyDisplaySize(0.55) * s, enemyDisplaySize(0.55) * s);
    const rot = this.add.image(0, 0, 'rotor').setDisplaySize(90 * s, 90 * s);
    this.units.push({ s: heli, d: -6, speed: 1.4, rot });
    (this as any)._map = { toX, toY };
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d1013, 0.45);
    bg.setDepth(-1);

    // título
    const tp = panel(this, W / 2, 230, 1100, 250);
    tp.setAlpha(0.95);
    hazardStrip(this, W / 2 - 530, 122, 1060, 16);
    this.add.text(W / 2, 220, 'BASTIÃO DE AÇO', { ...textStyle(118, CSS.yellow), strokeThickness: 16 }).setOrigin(0.5);
    this.add.text(W / 2, 315, 'DEFESA TÁTICA  •  GUERRA MODERNA', textStyle(34, CSS.white)).setOrigin(0.5);

    const bx = W / 2;
    let by = 500;
    new Button(this, bx, by, 560, 110, 'CAMPANHA', () => this.go('Campaign'), { style: 'laranja', fontSize: 48, icon: 'ic_onda' });
    by += 130;
    new Button(this, bx, by, 560, 96, 'PESQUISA', () => this.go('Research'), { style: 'verde', fontSize: 38, icon: 'ic_pesquisa' });
    by += 112;
    new Button(this, bx, by, 560, 96, 'ENCICLOPÉDIA', () => this.go('Encyclopedia'), { style: 'cinza', fontSize: 38, icon: 'ic_livro' });
    by += 112;
    new Button(this, bx, by, 560, 96, 'CONFIGURAÇÕES', () => this.go('Settings'), { style: 'cinza', fontSize: 38, icon: 'ic_engrenagem' });

    // mudo rápido
    const mute = new Button(this, W - 90, 90, 110, 100, '', () => {
      const st = Save.d.settings;
      const on = !(st.music || st.sfx);
      st.music = on;
      st.sfx = on;
      Save.write();
      Sfx.applySettings();
      mute.icon!.setTexture(on ? 'ic_som' : 'ic_mudo');
    }, { style: 'escuro', icon: Save.d.settings.music || Save.d.settings.sfx ? 'ic_som' : 'ic_mudo', iconSize: 64 });

    const st = Save.totalStars();
    this.add.text(40, H - 50, `★ ${st}/${LEVELS.length * 3}   •   Pontos de pesquisa livres: ${Save.freePoints()}`, textStyle(26, CSS.white)).setOrigin(0, 0.5);
    this.add.text(W - 40, H - 50, 'v1.0', textStyle(22, CSS.grey, false)).setOrigin(1, 0.5);
    Sfx.setMusicMode('menu');
    this.input.once('pointerdown', () => Sfx.startMusic('menu'));
  }

  private go(scene: string): void {
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene));
  }

  update(_t: number, dms: number): void {
    const dt = Math.min(0.05, dms / 1000);
    const m = (this as any)._map as { toX: (x: number) => number; toY: (y: number) => number };
    const pos = { x: 0, y: 0, a: 0, seg: 0 };
    for (const u of this.units) {
      u.d += u.speed * dt;
      if (u.d > this.path.length) u.d = -4;
      this.path.posAt(Math.max(0, u.d), pos);
      if (u.rot) {
        pos.y -= 1.2;
        u.rot.setPosition(m.toX(pos.x), m.toY(pos.y)).setRotation(u.rot.rotation + dt * 20);
      }
      u.s.setPosition(m.toX(pos.x), m.toY(pos.y)).setRotation(pos.a).setVisible(u.d > 0);
      u.rot?.setVisible(u.d > 0);
    }
    for (let i = 0; i < this.turrets.length; i++) this.turrets[i].rotation = Math.sin(this.time.now / 1500 + i) * 1.2 - 0.5;
  }
}
