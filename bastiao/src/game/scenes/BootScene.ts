import Phaser from 'phaser';
import { loadArt } from '../art/textures';
import { CSS, H, W, textStyle } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }
  create(): void {
    this.add.text(W / 2, H / 2 - 30, 'BASTIÃO DE AÇO', textStyle(72, CSS.yellow)).setOrigin(0.5);
    const t = this.add.text(W / 2, H / 2 + 50, 'Preparando o front...', textStyle(30, CSS.grey, false)).setOrigin(0.5);
    loadArt(this).then(() => {
      t.setText('Pronto!');
      this.scene.start('Menu');
    });
  }
}
