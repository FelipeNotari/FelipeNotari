# Bastião de Aço — Documento de Design

Tower Defense de guerra moderna para Android (paisagem, pt-BR).
Identidade própria: o jogador comanda o **Bastião**, uma linha de defesa contra a **Legião Cinza**.
Paleta: verde-oliva, areia, aço escuro, laranja de sinalização e amarelo de perigo; contorno grosso escuro (#1b1f22).

> Os números abaixo são o ponto de partida do design. Os valores finais (após o simulador ajustar
> as fases) estão nos arquivos de `src/data/` e o resultado das simulações em `BALANCE.md`.

## 1. Regras da partida

| Item | Regra |
|---|---|
| Mapa | Grade de 24 × 14 casas. Caminhos terrestres (1 casa de largura) e rotas aéreas (livres) |
| Vidas | 20. Cada inimigo que chega à base tira as vidas indicadas na tabela (chefe = 20) |
| Construção | Em qualquer casa livre fora do caminho. Alcance mostrado ao posicionar |
| Upgrade | 3 níveis por torre na partida |
| Venda | 70% de tudo que foi investido na torre |
| Prioridade | Primeiro, Último, Mais forte, Mais fraco |
| Obstáculos | Bloqueiam construção. Toque marca como alvo; torres no alcance atiram nele (deixando de atirar nos inimigos). Ao cair liberam a casa e dão dinheiro. Só obstáculos marcados recebem dano |
| Ondas | Contagem de 15 s entre ondas. Chamar antes = bônus de `(2 + 0,3 × onda) × segundos restantes` |
| Prévia | O HUD mostra os tipos (e quantidades) da próxima onda |
| Estrelas | 20 vidas (nenhuma perdida) = 3★; ≥ 10 = 2★; vitória com menos = 1★ |

## 2. Matriz de dano (`src/data/damage.json`)

| Dano \ Defesa | Infantaria | Blind. leve | Blind. pesada | Aéreo | Escudo de energia |
|---|---|---|---|---|---|
| **Balístico** | **1,5** | 0,5 | 0,25 | 0,25 | 0,5 |
| **Perfurante** | 0,25 | **1,5** | **2,0** | 1,0 | 0,5 |
| **Explosivo** (área) | 1,25 | 1,25 | 0,75 | não atinge | 0,5 |
| **Energia** | 0,5 | 0,5 | 0,5 | 0,5 | **2,0** |
| **Fogo** | **2,0** | 0,5 | nulo (0) | 0,5 | 0,25 |

Escudo de energia: enquanto um inimigo tem escudo (do Gerador ou do chefe), o dano usa a coluna
"Escudo de energia"; o que sobra passa para a vida com a classe original.

Leitura rápida dos papéis (por isso nenhuma torre resolve tudo):
infantaria → Metralhadora / Lança-chamas / Morteiro; blindados → Antitanque / Sniper (Morteiro para leves em grupo);
aéreos → Bateria Antiaérea; escudos → Laser.

## 3. Torres (`src/data/towers.json`)

Custo do nível 1 = construir; níveis 2 e 3 = custo do upgrade. Dano por tiro (Chamas e Laser: dano por segundo).

| Torre | Dano | Alvos | Desbloq. | Custo (N1/N2/N3) | Dano N1→N3 | Cadência | Alcance | Especial |
|---|---|---|---|---|---|---|---|---|
| Metralhadora | Balístico | terra+ar | fase 1 | 100 / 75 / 120 | 8 → 16 | 5 → 6,5/s | 2,8 → 3,1 | barata, rajada |
| Canhão Antitanque | Perfurante | terra | fase 2 | 200 / 150 / 230 | 160 → 380 | 0,5 → 0,55/s | 3,2 → 3,5 | projétil único |
| Bateria Antiaérea | Perfurante | só ar | fase 3 | 160 / 120 / 190 | 2×55 → 2×125 | 0,83 → 1 salva/s | 4,5 → 5,2 | teleguiado, fragmentação 0,5 |
| Morteiro | Explosivo | terra | fase 4 | 175 / 130 / 200 | 50 → 120 | 0,5 → 0,6/s | 5,0 → 5,5 | área 1,1→1,35; ponto cego 1,6; voo 1,1 s |
| Sniper | Perfurante | terra | fase 5 | 150 / 110 / 170 | 36 → 88 | 0,5 → 0,6/s | 5,5 → 6,2 | N3 revela camuflados |
| Lança-chamas | Fogo | terra | fase 6 | 130 / 100 / 160 | 18 → 42/s | contínuo | 1,8 → 2,1 | cone 50°→60°, queimadura 8→18/s por 3 s |
| Radar de Suporte | — | — | fase 7 | 150 / 120 / 180 | — | — | 3,5 → 4,5 | revela camuflados; −15→−30% vel. de veículos; +10→+20% alcance às vizinhas (raio 2); N3 +10% dano |
| Laser | Energia | terra+ar | fase 8 | 220 / 170 / 250 | 30 → 70/s | contínuo | 3,2 → 3,6 | dano sobe até ×2 (×2,5 no N3) em 2,5 s no mesmo alvo |

### Custo-benefício por classe

A tabela calculada (DPS efetivo a cada 100 de custo, nos níveis 1 e 3, e a cobertura real de caminho
nas 20 fases) é gerada pelo simulador em `BALANCE.md`. Regra usada: cada torre é a melhor (ou segunda melhor)
em no máximo duas classes e rende menos da metade da melhor opção (ou não atinge) em pelo menos duas.

## 4. Inimigos (`src/data/enemies.json`)

| Inimigo | Classe | Vida | Vel. (casas/s) | Recompensa | Vidas | Estreia | Mecânica |
|---|---|---|---|---|---|---|---|
| Soldado | Infantaria | 70 | 1,2 | 5 | 1 | 1 | — |
| Moto Rápida | Leve | 110 | 2,5 | 8 | 1 | 2 | muito rápida |
| Jipe | Leve | 320 | 1,7 | 16 | 2 | 2 | — |
| Soldado de Elite | Infantaria | 190 | 1,3 | 12 | 1 | 4 | — |
| Tropa c/ Escudo Balístico | Leve | 260 | 0,85 | 14 | 1 | 4 | infantaria que conta como blindagem leve |
| Tanque Leve | Pesada | 900 | 1,05 | 38 | 3 | 3 | — |
| Enxame de Drones | Aéreo | 45 | 1,9 | 3 | 1 | 3 | grupos grandes |
| Helicóptero | Aéreo | 800 | 1,25 | 40 | 3 | 3 | — |
| Caminhão Blindado | Leve | 750 | 0,95 | 30 | 2 | 5 | solta 4 soldados ao morrer |
| Veículo de Reparo | Leve | 550 | 1,0 | 28 | 2 | 6 | cura 3%/s da vida dos aliados (raio 2,2) |
| Unidade Camuflada | Infantaria | 200 | 1,45 | 18 | 1 | 7 | invisível até ser revelada |
| Gerador de Escudo | Escudo | 600 | 0,95 | 32 | 2 | 8 | dá escudo (25% da vida, máx. 300, recarrega 25/s) aos vizinhos |
| Tanque Pesado | Pesada | 2600 | 0,7 | 90 | 5 | 9 | — |
| Drone Kamikaze | Aéreo | 140 | 2,3 | 10 | 1 | 11 | mergulha e desliga torres por 5 s |
| **Escorpião do Deserto** | Pesada | 9000 | 0,55 | 300 | 20 | 5 | cortina de fumaça a cada 12 s: imune a mira 3,5 s |
| **Colosso Urbano** | Pesada→Leve | 16000 | 0,5 | 450 | 20 | 10 | com 50% solta a blindagem, acelera ×1,6, desembarca 6 elites |
| **Fortaleza Polar** | Pesada + Escudo | 22000 | 0,45 | 600 | 20 | 15 | escudo de 30% regenerando; quando cai, trava 2 s e fica 8 s exposta |
| **Ciclope** | Aéreo | 30000 | 0,4 | 800 | 20 | 20 | EMP a cada 10 s (desliga torres 3 s, raio 3); 6 drones a cada 14 s |

A vida é multiplicada pelo `hpMult` do JSON da fase e cresce 2,5% a cada onda dentro da fase.
A partir da fase 3 toda fase tem ~30% da vida em infantaria, ~40% em blindados e ~25% em aéreos
(e ~7% em escudos a partir da fase 8), para exigir pelo menos 3 tipos de torre.

## 5. Habilidades especiais (`src/data/abilities.json`) — 3 por partida

| Habilidade | Desbloq. | Recarga | Efeito |
|---|---|---|---|
| Ataque Aéreo | 1 | 75 s | 120 Explosivo, raio 1,8, após 1,2 s |
| Minas Terrestres | 1 | 50 s | 4 minas de 70 Explosivo (raio 0,9) na estrada |
| Caixa de Suprimentos | 1 | 120 s | +100 dinheiro, +2 vidas |
| Arame Farpado | 3 | 30 s | −50% velocidade terrestre (−30% veículos), raio 1,6, 15 s |
| Napalm | 6 | 70 s | 25 Fogo/s, raio 1,5, 6 s |
| Pulso EMP | 9 | 60 s | 60 Energia, atordoa veículos/aéreos 3 s, apaga escudos (raio 2,5) |
| Reforços | 12 | 75 s | esquadrão de 50 DPS Balístico, alcance 2,5, 20 s |

## 6. Árvore de pesquisa (`src/data/research.json`)

Cada torre tem 12 nós (8 árvores × 12 = 96 nós); cada habilidade tem 6 nós (7 × 6 = 42 nós).

```
Torre:                [n1]                 custo 1
                    /      \
                [n2]        [n3]           custo 1 / 1
                 |            |
                [n4]        [n5]           custo 2 / 2
                    \      /
                     [n6]                  custo 2 (exige n4 OU n5)
                    /    \
    RAMO A  [a1] ✕ [b1]  RAMO B            custo 2 — escolher A trava B (e vice-versa)
             |          |
           [a2]       [b2]                 custo 3
             |          |
           [a3]       [b3]                 custo 3

Habilidade:   [n1] → [n2] [n3] → [x] ✕ [y] → [n6]      custos 1,1,1,2,2,3
```

Cada nó dá um bônus pequeno (5–10%): dano, cadência, alcance, custo, área, queimadura, crítico,
lentidão, bônus contra uma classe etc. Ramos exclusivos forçam especialização
(ex.: Metralhadora "Supressão" anti-infantaria × "Antiaérea improvisada").

**Pontos de pesquisa:** primeira vitória da fase = 2 pontos; cada estrela nova = 1 ponto → máximo 5 por fase,
**100 no jogo inteiro**. Comprar um ramo completo de todas as árvores custa 136 (torres) + 56 (habilidades)
= **192 pontos** (270 contando os dois ramos). Não dá para ter tudo: é preciso escolher especialização.
Redistribuir pontos é grátis.

## 7. Economia

Renda da fase = dinheiro inicial + recompensas por abate + bônus de onda + obstáculos
(+ bônus opcional por chamar ondas cedo e Caixa de Suprimentos, não contados no cálculo).

- **Defesa vencedora de referência**: o menor gasto com que o bot estrategista ainda vence a fase
  (busca binária sobre a fração da renda que ele pode gastar).
- **Meta**: renda total entre **1,15× e 1,30×** desse custo. Ou seja, o jogador pode errar
  até ~13–23% do dinheiro e ainda vencer, mas não sobra para comprar tudo.
- Bônus de onda cresce com a fase; dinheiro inicial cobre 2–3 torres básicas.

## 8. Fases (`src/data/levels/fase-XX.json`)

20 fases, 4 biomas: Deserto (1–5), Cidade em ruínas (6–10), Neve (11–15), Complexo industrial (16–20).
Chefes nas fases 5, 10, 15 e 20. Fases posteriores com 2–3 caminhos, rotas aéreas e mais ondas.
Os melhores pontos de construção (maior cobertura de caminho) começam bloqueados por obstáculos.

Formato do JSON (adicionar a fase 21 = só criar `fase-21.json` com estes campos):

```json
{
  "id": 21, "name": "Nome", "biome": "deserto|cidade|neve|industrial",
  "map": { "x": 0.5, "y": 0.5 },
  "startMoney": 400, "lives": 20, "hpMult": 1.0, "waveGap": 15,
  "towers": ["mg","at"], "abilities": ["aereo","minas"],
  "paths": [ [[-1,3],[6,3],[6,10],[24,10]] ],
  "airPaths": [ [[-1,0],[24,10]] ],
  "obstacles": [ { "type": "pedra", "x": 5, "y": 4 } ],
  "waves": [ { "bonus": 40, "groups": [ { "enemy": "soldado", "count": 8, "interval": 1.0, "delay": 0, "path": 0 } ] } ]
}
```

## 9. Telas

Menu → Campanha (mapa com 20 fases) → Pré-fase (prévia de inimigos e escolha de 3 habilidades) →
Partida (HUD, painel de torres, habilidades) → Vitória/Derrota. Também: Pesquisa (abas TORRES e
HABILIDADES), Enciclopédia (torres, inimigos, matriz de dano), Configurações. Tutorial jogável na fase 1.

## 10. Arquitetura

- `src/core/` — simulação pura (sem Phaser): mesma lógica no jogo e no simulador headless.
  Passo fixo de 1/60 s, RNG com semente, pools de objetos (sem alocação por frame).
- `src/game/` — cenas Phaser, arte vetorial gerada por código (SVG), áudio WebAudio, save local.
- `tools/` — gerador de fases, simulador com bots (estrategista e aleatório) e ajustador automático.

## 11. Habilidades x torres

As habilidades são apoio para emergências (recargas de 30–120 s). Elas foram calibradas para não substituir
um tipo de torre: o teste de pares do simulador roda **com** as habilidades ligadas.
