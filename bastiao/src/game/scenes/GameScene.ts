import Phaser from 'phaser';
import { ABILITY_BY_ID, DAMAGE, DT, ENEMY_BY_ID, GRID_H, GRID_W, TOWER_BY_ID } from '../../core/data';
import { Game, type Obstacle, type Tower } from '../../core/game';
import { PRIORITY_NAMES, type LevelData, type Priority } from '../../core/types';
import { Sfx } from '../audio';
import { drawMap } from '../art/mapart';
import { ABIL_SHORT, CSS, C, H, MAP_H, MAP_W, MAP_X, MAP_Y, PANEL_W, PANEL_X, TILE, W, fmt, textStyle, tx, ty } from '../config';
import { LEVELS, levelById } from '../levels';
import { Save } from '../save';
import { Button, hazardStrip, modal, panel, stars } from '../ui/ui';
import { BattleView } from '../view';
import { Tutorial } from './Tutorial';

interface TowerBtn {
  id: string;
  bg: Phaser.GameObjects.NineSlice;
  icon: Phaser.GameObjects.Container;
  cost: Phaser.GameObjects.Text;
  lock?: Phaser.GameObjects.Image;
  afford?: boolean;
  sel?: boolean;
}

interface AbilBtn {
  bg: Phaser.GameObjects.NineSlice;
  icon: Phaser.GameObjects.Image;
  cdRect: Phaser.GameObjects.Rectangle;
  cdText: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
}

export class GameScene extends Phaser.Scene {
  sim!: Game;
  view!: BattleView;
  level!: LevelData;
  private abilityIds: string[] = [];
  private acc = 0;
  speed = 1;
  paused = false;
  private ended = false;
  mode: 'normal' | 'build' | 'ability' = 'normal';
  buildId: string | null = null;
  private ghost: { cx: number; cy: number } | null = null;
  private abilitySlot = -1;
  selected: Tower | null = null;
  tutorial: Tutorial | null = null;

  // interface
  private livesText!: Phaser.GameObjects.Text;
  private livesIcon!: Phaser.GameObjects.Image;
  private moneyText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private previewIcons: Phaser.GameObjects.GameObject[] = [];
  private towerBtns: TowerBtn[] = [];
  private abilBtns: AbilBtn[] = [];
  callBtn!: Button;
  private callSub!: Phaser.GameObjects.Text;
  private speedBtn!: Button;
  private rangeRing!: Phaser.GameObjects.Image;
  private minRing!: Phaser.GameObjects.Image;
  private ghostBase!: Phaser.GameObjects.Image;
  private ghostTur!: Phaser.GameObjects.Image;
  private ghostOk!: Button;
  private ghostNo!: Button;
  private abilRing!: Phaser.GameObjects.Image;
  private popup: Phaser.GameObjects.Container | null = null;
  private popupTower: Tower | null = null;
  private popupKey = -1;
  private toastText!: Phaser.GameObjects.Text;
  private leakFlash!: Phaser.GameObjects.Rectangle;
  private pauseMenu: Phaser.GameObjects.Container | null = null;
  private bossBar: { c: Phaser.GameObjects.Container; fill: Phaser.GameObjects.Rectangle; shield: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; uid: number } | null = null;
  private last = { lives: -1, money: -1, wave: -9, state: '', cdn: -2, hold: false };
  private abilSec: number[] = [-1, -1, -1];

  constructor() {
    super('Game');
  }

  init(): void {
    this.acc = 0;
    this.speed = 1;
    this.paused = false;
    this.ended = false;
    this.mode = 'normal';
    this.buildId = null;
    this.ghost = null;
    this.abilitySlot = -1;
    this.selected = null;
    this.popup = null;
    this.popupTower = null;
    this.pauseMenu = null;
    this.bossBar = null;
    this.previewIcons = [];
    this.previewWave = -2;
    this.towerBtns = [];
    this.abilBtns = [];
    this.tutorial = null;
    this.last = { lives: -1, money: -1, wave: -9, state: '', cdn: -2, hold: false };
    this.abilSec = [-1, -1, -1];
  }

  create(data: { levelId: number; abilities?: string[] }): void {
    this.level = levelById(data.levelId)!;
    this.abilityIds = (data.abilities ?? this.level.abilities.slice(0, 3)).filter((a) => this.level.abilities.includes(a)).slice(0, 3);
    this.sim = new Game(this.level, {
      researched: Save.d.researched,
      abilities: this.abilityIds,
      seed: (Date.now() & 0xffffff) + 1,
    });
    this.cameras.main.fadeIn(250);
    drawMap(this, this.level, 'mapa_jogo');
    this.add.image(MAP_X, MAP_Y, 'mapa_jogo').setOrigin(0).setDepth(0);
    this.view = new BattleView(this, this.sim);
    this.view.onLeak = (n) => this.onLeak(n);
    this.view.onWave = (n) => this.onWave(n);
    this.view.onBoss = (k) => this.onBossEvent(k);
    this.buildHud();
    this.buildPanel();
    this.buildOverlays();
    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length) return;
      this.tapMap(p.worldX, p.worldY);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.mode === 'ability') this.moveAbilityRing(p.worldX, p.worldY);
      else if (this.mode === 'build' && p.isDown && p.worldX < MAP_W && p.worldY > MAP_Y) this.placeGhost(Math.floor((p.worldX - MAP_X) / TILE), Math.floor((p.worldY - MAP_Y) / TILE));
    });
    Sfx.setMusicMode('battle');
    if (this.level.tutorial && !Save.d.tutorialDone) this.tutorial = new Tutorial(this);
    if (!this.tutorial) this.toast(this.level.briefing ?? '', 6000);
  }

  // ------------------------------------------------------------------ HUD superior
  private buildHud(): void {
    panel(this, W / 2, 36, W + 20, 80).setDepth(900);
    const d = 901;
    this.livesIcon = this.add.image(44, 36, 'ic_vida').setDisplaySize(46, 46).setDepth(d);
    this.livesText = this.add.text(76, 36, '', textStyle(34)).setOrigin(0, 0.5).setDepth(d);
    this.add.image(200, 36, 'ic_moeda').setDisplaySize(46, 46).setDepth(d);
    this.moneyText = this.add.text(232, 36, '', textStyle(34, CSS.yellow)).setOrigin(0, 0.5).setDepth(d);
    this.add.image(430, 36, 'ic_onda').setDisplaySize(42, 42).setDepth(d);
    this.waveText = this.add.text(460, 36, '', textStyle(30)).setOrigin(0, 0.5).setDepth(d);
    this.add.text(690, 36, 'PRÓXIMA:', textStyle(24, CSS.grey)).setOrigin(0, 0.5).setDepth(d);
    this.speedBtn = new Button(this, 1600, 36, 120, 62, '1x', () => this.toggleSpeed(), { style: 'cinza', icon: 'ic_rapido', fontSize: 26, iconSize: 34 });
    this.speedBtn.setDepth(d);
    new Button(this, 1712, 36, 90, 62, '', () => this.openPause(), { style: 'cinza', icon: 'ic_pausa', iconSize: 38 }).setDepth(d);
    this.add.text(PANEL_X + PANEL_W / 2 + 40, 36, `FASE ${this.level.id}`, textStyle(26, CSS.yellow)).setOrigin(0.5).setDepth(d);
  }

  private previewWave = -2;
  private updatePreview(): void {
    if (this.sim.waveIdx === this.previewWave) return;
    this.previewWave = this.sim.waveIdx;
    const prev = this.sim.nextWavePreview();
    for (const o of this.previewIcons) o.destroy();
    this.previewIcons = [];
    if (!prev.length) {
      this.previewIcons.push(this.add.text(820, 36, 'última onda', textStyle(24, CSS.orange)).setOrigin(0, 0.5).setDepth(901));
      return;
    }
    prev.slice(0, 7).forEach((p, i) => {
      const def = ENEMY_BY_ID[p.id];
      const x = 840 + i * 92;
      const col = Phaser.Display.Color.HexStringToColor(DAMAGE.armorClasses[def.cls].color).color;
      const c = this.add.circle(x, 36, 27, col, 0.45).setStrokeStyle(3, C.outline).setDepth(901);
      const img = this.add.image(x, 36, `ini_${p.id}`).setRotation(-Math.PI / 2).setDepth(902);
      img.setScale(Math.min(48 / img.width, 48 / img.height));
      const t = this.add.text(x + 30, 50, `×${p.count}`, textStyle(20)).setOrigin(0, 0.5).setDepth(903);
      c.setInteractive().on('pointerup', () => this.toast(`${def.name} (${DAMAGE.armorClasses[def.cls].name}): ${def.desc}`, 4000));
      this.previewIcons.push(c, img, t);
    });
  }

  // ------------------------------------------------------------------ painel direito
  private buildPanel(): void {
    const px = PANEL_X + PANEL_W / 2;
    panel(this, px, MAP_Y + MAP_H / 2, PANEL_W + 6, MAP_H + 6, true).setDepth(800);
    const order = ['mg', 'at', 'aa', 'mo', 'sn', 'fl', 'su', 'la'];
    order.forEach((id, i) => {
      const bx = PANEL_X + 50 + (i % 2) * 94;
      const by = MAP_Y + 72 + Math.floor(i / 2) * 124;
      const bg = this.add.nineslice(bx, by, 'ui_painel', undefined, 90, 118, 22, 22, 22, 22).setDepth(801);
      const unlocked = this.level.towers.includes(id);
      const icon = this.add.container(bx, by - 14).setDepth(802);
      icon.add(this.add.image(0, 0, `base_${id}`).setDisplaySize(62, 62));
      icon.add(this.add.image(0, 0, `tur_${id}_0`).setDisplaySize(76, 76).setRotation(-Math.PI / 2));
      const cost = this.add.text(bx, by + 40, unlocked ? `$${this.sim.buildCost(id)}` : '', textStyle(22, CSS.yellow)).setOrigin(0.5).setDepth(802);
      const btn: TowerBtn = { id, bg, icon, cost };
      if (!unlocked) {
        icon.setAlpha(0.3);
        btn.lock = this.add.image(bx, by - 14, 'ic_cadeado').setDisplaySize(40, 40).setDepth(803);
      }
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.pickTower(id));
      this.towerBtns.push(btn);
    });
    // habilidades
    this.abilityIds.forEach((id, i) => {
      const a = ABILITY_BY_ID[id];
      const by = MAP_Y + 600 + i * 98;
      const bg = this.add.nineslice(px, by, 'ui_painel', undefined, 180, 92, 22, 22, 22, 22).setDepth(801);
      const icon = this.add.image(px - 54, by, `ic_hab_${id}`).setDisplaySize(56, 56).setDepth(802);
      const name = this.add.text(px + 26, by, ABIL_SHORT[id] ?? a.name, { ...textStyle(21), align: 'center' }).setOrigin(0.5).setDepth(802);
      const cdRect = this.add.rectangle(px, by + 42, 172, 84, 0x000000, 0.55).setOrigin(0.5, 1).setDepth(803);
      const cdText = this.add.text(px, by, '', textStyle(32)).setOrigin(0.5).setDepth(804);
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.pickAbility(i));
      this.abilBtns.push({ bg, icon, cdRect, cdText, name });
    });
    // chamar onda
    this.callBtn = new Button(this, px, MAP_Y + 920, 180, 150, 'CHAMAR\nONDA', () => this.callWave(), { style: 'laranja', fontSize: 30 });
    this.callBtn.label.setAlign('center').setY(-16);
    this.callBtn.setDepth(801);
    this.callSub = this.add.text(0, 44, '', textStyle(22, CSS.white)).setOrigin(0.5);
    this.callBtn.add(this.callSub);
  }

  private updatePanel(): void {
    const g = this.sim;
    for (const b of this.towerBtns) {
      if (b.lock) continue;
      const afford = g.money >= g.buildCost(b.id);
      const sel = this.buildId === b.id;
      if (afford !== b.afford || sel !== b.sel) {
        b.afford = afford;
        b.sel = sel;
        b.icon.setAlpha(afford ? 1 : 0.45);
        b.cost.setColor(afford ? CSS.yellow : CSS.red);
        b.bg.setTint(sel ? 0xffc27a : 0xffffff);
      }
    }
    for (let i = 0; i < this.abilBtns.length; i++) {
      const b = this.abilBtns[i];
      const s = g.abilities[i];
      if (!s) continue;
      const f = s.cd / s.maxCd;
      b.cdRect.setScale(1, f).setVisible(f > 0);
      const sec = Math.ceil(s.cd);
      if (sec !== this.abilSec[i]) {
        this.abilSec[i] = sec;
        b.cdText.setText(sec > 0 ? String(sec) : '').setVisible(sec > 0);
      }
      b.bg.setTint(this.mode === 'ability' && this.abilitySlot === i ? 0xffc27a : 0xffffff);
    }
    const st = g.state;
    const cdn = st === 'countdown' ? Math.ceil(g.countdown) : -1;
    if (st !== this.last.state || cdn !== this.last.cdn || g.holdCountdown !== this.last.hold) {
      this.last.state = st;
      this.last.cdn = cdn;
      this.last.hold = g.holdCountdown;
      const cd = String(cdn);
      if (st === 'countdown' && !g.holdCountdown) {
        this.callBtn.setEnabled(true).setText(g.waveIdx < 0 ? 'INICIAR\nONDA 1' : 'CHAMAR\nONDA');
        const b = g.earlyBonus();
        this.callSub.setText(`${cd}s  +$${b}`);
      } else if (st === 'countdown') {
        this.callBtn.setEnabled(true).setText('INICIAR\nONDA 1');
        this.callSub.setText('');
      } else {
        this.callBtn.setEnabled(false).setText(st === 'spawning' ? 'ONDA EM\nCURSO' : 'ÚLTIMA\nONDA');
        this.callSub.setText('');
      }
    }
  }

  // ------------------------------------------------------------------ sobreposições
  private buildOverlays(): void {
    this.rangeRing = this.add.image(0, 0, 'anel').setVisible(false).setDepth(75);
    this.minRing = this.add.image(0, 0, 'anel').setVisible(false).setDepth(75).setTint(0xff5a4a);
    this.ghostBase = this.add.image(0, 0, 'base_mg').setVisible(false).setAlpha(0.7).setDepth(76);
    this.ghostTur = this.add.image(0, 0, 'tur_mg_0').setVisible(false).setAlpha(0.7).setDepth(77);
    this.ghostOk = new Button(this, 0, 0, 84, 76, '', () => this.confirmBuild(), { style: 'verde', icon: 'ic_ok', iconSize: 46 });
    this.ghostNo = new Button(this, 0, 0, 84, 76, '', () => this.cancelModes(), { style: 'vermelho', icon: 'ic_x', iconSize: 40 });
    this.ghostOk.setDepth(950).setVisible(false);
    this.ghostNo.setDepth(950).setVisible(false);
    this.abilRing = this.add.image(0, 0, 'anel').setVisible(false).setDepth(78).setTint(0xffcc33);
    this.toastText = this.add
      .text(MAP_W / 2, MAP_Y + 30, '', { ...textStyle(26, CSS.white, false), wordWrap: { width: 1300 }, align: 'center', backgroundColor: 'rgba(20,24,28,0.82)', padding: { x: 18, y: 10 } })
      .setOrigin(0.5, 0)
      .setDepth(960)
      .setVisible(false);
    this.leakFlash = this.add.rectangle(MAP_W / 2, MAP_Y + MAP_H / 2, MAP_W, MAP_H, 0xe0453a, 0).setDepth(940);
    this.leakFlash.setStrokeStyle(40, 0xe0453a, 0.9).setFillStyle(0xe0453a, 0).setAlpha(0);
  }

  private toastTimer?: Phaser.Time.TimerEvent;
  toast(msg: string, ms = 2500): void {
    if (!msg) return;
    this.toastText.setText(msg).setVisible(true).setAlpha(1);
    this.toastTimer?.remove();
    this.toastTimer = this.time.delayedCall(ms, () => this.tweens.add({ targets: this.toastText, alpha: 0, duration: 300, onComplete: () => this.toastText.setVisible(false) }));
  }

  // ------------------------------------------------------------------ construção
  pickTower(id: string): void {
    if (this.ended) return;
    if (!this.level.towers.includes(id)) {
      Sfx.play('error');
      const t = TOWER_BY_ID[id];
      this.toast(`${t.name}: liberada na fase ${t.unlock}.`);
      return;
    }
    Sfx.play('click');
    if (this.mode === 'build' && this.buildId === id) {
      this.cancelModes();
      return;
    }
    this.cancelModes();
    this.closePopup();
    this.mode = 'build';
    this.buildId = id;
    const t = TOWER_BY_ID[id];
    this.toast(`${t.name} — ${t.role}\nToque numa casa livre para ver o alcance e confirme com ✔.`, 4000);
    this.tutorial?.onEvent('modoConstrucao');
  }

  private placeGhost(cx: number, cy: number): void {
    if (!this.buildId || cx < 0 || cy < 0 || cx >= GRID_W || cy >= GRID_H) return;
    this.ghost = { cx, cy };
    const id = this.buildId;
    const def = TOWER_BY_ID[id];
    const x = tx(cx + 0.5);
    const y = ty(cy + 0.5);
    const ok = this.sim.canBuildAt(cx, cy) && this.sim.money >= this.sim.buildCost(id);
    this.ghostBase.setTexture(`base_${id}`).setDisplaySize(TILE, TILE).setPosition(x, y).setVisible(true).setTint(ok ? 0xffffff : 0xff6a6a);
    this.ghostTur.setTexture(`tur_${id}_0`).setDisplaySize(TILE * 1.22, TILE * 1.22).setPosition(x, y).setVisible(true).setRotation(-Math.PI / 2).setTint(ok ? 0xffffff : 0xff6a6a);
    const m = this.sim.towerMods(id);
    const range = def.levels[0].range * (1 + (def.attack === 'support' ? m.reveal : m.range));
    this.showRange(x, y, range, ok ? 0x7ee05a : 0xff5a4a, (def.levels[0].minRange ?? 0) * (1 + m.minRange));
    const bx = Phaser.Math.Clamp(x, 100, MAP_W - 100);
    const by = y - TILE * 1.25 < MAP_Y + 50 ? y + TILE * 1.25 : y - TILE * 1.25;
    this.ghostOk.setPosition(bx + 48, by).setVisible(true).setEnabled(ok);
    this.ghostNo.setPosition(bx - 48, by).setVisible(true);
    this.tutorial?.onEvent('fantasma');
  }

  private confirmBuild(): void {
    if (!this.ghost || !this.buildId) return;
    const t = this.sim.build(this.buildId, this.ghost.cx, this.ghost.cy);
    if (!t) {
      Sfx.play('error');
      this.toast(this.sim.money < this.sim.buildCost(this.buildId) ? 'Dinheiro insuficiente.' : 'Não dá para construir aí.');
      return;
    }
    this.cancelModes();
    this.tutorial?.onEvent('construiu');
  }

  private hideGhost(): void {
    this.ghostBase.setVisible(false);
    this.ghostTur.setVisible(false);
    this.ghostOk.setVisible(false);
    this.ghostNo.setVisible(false);
    this.rangeRing.setVisible(false);
    this.minRing.setVisible(false);
  }

  private showRange(x: number, y: number, r: number, tint: number, minR = 0): void {
    this.rangeRing.setPosition(x, y).setDisplaySize(r * TILE * 2, r * TILE * 2).setTint(tint).setVisible(true);
    if (minR > 0) this.minRing.setPosition(x, y).setDisplaySize(minR * TILE * 2, minR * TILE * 2).setVisible(true);
    else this.minRing.setVisible(false);
  }

  cancelModes(): void {
    this.mode = 'normal';
    this.buildId = null;
    this.ghost = null;
    this.abilitySlot = -1;
    this.hideGhost();
    this.abilRing.setVisible(false);
  }

  // ------------------------------------------------------------------ habilidades
  private pickAbility(i: number): void {
    if (this.ended) return;
    const s = this.sim.abilities[i];
    if (!s) return;
    if (s.cd > 0) {
      Sfx.play('error');
      this.toast(`${s.def.name}: recarregando (${Math.ceil(s.cd)} s).`);
      return;
    }
    Sfx.play('click');
    if (s.def.target === 'none') {
      this.sim.cast(i, MAP_W / 2 / TILE, 2);
      this.cancelModes();
      return;
    }
    if (this.mode === 'ability' && this.abilitySlot === i) {
      this.cancelModes();
      return;
    }
    this.cancelModes();
    this.closePopup();
    this.mode = 'ability';
    this.abilitySlot = i;
    this.toast(`${s.def.name}: ${s.def.desc}\nToque no mapa${s.def.target === 'path' ? ' (sobre a estrada)' : ''} para usar.`, 4000);
  }

  private moveAbilityRing(x: number, y: number): void {
    const s = this.sim.abilities[this.abilitySlot];
    if (!s) return;
    const r = (s.def.params.radius ?? s.def.params.range ?? 1.5) * (1 + this.sim.mods.abilities[s.def.id].radius);
    this.abilRing.setPosition(x, y).setDisplaySize(r * TILE * 2, r * TILE * 2).setVisible(true);
  }

  // ------------------------------------------------------------------ toques no mapa
  private tapMap(x: number, y: number): void {
    if (this.ended || this.paused) return;
    if (x < MAP_X || x >= MAP_X + MAP_W || y < MAP_Y || y >= MAP_Y + MAP_H) return;
    const fx = (x - MAP_X) / TILE;
    const fy = (y - MAP_Y) / TILE;
    const cx = Math.floor(fx);
    const cy = Math.floor(fy);
    if (this.mode === 'ability') {
      const ok = this.sim.cast(this.abilitySlot, fx, fy);
      if (!ok) {
        Sfx.play('error');
        this.toast('Escolha um ponto sobre a estrada.');
        return;
      }
      this.cancelModes();
      return;
    }
    if (this.mode === 'build') {
      if (this.ghost && this.ghost.cx === cx && this.ghost.cy === cy && this.sim.canBuildAt(cx, cy)) {
        this.confirmBuild();
        return;
      }
      const tw = this.sim.towerAt(cx, cy);
      if (tw) {
        this.cancelModes();
        this.selectTower(tw);
        return;
      }
      const obs = this.sim.obstacleAtCell(cx, cy);
      if (obs) {
        this.cancelModes();
        this.markObstacle(obs);
        return;
      }
      this.placeGhost(cx, cy);
      return;
    }
    const tw = this.sim.towerAt(cx, cy);
    if (tw) {
      this.selectTower(tw);
      return;
    }
    const ob = this.sim.obstacleAtCell(cx, cy);
    if (ob) {
      this.markObstacle(ob);
      return;
    }
    this.closePopup();
  }

  private markObstacle(o: Obstacle): void {
    this.closePopup();
    this.sim.toggleMark(o);
    Sfx.play('mark');
    if (o.marked) {
      const any = this.sim.towers.some((t) => {
        if (!t.canGround || t.temp || t.def.attack === 'support') return false;
        const d = Math.hypot(t.x - o.x, t.y - o.y);
        return d <= t.stats.range + 0.3 && d >= t.stats.minRange;
      });
      this.toast(`${o.def.name} marcado: ${Math.ceil(o.hp)} de resistência, vale $${o.def.reward}.${any ? '' : '\nNenhuma torre alcança este ponto ainda!'}\nAs torres no alcance atiram nele em vez dos inimigos.`, 3500);
      this.tutorial?.onEvent('marcou');
    } else this.toast('Marcação removida.');
  }

  // ------------------------------------------------------------------ torre selecionada
  private selectTower(t: Tower): void {
    Sfx.play('click');
    this.selected = t;
    this.openPopup(t);
    this.tutorial?.onEvent('selecionou');
  }

  private closePopup(): void {
    this.popup?.destroy();
    this.popup = null;
    this.popupTower = null;
    this.selected = null;
    if (this.mode === 'normal') {
      this.rangeRing.setVisible(false);
      this.minRing.setVisible(false);
    }
  }

  private openPopup(t: Tower): void {
    this.popup?.destroy();
    this.popupTower = t;
    const g = this.sim;
    const x = tx(t.x);
    const y = ty(t.y);
    this.showRange(x, y, t.stats.range, 0xffffff, t.stats.minRange);
    const pw = 470;
    const ph = 300;
    const left = x > MAP_W / 2;
    const px = left ? x - TILE * 0.8 - pw / 2 : x + TILE * 0.8 + pw / 2;
    const py = Phaser.Math.Clamp(y, MAP_Y + ph / 2 + 10, MAP_Y + MAP_H - ph / 2 - 10);
    const c = this.add.container(px, py).setDepth(955);
    c.add(panel(this, 0, 0, pw, ph));
    const def = t.def;
    c.add(this.add.text(-pw / 2 + 28, -ph / 2 + 22, `${def.name}`, textStyle(30, CSS.yellow)));
    const lvl = this.add.text(pw / 2 - 70, -ph / 2 + 22, `Nv ${t.level + 1}`, textStyle(28)).setOrigin(1, 0);
    c.add(lvl);
    c.add(new Button(this, pw / 2 - 34, -ph / 2 + 36, 56, 56, '', () => this.closePopup(), { style: 'vermelho', icon: 'ic_x', iconSize: 30 }));
    const s = t.stats;
    let line1 = '';
    if (def.attack === 'support') line1 = `Radar ${fmt(s.range)} • −${Math.round(s.slow * 100)}% vel. veículos • +${Math.round(s.aura * 100)}% alcance vizinhas`;
    else if (def.attack === 'flame' || def.attack === 'beam') line1 = `${DAMAGE.damageTypes[def.dmgType].name} • ${Math.round(s.dmg)}/s • Alcance ${fmt(s.range)}`;
    else line1 = `${DAMAGE.damageTypes[def.dmgType].name} • Dano ${Math.round(s.dmg)}${s.missiles > 1 ? `×${s.missiles}` : ''} • ${fmt(s.rate, 2)}/s • Alcance ${fmt(s.range)}`;
    c.add(this.add.text(-pw / 2 + 28, -ph / 2 + 70, line1, { ...textStyle(21, CSS.white, false), wordWrap: { width: pw - 50 } }));
    const stat = this.add.text(-pw / 2 + 28, -ph / 2 + 128, '', textStyle(21, CSS.grey, false));
    c.add(stat);
    const upCost = g.upgradeCost(t);
    const maxed = t.level >= def.levels.length - 1;
    const up = new Button(this, -pw / 4 + 6, 64, pw / 2 - 30, 78, maxed ? 'MÁXIMO' : `$${upCost}`, () => {
      if (g.upgrade(t)) this.openPopup(t);
      else Sfx.play('error');
    }, { style: 'verde', icon: 'ic_melhorar', fontSize: 28, iconSize: 40 });
    up.setEnabled(!maxed && g.money >= upCost);
    c.add(up);
    const sell = new Button(this, pw / 4 - 6, 64, pw / 2 - 30, 78, `$${g.sellValue(t)}`, () => {
      g.sell(t);
      this.closePopup();
    }, { style: 'vermelho', icon: 'ic_vender', fontSize: 28, iconSize: 40 });
    c.add(sell);
    if (def.attack !== 'support') {
      const pr = new Button(this, 0, 118, pw - 50, 52, `ALVO: ${PRIORITY_NAMES[t.priority].toUpperCase()}`, () => {
        g.setPriority(t, (((t.priority + 1) % 4) as Priority));
        pr.setText(`ALVO: ${PRIORITY_NAMES[t.priority].toUpperCase()}`);
      }, { style: 'cinza', icon: 'ic_alvo', fontSize: 22, iconSize: 32 });
      c.add(pr);
    }
    (c as any)._upd = () => {
      stat.setText(def.attack === 'support' ? 'Revela camuflados no raio do radar.' : `Dano causado: ${Math.round(t.dmgDealt)}  •  Abates: ${t.kills}`);
      up.setEnabled(!maxed && g.money >= upCost);
    };
    this.popup = c;
    this.popupKey = -1;
  }

  // ------------------------------------------------------------------ ondas, velocidade, pausa
  callWave(): void {
    if (this.ended) return;
    const g = this.sim;
    if (g.state !== 'countdown') return;
    if (g.holdCountdown) g.holdCountdown = false;
    const bonus = g.callWave();
    if (bonus > 0) this.toast(`Onda chamada antes da hora: +$${bonus}!`);
    this.tutorial?.onEvent('onda');
  }

  private toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
    this.speedBtn.setText(`${this.speed}x`);
    this.speedBtn.setStyle(this.speed === 2 ? 'laranja' : 'cinza');
  }

  /** Botão voltar do Android. */
  onBack(): void {
    if (this.pauseMenu) this.closePause();
    else if (this.mode !== 'normal') this.cancelModes();
    else if (this.popup) this.closePopup();
    else this.openPause();
  }

  openPause(): void {
    if (this.ended || this.pauseMenu) return;
    this.paused = true;
    const c = this.add.container(0, 0).setDepth(5000);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive());
    c.add(panel(this, W / 2, H / 2, 620, 720));
    c.add(this.add.text(W / 2, H / 2 - 300, 'PAUSA', textStyle(56, CSS.yellow)).setOrigin(0.5));
    const st = Save.d.settings;
    const items: [string, () => void, 'laranja' | 'verde' | 'cinza' | 'vermelho'][] = [
      ['CONTINUAR', () => this.closePause(), 'laranja'],
      ['REINICIAR FASE', () => this.scene.restart({ levelId: this.level.id, abilities: this.abilityIds }), 'cinza'],
      [`MÚSICA: ${st.music ? 'LIGADA' : 'DESLIGADA'}`, () => { st.music = !st.music; Save.write(); Sfx.applySettings(); this.closePause(); this.openPause(); }, 'cinza'],
      [`EFEITOS: ${st.sfx ? 'LIGADOS' : 'DESLIGADOS'}`, () => { st.sfx = !st.sfx; Save.write(); Sfx.applySettings(); this.closePause(); this.openPause(); }, 'cinza'],
      ['SAIR PARA O MAPA', () => this.scene.start('Campaign'), 'vermelho'],
    ];
    items.forEach(([label, fn, style], i) => c.add(new Button(this, W / 2, H / 2 - 190 + i * 112, 500, 92, label, fn, { style, fontSize: 32 })));
    this.pauseMenu = c;
  }

  private closePause(): void {
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    this.paused = false;
  }

  // ------------------------------------------------------------------ eventos visuais
  private onLeak(n: number): void {
    this.leakFlash.setAlpha(0.9);
    this.tweens.add({ targets: this.leakFlash, alpha: 0, duration: 450 });
    this.tweens.killTweensOf(this.livesIcon);
    this.livesIcon.setDisplaySize(46, 46);
    this.tweens.add({ targets: this.livesIcon, scale: this.livesIcon.scale * 1.4, yoyo: true, duration: 120 });
    this.view.number(140, MAP_Y + 30, `-${n}`, 0xff5a4a, 1.4);
  }

  private onWave(n: number): void {
    const last = n === this.sim.totalWaves;
    const boss = last && this.level.waves[n - 1].groups.some((g) => g.enemy.startsWith('boss_'));
    const txt = boss ? `ONDA FINAL — CHEFE: ${ENEMY_BY_ID[this.level.waves[n - 1].groups.find((g) => g.enemy.startsWith('boss_'))!.enemy].name.toUpperCase()}` : last ? 'ONDA FINAL!' : `ONDA ${n}`;
    const t = this.add.text(MAP_W / 2, MAP_Y + MAP_H / 2 - 120, txt, { ...textStyle(boss ? 52 : 72, boss ? CSS.red : CSS.yellow), strokeThickness: 12 }).setOrigin(0.5).setDepth(970).setAlpha(0).setScale(0.6);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 260, ease: 'Back.out', hold: 900, yoyo: true, onComplete: () => t.destroy() });
    if (boss) this.view.shake(0.006, 600);
  }

  private onBossEvent(k: string): void {
    const msg: Record<string, string> = {
      fumaca: 'O Escorpião soltou fumaça: ninguém consegue mirar nele por alguns segundos!',
      colosso: 'O Colosso largou a blindagem pesada e acelerou! Soldados de elite desembarcaram!',
      escudo: 'Escudo da Fortaleza caiu! Ela está exposta — fogo total!',
      emp: 'Pulso EMP do Ciclope: torres próximas desligadas!',
      drones: 'O Ciclope lançou um enxame de drones!',
    };
    if (msg[k]) this.toast(msg[k], 2500);
  }

  // ------------------------------------------------------------------ laço principal
  update(_time: number, delta: number): void {
    const t0 = performance.now();
    this.frameUpdate(delta);
    // medição de desempenho (ms gastos em lógica + visual por quadro)
    const perf = ((window as any).__perf ??= { ema: 0, max: 0, n: 0 });
    const ms = performance.now() - t0;
    perf.ema = perf.ema * 0.95 + ms * 0.05;
    perf.n++;
    if (perf.n > 60) perf.max = Math.max(perf.max * 0.999, ms);
  }

  private frameUpdate(delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    if (!this.paused && !this.ended) {
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= DT && steps < 8) {
        this.sim.step(DT);
        this.acc -= DT;
        steps++;
      }
      if (steps >= 8) this.acc = 0;
    }
    this.view.handleEvents();
    this.view.sync(this.paused ? 0 : dt * this.speed);
    this.updateHudValues();
    this.updatePanel();
    this.updatePreview();
    if (this.popup) {
      const t = this.popupTower;
      if (!t || !t.active) this.closePopup();
      else {
        const key = t.level * 1e9 + Math.floor(this.sim.money / 5) * 1e5 + (Math.round(t.dmgDealt / 10) % 1000) * 100 + (t.kills % 100);
        if (key !== this.popupKey) {
          this.popupKey = key;
          (this.popup as any)._upd?.();
        }
      }
    }
    if (this.mode === 'build' && this.ghost) {
      // atualiza a cor se o dinheiro mudou
      const ok = this.sim.canBuildAt(this.ghost.cx, this.ghost.cy) && this.sim.money >= this.sim.buildCost(this.buildId!);
      this.ghostOk.setEnabled(ok);
    }
    this.tutorial?.update();
    this.updateBossBar();
    if (!this.ended && this.sim.over) this.finish();
  }

  /** Barra de vida do chefe no topo do mapa. */
  private updateBossBar(): void {
    let boss = null as null | (typeof this.sim.alive)[number];
    const al = this.sim.alive;
    for (let i = 0; i < al.length; i++) if (al[i].active && al[i].def.boss) {
      boss = al[i];
      break;
    }
    if (!boss) {
      if (this.bossBar) this.bossBar.c.setVisible(false);
      return;
    }
    if (!this.bossBar) {
      const c = this.add.container(MAP_W / 2, MAP_Y + MAP_H - 46).setDepth(930);
      c.add(this.add.rectangle(0, 0, 820, 46, 0x1b1f22, 0.85).setStrokeStyle(4, 0x1b1f22));
      const fill = this.add.rectangle(-404, 4, 808, 18, 0xe0453a).setOrigin(0, 0.5);
      const shield = this.add.rectangle(-404, 15, 808, 6, 0x3fd0ff).setOrigin(0, 0.5);
      const name = this.add.text(0, -12, '', textStyle(20, CSS.yellow)).setOrigin(0.5);
      c.add([fill, shield, name]);
      this.bossBar = { c, fill, shield, name, uid: -1 };
    }
    const b = this.bossBar;
    b.c.setVisible(true);
    if (b.uid !== boss.uid) {
      b.uid = boss.uid;
      b.name.setText(`CHEFE: ${boss.def.name.toUpperCase()}`);
      Sfx.play('boss');
    }
    b.fill.setScale(Math.max(0, boss.hp / boss.maxHp), 1);
    const sm = boss.bossShieldMax;
    b.shield.setVisible(sm > 0).setScale(sm > 0 ? boss.shield / sm : 0, 1);
  }

  private updateHudValues(): void {
    const g = this.sim;
    if (g.lives !== this.last.lives) {
      this.last.lives = g.lives;
      this.livesText.setText(`${g.lives}`);
      this.livesText.setColor(g.lives <= 5 ? CSS.red : CSS.white);
    }
    const m = Math.floor(g.money);
    if (m !== this.last.money) {
      this.last.money = m;
      this.moneyText.setText(`$${m}`);
    }
    if (g.waveIdx !== this.last.wave) {
      this.last.wave = g.waveIdx;
      this.waveText.setText(`ONDA ${Math.max(0, g.waveIdx + 1)}/${g.totalWaves}`);
    }
  }

  // ------------------------------------------------------------------ fim de fase
  private finish(): void {
    this.ended = true;
    this.cancelModes();
    this.closePopup();
    this.toastText.setVisible(false);
    Sfx.setLoops(0, 0);
    const won = this.sim.state === 'won';
    const st = this.sim.stars;
    const before = Save.d.levels[this.level.id]?.stars ?? 0;
    const pts = Save.recordResult(this.level.id, won, st, this.sim.lives);
    if (this.level.tutorial && won) {
      Save.d.tutorialDone = true;
      Save.write();
    }
    this.time.delayedCall(won ? 900 : 600, () => {
      Sfx.play(won ? 'victory' : 'defeat');
      const c = this.add.container(0, 0).setDepth(6000);
      c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive());
      c.add(panel(this, W / 2, H / 2, 900, 700));
      hazardStrip(this, W / 2 - 430, H / 2 - 340, 860, 18).setDepth(6001);
      c.add(this.add.text(W / 2, H / 2 - 260, won ? 'VITÓRIA!' : 'DERROTA', { ...textStyle(84, won ? CSS.yellow : CSS.red), strokeThickness: 12 }).setOrigin(0.5));
      if (won) {
        const ss = stars(this, W / 2, H / 2 - 150, st, 90, 14);
        ss.forEach((s, i) => {
          c.add(s);
          if (i < st) {
            s.setScale(0);
            this.tweens.add({ targets: s, scale: 90 / s.width, delay: 300 + i * 280, duration: 300, ease: 'Back.out', onStart: () => Sfx.play('coin') });
          }
        });
      }
      const s = this.sim.stat;
      const lines = won
        ? [
            `Vidas restantes: ${this.sim.lives}/${this.sim.maxLives}${st > before ? '  (recorde!)' : ''}`,
            `Inimigos abatidos: ${s.kills}   •   Obstáculos: $${s.earnObst}`,
            pts > 0 ? `+${pts} ponto${pts > 1 ? 's' : ''} de pesquisa!` : 'Nenhum ponto novo (supere seu recorde de estrelas).',
          ]
        : [
            `A base caiu na onda ${this.sim.waveIdx + 1} de ${this.sim.totalWaves}.`,
            'Dica: combine tipos de dano diferentes. Veja a matriz na Enciclopédia.',
            'Pesquisas e habilidades também ajudam.',
          ];
      lines.forEach((l, i) => c.add(this.add.text(W / 2, H / 2 - 50 + i * 50, l, textStyle(i === 2 && won ? 32 : 28, i === 2 && won ? CSS.green : CSS.white, i !== 2)).setOrigin(0.5)));
      const idx = LEVELS.findIndex((l) => l.id === this.level.id);
      const next = LEVELS[idx + 1];
      const btns: [string, () => void, 'laranja' | 'verde' | 'cinza' | 'vermelho'][] = [
        ['MAPA', () => this.scene.start('Campaign'), 'cinza'],
        ['REPETIR', () => this.scene.restart({ levelId: this.level.id, abilities: this.abilityIds }), 'cinza'],
        ['PESQUISA', () => this.scene.start('Research'), 'verde'],
      ];
      if (won && next) btns.push(['PRÓXIMA', () => this.scene.start('PreLevel', { levelId: next.id }), 'laranja']);
      const bw = 200;
      btns.forEach(([label, fn, style], i) => c.add(new Button(this, W / 2 + (i - (btns.length - 1) / 2) * (bw + 16), H / 2 + 250, bw, 96, label, fn, { style, fontSize: 28 })));
    });
  }

  /** Para o tutorial: posição de tela de uma casa. */
  cellCenter(cx: number, cy: number): { x: number; y: number } {
    return { x: tx(cx + 0.5), y: ty(cy + 0.5) };
  }

  towerButtonPos(id: string): { x: number; y: number } {
    const b = this.towerBtns.find((t) => t.id === id)!;
    return { x: b.bg.x, y: b.bg.y };
  }

  modalBox(title: string, body: string, ok: () => void): void {
    modal(this, title, body, [{ text: 'ENTENDI', onClick: ok }]);
  }
}
