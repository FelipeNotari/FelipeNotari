import Phaser from 'phaser';
import { ABILITY_BY_ID, DAMAGE, ENEMY_BY_ID, TOWER_BY_ID } from '../../core/data';
import { Sfx } from '../audio';
import { drawMap } from '../art/mapart';
import { ABIL_SHORT, C, CSS, H, MAP_H, MAP_W, TILE, W, fmt, textStyle } from '../config';
import { levelById } from '../levels';
import { Save } from '../save';
import { Button, panel, screenBackground, towerIcon } from '../ui/ui';

const BIOME_NAMES: Record<string, string> = { deserto: 'Deserto', cidade: 'Cidade em ruínas', neve: 'Neve', industrial: 'Complexo industrial' };

export class PreLevelScene extends Phaser.Scene {
  private selected: string[] = [];
  private abilBtns: Record<string, Button> = {};
  private startBtn!: Button;
  constructor() {
    super('PreLevel');
  }

  create(data: { levelId: number }): void {
    const level = levelById(data.levelId)!;
    screenBackground(this);
    panel(this, W / 2, 70, W - 40, 100);
    this.add.text(W / 2, 70, `FASE ${level.id} — ${level.name.toUpperCase()}`, textStyle(46, CSS.yellow)).setOrigin(0.5);
    new Button(this, 130, 70, 200, 76, 'VOLTAR', () => this.scene.start('Campaign'), { style: 'cinza', icon: 'ic_voltar', fontSize: 28 });

    // mapa em miniatura
    const mx = 60;
    const my = 150;
    const ms = 0.52;
    panel(this, mx + (MAP_W * ms) / 2, my + (MAP_H * ms) / 2 + 10, MAP_W * ms + 40, MAP_H * ms + 40, true);
    drawMap(this, level, 'mini_mapa');
    this.add.image(mx + 0, my + 10, 'mini_mapa').setOrigin(0).setScale(ms);
    for (const o of level.obstacles) {
      this.add.image(mx + (o.x + 0.5) * TILE * ms, my + 10 + (o.y + 0.5) * TILE * ms, `obs_${o.type}_${level.biome}`).setDisplaySize(TILE * ms, TILE * ms);
    }
    const end = level.paths[0][level.paths[0].length - 1];
    this.add.image(mx + (end[0] + 0.5) * TILE * ms, my + 10 + (end[1] + 0.5) * TILE * ms, 'base_qg').setDisplaySize(90 * ms * 1.4, 90 * ms * 1.4);
    const by = my + MAP_H * ms + 60;
    this.add.text(mx, by, `${BIOME_NAMES[level.biome]}  •  ${level.waves.length} ondas  •  ${level.paths.length} entrada${level.paths.length > 1 ? 's' : ''}${level.airPaths.length ? `  •  ${level.airPaths.length} rota${level.airPaths.length > 1 ? 's' : ''} aérea${level.airPaths.length > 1 ? 's' : ''}` : ''}`, textStyle(26, CSS.white)).setOrigin(0, 0);
    this.add.text(mx, by + 40, `Vida dos inimigos nesta fase: ×${fmt(level.hpMult, 2)}  •  Dinheiro inicial: $${level.startMoney}`, textStyle(24, CSS.grey, false));
    this.add.text(mx, by + 80, level.briefing ?? '', { ...textStyle(26, CSS.white, false), wordWrap: { width: MAP_W * ms + 20 } });

    // painel direito
    const rx = 1010;
    const rw = W - rx - 40;
    panel(this, rx + rw / 2, 560, rw, 820, true);
    let y = 175;
    this.add.text(rx + 30, y, 'INIMIGOS DA FASE', textStyle(30, CSS.yellow));
    y += 50;
    const counts = new Map<string, number>();
    for (const w of level.waves) for (const g of w.groups) counts.set(g.enemy, (counts.get(g.enemy) ?? 0) + g.count);
    let i = 0;
    for (const [id, n] of counts) {
      const def = ENEMY_BY_ID[id];
      const cx = rx + 70 + (i % 7) * 118;
      const cy = y + Math.floor(i / 7) * 112 + 40;
      this.add.circle(cx, cy, 46, Phaser.Display.Color.HexStringToColor(DAMAGE.armorClasses[def.cls].color).color, 0.35).setStrokeStyle(3, C.outline);
      const img = this.add.image(cx, cy, `ini_${id}`).setRotation(-Math.PI / 2);
      const sc = Math.min(78 / img.width, 78 / img.height);
      img.setScale(sc);
      this.add.text(cx + 40, cy + 38, `×${n}`, textStyle(20, CSS.white)).setOrigin(1, 1);
      if (def.intro === level.id) this.add.text(cx, cy - 46, 'NOVO', textStyle(18, CSS.orange)).setOrigin(0.5);
      img.setInteractive().on('pointerup', () => this.showInfo(`${def.name} — ${DAMAGE.armorClasses[def.cls].name}`, def.desc));
      i++;
    }
    y += Math.ceil(counts.size / 7) * 112 + 30;
    this.add.text(rx + 30, y, 'TORRES DISPONÍVEIS', textStyle(30, CSS.yellow));
    y += 50;
    level.towers.forEach((id, k) => {
      const t = TOWER_BY_ID[id];
      const cx = rx + 70 + k * 106;
      const ic = towerIcon(this, cx, y + 40, id, 76);
      ic.setSize(80, 80).setInteractive().on('pointerup', () => this.showInfo(t.name, t.role));
      if (t.unlock === level.id) this.add.text(cx, y - 6, 'NOVA', textStyle(18, CSS.orange)).setOrigin(0.5);
    });
    y += 120;
    this.add.text(rx + 30, y, 'HABILIDADES — escolha 3', textStyle(30, CSS.yellow));
    y += 54;
    const avail = level.abilities.filter((a) => ABILITY_BY_ID[a]);
    const last = Save.d.lastAbilities.filter((a) => avail.includes(a));
    this.selected = (last.length ? last : avail).slice(0, 3);
    avail.forEach((id, k) => {
      const a = ABILITY_BY_ID[id];
      const bx = rx + 135 + (k % 4) * 214;
      const byy = y + Math.floor(k / 4) * 96 + 40;
      this.abilBtns[id] = new Button(this, bx, byy, 200, 84, ABIL_SHORT[id] ?? a.name, () => this.toggle(id), { style: 'cinza', icon: `ic_hab_${id}`, fontSize: 19 });
      this.abilBtns[id].label.setAlign('center');
      this.abilBtns[id].bg.on('pointerdown', () => this.showInfo(a.name, a.desc));
    });
    this.refreshAbil();
    this.startBtn = new Button(this, W - 260, H - 90, 400, 110, 'INICIAR', () => this.start(level.id), { style: 'laranja', fontSize: 48, icon: 'ic_play' });
  }

  private infoBox?: Phaser.GameObjects.Container;
  private showInfo(title: string, body: string): void {
    this.infoBox?.destroy();
    const c = this.add.container(0, 0).setDepth(100);
    const t = this.add.text(1050, H - 250, `${title}\n`, textStyle(26, CSS.yellow));
    const b = this.add.text(1050, H - 212, body, { ...textStyle(22, CSS.white, false), wordWrap: { width: 500 } });
    const bg = panel(this, 1300, H - 190, 560, 200);
    c.add([bg, t, b]);
    this.infoBox = c;
    this.time.delayedCall(4500, () => c.destroy());
  }

  private toggle(id: string): void {
    const i = this.selected.indexOf(id);
    if (i >= 0) this.selected.splice(i, 1);
    else if (this.selected.length < 3) this.selected.push(id);
    else {
      Sfx.play('error');
      return;
    }
    this.refreshAbil();
  }

  private refreshAbil(): void {
    for (const [id, b] of Object.entries(this.abilBtns)) b.setStyle(this.selected.includes(id) ? 'verde' : 'cinza');
  }

  private start(levelId: number): void {
    Save.d.lastAbilities = [...this.selected];
    Save.write();
    this.scene.start('Game', { levelId, abilities: [...this.selected] });
  }
}
