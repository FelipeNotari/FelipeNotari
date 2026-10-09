import Phaser from 'phaser';
import { GRID_H, GRID_W } from '../../core/data';
import { CELL_FREE } from '../../core/game';
import { CSS, MAP_W, MAP_Y, PANEL_X, PANEL_W, TILE, textStyle } from '../config';
import { Button, panel } from '../ui/ui';
import type { GameScene } from './GameScene';

type Step = { text: string; target?: () => { x: number; y: number } | null; wait?: string; ok?: boolean };

/** Tutorial curto e jogável da fase 1. */
export class Tutorial {
  private i = -1;
  private box: Phaser.GameObjects.Container | null = null;
  private arrow: Phaser.GameObjects.Image;
  private halo: Phaser.GameObjects.Arc;
  private steps: Step[];
  private suggested: { cx: number; cy: number } | null = null;

  constructor(private s: GameScene) {
    s.sim.holdCountdown = true;
    this.arrow = s.add.image(0, 0, 'ic_melhorar').setDisplaySize(70, 70).setRotation(Math.PI).setTint(0xff8a1f).setDepth(990).setVisible(false);
    this.halo = s.add.circle(0, 0, 60).setStrokeStyle(8, 0xffcc33, 1).setDepth(989).setVisible(false);
    s.tweens.add({ targets: this.halo, scale: 1.25, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
    this.suggested = this.bestTile();
    this.steps = [
      { text: 'Bem-vindo, comandante! A Legião Cinza vai atacar pela estrada até a nossa base (no fim dela). Cada inimigo que chegar tira vidas. Vamos montar a defesa.', ok: true },
      { text: 'Toque na METRALHADORA no painel à direita. Ela é barata e ótima contra infantaria.', target: () => this.s.towerButtonPos('mg'), wait: 'modoConstrucao' },
      { text: 'Agora toque numa casa livre perto de uma curva da estrada. O círculo verde mostra o alcance da torre.', target: () => (this.suggested ? this.s.cellCenter(this.suggested.cx, this.suggested.cy) : null), wait: 'fantasma' },
      { text: 'Toque no botão ✔ (ou de novo na mesma casa) para construir.', wait: 'construiu' },
      { text: 'Obstáculos ocupam os melhores pontos do mapa. Toque neste para marcá-lo como alvo: suas torres atiram nele, ele vira dinheiro e libera o terreno. (Enquanto isso, elas não atiram nos inimigos!)', target: () => this.obstacleTarget(), wait: 'marcou' },
      { text: 'Toque numa torre para MELHORAR (3 níveis), VENDER (devolve 70%) ou mudar o ALVO: primeiro, último, mais forte ou mais fraco.', ok: true },
      { text: 'Quando estiver pronto, toque em INICIAR ONDA. Nas próximas ondas, chamar antes do tempo dá dinheiro extra!', target: () => ({ x: this.s.callBtn.x, y: this.s.callBtn.y }), wait: 'onda' },
      { text: 'As habilidades especiais ficam abaixo das torres e recarregam com o tempo. Use nos momentos críticos. Boa sorte!', ok: true },
    ];
    this.next();
  }

  private bestTile(): { cx: number; cy: number } | null {
    const g = this.s.sim;
    let best: { cx: number; cy: number } | null = null;
    let bv = -1;
    for (let cy = 0; cy < GRID_H; cy++)
      for (let cx = 0; cx < GRID_W; cx++) {
        if (g.grid[cy * GRID_W + cx] !== CELL_FREE) continue;
        let v = 0;
        for (const p of g.paths) v += p.coverage(cx + 0.5, cy + 0.5, 2.8);
        if (v > bv) {
          bv = v;
          best = { cx, cy };
        }
      }
    return best;
  }

  private obstacleTarget(): { x: number; y: number } | null {
    const g = this.s.sim;
    const t = g.towers[0];
    if (!t) return null;
    let best = null as null | { x: number; y: number; d: number };
    for (const o of g.obstacles) {
      if (!o.alive) continue;
      const d = Math.hypot(o.x - t.x, o.y - t.y);
      if (d <= t.stats.range + 0.3 && (!best || d < best.d)) best = { ...this.s.cellCenter(o.cx, o.cy), d };
    }
    return best;
  }

  private next(): void {
    this.i++;
    this.box?.destroy();
    this.box = null;
    this.arrow.setVisible(false);
    this.halo.setVisible(false);
    const st = this.steps[this.i];
    if (!st) {
      this.s.sim.holdCountdown = false;
      return;
    }
    // passo de obstáculo sem obstáculo ao alcance: pula
    if (st.wait === 'marcou' && !this.obstacleTarget()) {
      this.next();
      return;
    }
    const w = 1000;
    const c = this.s.add.container(MAP_W / 2, MAP_Y + 120).setDepth(991);
    const txt = this.s.add.text(0, 0, st.text, { ...textStyle(28, CSS.white, false), wordWrap: { width: w - 80 }, align: 'center' }).setOrigin(0.5);
    const h = txt.height + (st.ok || st.wait === 'marcou' ? 130 : 60);
    c.add(panel(this.s, 0, h / 2 - 30, w, h));
    txt.setY(txt.height / 2);
    c.add(txt);
    c.add(this.s.add.text(-w / 2 + 30, -14, 'INSTRUTOR', textStyle(22, CSS.yellow)));
    if (st.ok) c.add(new Button(this.s, 0, h - 90, 260, 70, 'ENTENDI', () => this.next(), { style: 'laranja', fontSize: 28 }));
    if (st.wait === 'marcou') c.add(new Button(this.s, 0, h - 90, 220, 66, 'PULAR', () => this.next(), { style: 'cinza', fontSize: 26 }));
    if (this.i === this.steps.length - 1) this.s.time.delayedCall(7000, () => this.i === this.steps.length - 1 && this.next());
    this.box = c;
    // não deixa a caixa cobrir o alvo
    const tg = st.target?.();
    if (tg && tg.y < MAP_Y + 140 + h) c.setY(MAP_Y + 640);
    if (tg && tg.x > PANEL_X - 10) c.setX(MAP_W / 2 - 80);
  }

  onEvent(ev: string): void {
    const st = this.steps[this.i];
    if (st && st.wait === ev) this.next();
    if (ev === 'onda' && this.i < this.steps.length - 1) {
      // jogador pulou etapas: encerra o tutorial com a última dica
      this.i = this.steps.length - 2;
      this.next();
    }
  }

  update(): void {
    const st = this.steps[this.i];
    if (!st || !st.target) return;
    const tg = st.target();
    if (!tg) return;
    const bob = Math.sin(this.s.time.now / 180) * 10;
    this.arrow.setVisible(true).setPosition(tg.x, tg.y - TILE * 0.95 + bob);
    if (tg.x > PANEL_X) this.arrow.setPosition(tg.x - PANEL_W * 0.6 + bob, tg.y).setRotation(Math.PI / 2);
    else this.arrow.setRotation(Math.PI);
    this.halo.setVisible(true).setPosition(tg.x, tg.y);
  }
}
