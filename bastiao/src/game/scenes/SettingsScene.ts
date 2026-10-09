import Phaser from 'phaser';
import { Sfx } from '../audio';
import { CSS, H, W, textStyle } from '../config';
import { Save } from '../save';
import { Button, modal, panel, screenBackground, screenHeader } from '../ui/ui';

export class SettingsScene extends Phaser.Scene {
  private dyn: Phaser.GameObjects.GameObject[] = [];
  constructor() {
    super('Settings');
  }

  create(): void {
    this.dyn = [];
    screenBackground(this);
    screenHeader(this, 'CONFIGURAÇÕES', () => this.scene.start('Menu'));
    this.render();
  }

  private render(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const s = Save.d.settings;
    this.dyn.push(panel(this, W / 2, 560, 1000, 800));
    const rows: [string, string, () => void][] = [
      ['Música', s.music ? 'LIGADA' : 'DESLIGADA', () => { s.music = !s.music; }],
      ['Efeitos sonoros', s.sfx ? 'LIGADOS' : 'DESLIGADOS', () => { s.sfx = !s.sfx; }],
      ['Números de dano', s.numbers ? 'MOSTRAR' : 'ESCONDER', () => { s.numbers = !s.numbers; }],
      ['Tremor de tela', s.shake ? 'LIGADO' : 'DESLIGADO', () => { s.shake = !s.shake; }],
      ['Partículas', s.particles === 'alta' ? 'ALTA' : 'BAIXA (mais leve)', () => { s.particles = s.particles === 'alta' ? 'baixa' : 'alta'; }],
      ['Tutorial da fase 1', Save.d.tutorialDone ? 'REVER' : 'ATIVO', () => { Save.d.tutorialDone = false; }],
    ];
    rows.forEach(([label, val, fn], i) => {
      const y = 260 + i * 108;
      this.dyn.push(this.add.text(W / 2 - 440, y, label, textStyle(32)).setOrigin(0, 0.5));
      const on = !/DESLIG|ESCONDER|BAIXA/.test(val);
      this.dyn.push(new Button(this, W / 2 + 250, y, 400, 86, val, () => { fn(); Save.write(); Sfx.applySettings(); this.render(); }, { style: on ? 'verde' : 'cinza', fontSize: 28 }));
    });
    this.dyn.push(new Button(this, W / 2, 920, 520, 90, 'APAGAR PROGRESSO', () => this.wipe(), { style: 'vermelho', fontSize: 30 }));
    this.dyn.push(this.add.text(W / 2, H - 60, 'O progresso é salvo automaticamente neste aparelho.', textStyle(22, CSS.grey, false)).setOrigin(0.5));
  }

  private wipe(): void {
    modal(this, 'APAGAR PROGRESSO?', 'Todas as fases, estrelas e pesquisas serão apagadas. Não dá para desfazer.', [
      { text: 'CANCELAR', style: 'cinza', onClick: () => {} },
      { text: 'APAGAR', style: 'vermelho', onClick: () => { Save.reset(); this.render(); } },
    ]);
  }
}
