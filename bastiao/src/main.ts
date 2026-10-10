import Phaser from 'phaser';
import { App } from '@capacitor/app';
import { Sfx } from './game/audio';
import { ENEMY_BY_ID } from './core/data';
import { H, W } from './game/config';
import { BootScene } from './game/scenes/BootScene';
import { MenuScene } from './game/scenes/MenuScene';
import { CampaignScene } from './game/scenes/CampaignScene';
import { PreLevelScene } from './game/scenes/PreLevelScene';
import { GameScene } from './game/scenes/GameScene';
import { ResearchScene } from './game/scenes/ResearchScene';
import { EncyclopediaScene } from './game/scenes/EncyclopediaScene';
import { SettingsScene } from './game/scenes/SettingsScene';

// o áudio só pode começar após um toque do jogador
window.addEventListener('pointerdown', () => Sfx.unlock());
window.addEventListener('touchstart', () => Sfx.unlock(), { passive: true });

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'jogo',
  width: W,
  height: H,
  backgroundColor: '#15181b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, powerPreference: 'high-performance' },
  input: { activePointers: 2 },
  fps: { target: 60 },
  scene: [BootScene, MenuScene, CampaignScene, PreLevelScene, GameScene, ResearchScene, EncyclopediaScene, SettingsScene],
});

// pausa o áudio (e a partida) quando o app vai para segundo plano
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const gs = game.scene.getScene('Game') as GameScene | null;
    if (gs && game.scene.isActive('Game')) gs.openPause();
  }
  if (!Sfx.ctx) return;
  if (document.hidden) Sfx.ctx.suspend();
  else Sfx.ctx.resume();
});

// botão "voltar" do Android
App.addListener('backButton', () => {
  const active = game.scene.getScenes(true);
  const key = active[0]?.scene.key;
  if (key === 'Game') (active[0] as GameScene).onBack();
  else if (key === 'Menu' || !key) App.exitApp();
  else {
    active.forEach((s) => game.scene.stop(s.scene.key));
    game.scene.start(key === 'PreLevel' ? 'Campaign' : 'Menu');
  }
}).catch(() => {});

// acesso para testes automatizados
(window as any).__jogo = game;
(window as any).__dados = { ENEMY_BY_ID };
