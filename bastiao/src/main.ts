import Phaser from 'phaser';

class Teste extends Phaser.Scene {
  create() {
    this.add.text(960, 540, 'Bastião de Aço', { fontSize: '64px', color: '#ffcc33' }).setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'jogo',
  width: 1920,
  height: 1080,
  backgroundColor: '#1b1f22',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Teste],
});
