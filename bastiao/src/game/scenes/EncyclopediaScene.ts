import Phaser from 'phaser';
import { DAMAGE, ENEMIES, MATRIX, OBSTACLES, TOWERS } from '../../core/data';
import { ARMOR_CLASSES, DAMAGE_TYPES } from '../../core/types';
import { Sfx } from '../audio';
import { C, CSS, H, W, fmt, textStyle } from '../config';
import { Button, panel, screenBackground, screenHeader, towerIcon } from '../ui/ui';

const TARGETS: Record<string, string> = { ground: 'Só terrestres', air: 'Só aéreos', both: 'Terrestres e aéreos', none: 'Não ataca' };

export class EncyclopediaScene extends Phaser.Scene {
  private tab: 'torres' | 'inimigos' | 'dano' = 'torres';
  private sel = 0;
  private dyn: Phaser.GameObjects.GameObject[] = [];
  constructor() {
    super('Encyclopedia');
  }

  create(): void {
    this.dyn = [];
    screenBackground(this);
    screenHeader(this, 'ENCICLOPÉDIA', () => this.scene.start('Menu'));
    this.render();
  }

  private a<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.dyn.push(o);
    return o;
  }

  private render(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
    const tabs: [typeof this.tab, string][] = [['torres', 'TORRES'], ['inimigos', 'INIMIGOS'], ['dano', 'MATRIZ DE DANO']];
    tabs.forEach(([id, label], i) =>
      this.a(new Button(this, 260 + i * 340, 180, 320, 80, label, () => { this.tab = id; this.sel = 0; this.render(); }, { style: this.tab === id ? 'laranja' : 'cinza', fontSize: 28 })),
    );
    if (this.tab === 'torres') this.towers();
    else if (this.tab === 'inimigos') this.enemies();
    else this.matrix();
  }

  private towers(): void {
    this.a(panel(this, 230, 640, 380, 760, true));
    TOWERS.forEach((t, i) => {
      const y = 300 + i * 90;
      const bg = this.a(this.add.nineslice(230, y, i === this.sel ? 'ui_botao' : 'ui_painel', undefined, 350, 82, 22, 22, 22, 22));
      this.a(towerIcon(this, 100, y, t.id, 58, 2));
      this.a(this.add.text(140, y, t.name, textStyle(24)).setOrigin(0, 0.5));
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => { Sfx.play('click'); this.sel = i; this.render(); });
    });
    const t = TOWERS[this.sel];
    const x0 = 470;
    this.a(panel(this, x0 + 700, 640, 1400, 760));
    for (let l = 0; l < 3; l++) this.a(towerIcon(this, x0 + 110 + l * 150, 380, t.id, 110, l));
    this.a(this.add.text(x0 + 560, 300, t.name.toUpperCase(), textStyle(40, CSS.yellow)));
    const dt = DAMAGE.damageTypes[t.dmgType];
    this.a(this.add.text(x0 + 560, 360, t.attack === 'support' ? 'Suporte (sem dano)' : `Dano: ${dt.name}`, textStyle(28, t.attack === 'support' ? CSS.white : dt.color)));
    this.a(this.add.text(x0 + 560, 405, `Alvos: ${TARGETS[t.targets]}   •   Liberada na fase ${t.unlock}`, textStyle(24, CSS.white, false)));
    this.a(this.add.text(x0 + 40, 470, t.role, { ...textStyle(26, CSS.white, false), wordWrap: { width: 1300 } }));
    // tabela por nível
    const cols = ['Nível', 'Custo', 'Dano', 'Cadência', 'Alcance', 'Especial'];
    const cx = [x0 + 60, x0 + 200, x0 + 360, x0 + 520, x0 + 690, x0 + 860];
    cols.forEach((c, i) => this.a(this.add.text(cx[i], 560, c, textStyle(24, CSS.yellow))));
    t.levels.forEach((lv, i) => {
      const y = 610 + i * 52;
      const cost = i === 0 ? `$${lv.cost}` : `+$${lv.cost}`;
      const dmg = t.attack === 'support' ? '—' : t.attack === 'flame' || t.attack === 'beam' ? `${lv.dmg}/s` : `${lv.dmg}${lv.missiles && lv.missiles > 1 ? `×${lv.missiles}` : ''}`;
      const rate = lv.rate ? `${fmt(lv.rate, 2)}/s` : t.attack === 'support' ? '—' : 'contínuo';
      let sp = '';
      if (lv.aoe) sp += `área ${fmt(lv.aoe, 2)} `;
      if (lv.minRange) sp += `ponto cego ${fmt(lv.minRange)} `;
      if (lv.burnDps) sp += `queima ${lv.burnDps}/s `;
      if (lv.rampMax) sp += `aquece até ×${fmt(lv.rampMax)} `;
      if (lv.slow) sp += `lentidão ${Math.round(lv.slow * 100)}% • +${Math.round((lv.aura ?? 0) * 100)}% alcance vizinhas${lv.auraDmg ? ` • +${Math.round(lv.auraDmg * 100)}% dano` : ''} `;
      if (lv.revealCamo || t.attack === 'support') sp += 'revela camuflados';
      [String(i + 1), cost, dmg, rate, fmt(lv.range), sp].forEach((v, k) => this.a(this.add.text(cx[k], y, v, textStyle(22, CSS.white, k === 0))));
    });
    if (t.attack !== 'support') {
      this.a(this.add.text(x0 + 60, 790, 'Multiplicador contra cada defesa:', textStyle(24, CSS.yellow)));
      ARMOR_CLASSES.forEach((c, i) => {
        const m = MATRIX[t.dmgType][c];
        const blocked = (c === 'AER' && t.targets === 'ground') || (c !== 'AER' && t.targets === 'air');
        const x = x0 + 60 + i * 260;
        this.a(this.add.text(x, 840, DAMAGE.armorClasses[c].name, textStyle(20, CSS.grey, false)));
        this.a(this.add.text(x, 872, blocked || m === 0 ? 'não atinge' : `${m.toFixed(2).replace('.', ',')}×`, textStyle(32, blocked || m === 0 ? CSS.red : m >= 1.5 ? CSS.green : m < 1 ? CSS.orange : CSS.white)));
      });
    }
  }

  private enemies(): void {
    const list = ENEMIES;
    const cols = 6;
    list.forEach((e, i) => {
      const x = 190 + (i % cols) * 300;
      const y = 300 + Math.floor(i / cols) * 170;
      const sel = i === this.sel;
      const bg = this.a(this.add.nineslice(x, y, sel ? 'ui_botao' : 'ui_painel', undefined, 288, 160, 22, 22, 22, 22));
      const col = Phaser.Display.Color.HexStringToColor(DAMAGE.armorClasses[e.cls].color).color;
      this.a(this.add.circle(x - 80, y - 10, 52, col, 0.4).setStrokeStyle(3, C.outline));
      const img = this.a(this.add.image(x - 80, y - 10, `ini_${e.id}`).setRotation(-Math.PI / 2));
      img.setScale(Math.min(96 / img.width, 96 / img.height));
      this.a(this.add.text(x - 16, y - 50, e.name, { ...textStyle(19), wordWrap: { width: 150 } }));
      this.a(this.add.text(x - 16, y + 30, DAMAGE.armorClasses[e.cls].name, textStyle(17, DAMAGE.armorClasses[e.cls].color)));
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => { Sfx.play('click'); this.sel = i; this.render(); });
    });
    const e = list[this.sel];
    const y = 300 + Math.ceil(list.length / cols) * 170 + 10;
    this.a(panel(this, W / 2, y + 60, W - 80, 150));
    this.a(this.add.text(70, y + 8, `${e.name.toUpperCase()} — ${DAMAGE.armorClasses[e.cls].name}${e.air ? ' (aéreo)' : ''}${e.camo ? ' (camuflado)' : ''}`, textStyle(26, CSS.yellow)));
    this.a(this.add.text(70, y + 48, `Vida base ${e.hp}  •  Velocidade ${fmt(e.speed, 2)} casas/s  •  Recompensa $${e.reward}  •  Tira ${e.lives} vida${e.lives > 1 ? 's' : ''} se chegar à base  •  Aparece na fase ${e.intro}`, textStyle(21, CSS.white, false)));
    this.a(this.add.text(70, y + 84, e.desc, { ...textStyle(21, CSS.green, false), wordWrap: { width: W - 160 } }));
    this.a(this.add.text(W / 2, H - 40, 'A vida dos inimigos é multiplicada por um fator de cada fase (mostrado na tela antes de começar).', textStyle(20, CSS.grey, false)).setOrigin(0.5));
  }

  private matrix(): void {
    const x0 = 360;
    const y0 = 330;
    const cw = 250;
    const ch = 96;
    this.a(panel(this, W / 2, 610, 1560, 740));
    this.a(this.add.text(x0 - 150, y0 - 70, 'DANO ↓   DEFESA →', textStyle(22, CSS.grey)).setOrigin(0.5));
    ARMOR_CLASSES.forEach((c, i) => {
      const ac = DAMAGE.armorClasses[c];
      this.a(this.add.text(x0 + i * cw + cw / 2, y0 - 50, ac.name, { ...textStyle(22, ac.color), align: 'center', wordWrap: { width: cw - 10 } }).setOrigin(0.5));
    });
    DAMAGE_TYPES.forEach((d, j) => {
      const dt = DAMAGE.damageTypes[d];
      const y = y0 + j * ch + ch / 2;
      this.a(this.add.text(x0 - 30, y, dt.name, textStyle(26, dt.color)).setOrigin(1, 0.5));
      ARMOR_CLASSES.forEach((c, i) => {
        const m = MATRIX[d][c];
        const col = m === 0 ? 0x4a2020 : m >= 1.5 ? 0x3f7a2a : m >= 1 ? 0x5d676f : m >= 0.5 ? 0x8a5a20 : 0x8a3020;
        this.a(this.add.rectangle(x0 + i * cw + cw / 2, y, cw - 8, ch - 8, col).setStrokeStyle(3, C.outline));
        this.a(this.add.text(x0 + i * cw + cw / 2, y, m === 0 ? (c === 'AER' ? 'não atinge' : 'nulo') : `${m.toFixed(2).replace('.', ',')}×`, textStyle(m === 0 ? 24 : 32)).setOrigin(0.5));
      });
    });
    const notes = [
      'Verde: forte  •  Cinza: normal  •  Laranja: fraco  •  Vermelho: quase inútil.',
      'Escudo de energia (Gerador e chefe Fortaleza): enquanto existir, o dano usa a coluna "Escudo"; o resto passa para a vida.',
      `Obstáculos também têm classe: ${OBSTACLES.map((o) => `${o.name} (${DAMAGE.armorClasses[o.cls].name})`).join(', ')}.`,
    ];
    notes.forEach((n, i) => this.a(this.add.text(W / 2, 850 + i * 40, n, { ...textStyle(21, CSS.white, false), align: 'center', wordWrap: { width: 1480 } }).setOrigin(0.5)));
  }
}
