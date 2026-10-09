import Phaser from 'phaser';
import { ABILITIES, RESEARCH, TOWERS } from '../../core/data';
import { nodeKey, nodeState, spentPoints, type NodeState } from '../../core/research';
import type { ResearchNode } from '../../core/types';
import { Sfx } from '../audio';
import { C, CSS, H, W, textStyle } from '../config';
import { Save } from '../save';
import { Button, modal, panel, screenBackground, screenHeader, towerIcon } from '../ui/ui';

const STATE_COL: Record<NodeState, number> = { pesquisado: 0x6fcf4a, disponivel: 0xff8a1f, bloqueado: 0x59636b, excluido: 0x3a2a2a };
const STATE_TXT: Record<NodeState, string> = { pesquisado: 'PESQUISADO', disponivel: 'DISPONÍVEL', bloqueado: 'BLOQUEADO (pré-requisito)', excluido: 'TRAVADO (ramo oposto escolhido)' };

export class ResearchScene extends Phaser.Scene {
  private tab: 'torre' | 'hab' = 'torre';
  private owner = 'mg';
  private node: ResearchNode | null = null;
  private dyn: Phaser.GameObjects.GameObject[] = [];
  constructor() {
    super('Research');
  }

  create(): void {
    this.dyn = [];
    screenBackground(this);
    screenHeader(this, 'PESQUISA', () => this.scene.start('Campaign'));
    this.render();
  }

  private clear(): void {
    for (const o of this.dyn) o.destroy();
    this.dyn = [];
  }

  private add2<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.dyn.push(o);
    return o;
  }

  private render(): void {
    this.clear();
    const researched = new Set(Save.d.researched);
    const free = Save.freePoints();
    const earned = Save.earnedPoints();
    // pontos
    this.add2(this.add.image(W - 560, 70, 'ic_pesquisa').setDisplaySize(52, 52));
    this.add2(this.add.text(W - 525, 70, `Pontos livres: ${free}   (ganhos: ${earned} de 100)`, textStyle(28)).setOrigin(0, 0.5));
    this.add2(new Button(this, W - 200, 180, 320, 80, 'REDISTRIBUIR', () => this.reset(), { style: 'cinza', fontSize: 26 }));
    // abas
    this.add2(new Button(this, 200, 180, 300, 80, 'TORRES', () => { this.tab = 'torre'; this.owner = 'mg'; this.node = null; this.render(); }, { style: this.tab === 'torre' ? 'laranja' : 'cinza', fontSize: 30 }));
    this.add2(new Button(this, 520, 180, 300, 80, 'HABILIDADES', () => { this.tab = 'hab'; this.owner = 'aereo'; this.node = null; this.render(); }, { style: this.tab === 'hab' ? 'laranja' : 'cinza', fontSize: 30 }));
    // lista
    const list = this.tab === 'torre' ? TOWERS.map((t) => ({ id: t.id, name: t.name, unlocked: Save.isTowerUnlocked(t.id) })) : ABILITIES.map((a) => ({ id: a.id, name: a.name, unlocked: Save.isAbilityUnlocked(a.id) }));
    this.add2(panel(this, 190, 610, 320, 760, true));
    list.forEach((it, i) => {
      const y = 270 + i * 94;
      const sel = it.id === this.owner;
      const bg = this.add2(this.add.nineslice(190, y, sel ? 'ui_botao' : 'ui_painel', undefined, 290, 86, 22, 22, 22, 22));
      if (this.tab === 'torre') this.add2(towerIcon(this, 80, y, it.id, 58));
      else this.add2(this.add.image(80, y, `ic_hab_${it.id}`).setDisplaySize(56, 56));
      this.add2(this.add.text(120, y, it.name, textStyle(22)).setOrigin(0, 0.5).setAlpha(it.unlocked ? 1 : 0.5));
      if (!it.unlocked) this.add2(this.add.image(310, y, 'ic_cadeado').setDisplaySize(34, 34));
      // pontos já investidos
      const tree = this.tab === 'torre' ? RESEARCH.towers[it.id] : RESEARCH.abilities[it.id];
      const inv = tree.nodes.filter((n) => researched.has(nodeKey(this.tab, it.id, n.id))).reduce((a, n) => a + n.cost, 0);
      if (inv > 0) this.add2(this.add.text(320, y + 26, `${inv}`, textStyle(20, CSS.green)).setOrigin(1, 0.5));
      bg.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        Sfx.play('click');
        this.owner = it.id;
        this.node = null;
        this.render();
      });
    });
    this.renderTree(researched);
  }

  private renderTree(researched: Set<string>): void {
    const kind = this.tab;
    const tree = kind === 'torre' ? RESEARCH.towers[this.owner] : RESEARCH.abilities[this.owner];
    const unlocked = kind === 'torre' ? Save.isTowerUnlocked(this.owner) : Save.isAbilityUnlocked(this.owner);
    const ox = 420;
    const oy = 240;
    const aw = 900;
    const ah = 800;
    this.add2(panel(this, ox + aw / 2, oy + ah / 2 - 10, aw, ah, true));
    const rows = Math.max(...tree.nodes.map((n) => n.row)) + 1;
    const cellW = aw / 3;
    const cellH = (ah - 60) / rows;
    const pos = (n: ResearchNode) => ({ x: ox + cellW * (n.col + 0.5), y: oy + 40 + cellH * (n.row + 0.5) });
    // linhas
    const g = this.add2(this.add.graphics());
    for (const n of tree.nodes)
      for (const r of n.req) {
        const a = pos(tree.nodes.find((m) => m.id === r)!);
        const b = pos(n);
        const done = researched.has(nodeKey(kind, this.owner, r)) && researched.has(nodeKey(kind, this.owner, n.id));
        g.lineStyle(10, C.outline, 1);
        g.lineBetween(a.x, a.y, b.x, b.y);
        g.lineStyle(5, done ? 0x6fcf4a : 0x8f979e, 1);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    // rótulos dos ramos
    const exA = tree.nodes.find((n) => n.excl.length && n.col === 0);
    if (exA) {
      const pa = pos(exA);
      this.add2(this.add.text(pa.x, pa.y - cellH * 0.55, `RAMO A: ${tree.branchA.toUpperCase()}`, textStyle(18, CSS.cyan)).setOrigin(0.5));
      const exB = tree.nodes.find((n) => n.excl.length && n.col === 2)!;
      const pb = pos(exB);
      this.add2(this.add.text(pb.x, pb.y - cellH * 0.55, `RAMO B: ${tree.branchB.toUpperCase()}`, textStyle(18, CSS.cyan)).setOrigin(0.5));
      this.add2(this.add.text((pa.x + pb.x) / 2, pa.y, 'ESCOLHA\nUM', { ...textStyle(20, CSS.orange), align: 'center' }).setOrigin(0.5));
    }
    for (const n of tree.nodes) {
      const p = pos(n);
      const st = nodeState(kind, this.owner, n.id, researched);
      const col = STATE_COL[st];
      const nw = 250;
      const nh = Math.min(92, cellH - 18);
      const box = this.add2(this.add.rectangle(p.x, p.y, nw, nh, col).setStrokeStyle(this.node?.id === n.id ? 7 : 4, this.node?.id === n.id ? 0xffffff : C.outline));
      this.add2(this.add.rectangle(p.x, p.y - nh / 2 + 6, nw - 10, 6, 0xffffff, 0.2));
      this.add2(this.add.text(p.x, p.y - 10, n.name, { ...textStyle(19, st === 'excluido' ? '#777' : CSS.white), align: 'center', wordWrap: { width: nw - 20 } }).setOrigin(0.5));
      this.add2(this.add.text(p.x, p.y + nh / 2 - 18, st === 'pesquisado' ? '✔' : `${n.cost} pt${n.cost > 1 ? 's' : ''}`, textStyle(18, st === 'pesquisado' ? CSS.white : CSS.yellow)).setOrigin(0.5));
      if (st === 'excluido') this.add2(this.add.image(p.x + nw / 2 - 18, p.y - nh / 2 + 18, 'ic_x').setDisplaySize(26, 26));
      box.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        Sfx.play('click');
        this.node = n;
        this.render();
      });
    }
    // detalhes
    const dx = 1360;
    const dw = W - dx - 30;
    this.add2(panel(this, dx + dw / 2, 630, dw, 780));
    const title = kind === 'torre' ? TOWERS.find((t) => t.id === this.owner)!.name : ABILITIES.find((a) => a.id === this.owner)!.name;
    this.add2(this.add.text(dx + 30, 270, title.toUpperCase(), textStyle(30, CSS.yellow)));
    if (!unlocked) this.add2(this.add.text(dx + 30, 320, 'Ainda não liberada na campanha.', textStyle(22, CSS.red, false)));
    const n = this.node;
    if (!n) {
      this.add2(this.add.text(dx + 30, 380, 'Toque num nó da árvore para ver os detalhes.\n\nCada nó dá um bônus pequeno (5–10%). Os ramos A e B são exclusivos: escolher um trava o outro.\n\nOs pontos do jogo não bastam para tudo — especialize-se!', { ...textStyle(22, CSS.white, false), wordWrap: { width: dw - 60 } }));
      return;
    }
    const st = nodeState(kind, this.owner, n.id, researched);
    this.add2(this.add.text(dx + 30, 380, n.name, textStyle(28)));
    this.add2(this.add.text(dx + 30, 430, n.desc, { ...textStyle(24, CSS.green, false), wordWrap: { width: dw - 60 } }));
    this.add2(this.add.text(dx + 30, 530, `Custo: ${n.cost} ponto${n.cost > 1 ? 's' : ''}`, textStyle(24, CSS.yellow)));
    this.add2(this.add.text(dx + 30, 575, `Estado: ${STATE_TXT[st]}`, { ...textStyle(22, CSS.white, false), wordWrap: { width: dw - 60 } }));
    if (n.req.length) {
      const names = n.req.map((r) => tree.nodes.find((m) => m.id === r)!.name).join(' ou ');
      this.add2(this.add.text(dx + 30, 640, `Requer: ${names}`, { ...textStyle(20, CSS.grey, false), wordWrap: { width: dw - 60 } }));
    }
    if (n.excl.length) {
      const names = n.excl.map((r) => tree.nodes.find((m) => m.id === r)!.name).join(', ');
      this.add2(this.add.text(dx + 30, 700, `Exclusivo com: ${names}`, { ...textStyle(20, CSS.orange, false), wordWrap: { width: dw - 60 } }));
    }
    const can = st === 'disponivel' && unlocked && Save.freePoints() >= n.cost;
    const btn = this.add2(new Button(this, dx + dw / 2, 900, dw - 60, 100, st === 'pesquisado' ? 'PESQUISADO' : 'PESQUISAR', () => {
      Save.d.researched.push(nodeKey(kind, this.owner, n.id));
      Save.write();
      Sfx.play('upgrade');
      this.render();
    }, { style: 'verde', fontSize: 34, icon: 'ic_pesquisa' }));
    btn.setEnabled(can);
    if (st === 'disponivel' && Save.freePoints() < n.cost) this.add2(this.add.text(dx + dw / 2, 970, 'Pontos insuficientes', textStyle(20, CSS.red)).setOrigin(0.5));
  }

  private reset(): void {
    if (!Save.d.researched.length) return;
    modal(this, 'REDISTRIBUIR PONTOS', `Devolve todos os ${spentPoints(Save.d.researched)} pontos gastos, sem custo. Você pode pesquisar de novo do jeito que quiser.`, [
      { text: 'CANCELAR', style: 'cinza', onClick: () => {} },
      { text: 'REDISTRIBUIR', style: 'laranja', onClick: () => { Save.d.researched = []; Save.write(); Sfx.play('sell'); this.render(); } },
    ]);
  }
}

export { H };
