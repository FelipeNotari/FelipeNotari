import Phaser from 'phaser';
import { Sfx } from './game/audio';
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

// pausa o áudio quando o app vai para segundo plano
document.addEventListener('visibilitychange', () => {
  if (!Sfx.ctx) return;
  if (document.hidden) Sfx.ctx.suspend();
  else Sfx.ctx.resume();
});

(window as any).__jogo = game;
