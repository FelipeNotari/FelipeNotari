# Bastião de Aço

Tower Defense de guerra moderna para Android (paisagem, em português).
Feito com TypeScript + Phaser 3 + Vite, empacotado com Capacitor.

- `DESIGN.md` — regras, torres, inimigos, matriz de dano, árvore de pesquisa e economia.
- `BALANCE.md` — relatório do simulador de balanceamento (gerado automaticamente).
- `DECISOES.md` — decisões tomadas durante o desenvolvimento.

## Como o APK é gerado

A cada push que mexe na pasta `bastiao/`, o GitHub Actions (`.github/workflows/apk-bastiao.yml`):
1. instala as dependências e verifica os dados (`npm test`);
2. gera o build web (`npm run build`);
3. sincroniza o Capacitor e compila o APK assinado com a chave fixa (`keystore/bastiao.jks`);
4. publica uma Release com o arquivo `Bastiao-de-Aco.apk`.

Link sempre atualizado: `https://github.com/FelipeNotari/FelipeNotari/releases/latest/download/Bastiao-de-Aco.apk`

## Pastas

| Pasta | Conteúdo |
|---|---|
| `src/core/` | Regras do jogo (simulação pura, sem gráficos). Usada pelo jogo **e** pelo simulador. |
| `src/game/` | Telas (Phaser), arte vetorial gerada por código, sons sintetizados, save. |
| `src/data/` | Dados: matriz de dano, torres, inimigos, habilidades, pesquisa e **uma fase por arquivo JSON**. |
| `tools/` | Gerador de fases, simulador com bots, ajustador automático e verificador de dados. |
| `android/` | Projeto Android gerado pelo Capacitor (com assinatura e tela cheia). |

## Criar a fase 21

Basta criar `src/data/levels/fase-21.json` no mesmo formato das outras (veja `DESIGN.md`, seção 8).
O jogo lê todos os arquivos da pasta automaticamente; o mapa da campanha usa o campo `map` (x, y entre 0 e 1).
O `npm test` (que roda no GitHub Actions) avisa se faltar algo no arquivo.

## Comandos (para desenvolvedores)

```bash
npm install
npm run dev                         # jogo no navegador
npm test                            # verifica os dados das fases
npx tsx tools/sim.ts --random 50    # simula as 20 fases (estrategista + aleatório)
npx tsx tools/tune.ts               # ajusta a dificuldade de cada fase e regrava os JSON
npx tsx tools/balance.ts            # verificação completa + BALANCE.md
```
