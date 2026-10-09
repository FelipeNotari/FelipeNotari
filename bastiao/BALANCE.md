# Relatório de Balanceamento — Bastião de Aço

Gerado automaticamente por `npx tsx tools/balance.ts` (simulador headless, mesma lógica do jogo, passo fixo de 1/60 s).

## Resumo das condições

| Condição | Resultado |
|---|---|
| Bot estrategista vence as 20 fases (e em 5 sementes diferentes) | ✅ |
| Média de estrelas do estrategista a partir da fase 8 ≤ 2 | ❌ (2.12) |
| Bot aleatório perde > 90% a partir da fase 3 (20 partidas/fase) | ✅ |
| Renda total entre 1,15× e 1,30× da defesa vencedora de referência | ❌ |
| A partir da fase 3, nenhuma combinação de 1 ou 2 tipos de torre vence | ❌ |
| Melhores pontos do mapa começam bloqueados (≥ 50% das 10 melhores casas) | ✅ |

## Metodologia

- **Bot estrategista**: escolhe counters pela matriz de dano, avalia cada casa pela cobertura real de caminho
  (terrestre e aéreo) e pela vazão necessária para a próxima onda, faz upgrades quando rendem mais que torres novas,
  revela camuflados, limpa os obstáculos mais valiosos entre ondas e usa 3 habilidades. Usa a **árvore esperada**:
  4 pontos por fase anterior (vitória + 2 estrelas), distribuídos entre as torres liberadas.
- **Bot aleatório**: a cada segundo, constrói torres de tipo aleatório em casas livres aleatórias ou melhora uma torre aleatória;
  prioridades, obstáculos e habilidades também aleatórios.
- **Defesa vencedora de referência**: o menor gasto com que o estrategista ainda vence. Busca binária sobre a fração da renda
  que ele pode gastar (`cap`). Razão = renda total / custo de referência = 1 / cap.
- **Renda total** = dinheiro inicial + recompensas de todos os inimigos (inclusive os que saem de caminhões/chefes) +
  bônus de onda + recompensa de todos os obstáculos. Bônus opcionais (chamar onda cedo, Caixa de Suprimentos) ficam de fora.
- **Ajuste automático** (`tools/tune.ts`): para cada fase, busca o `hpMult` (multiplicador de vida dos inimigos) em que o
  estrategista vence gastando só 80% da renda (84% nas fases de chefe = pico de dificuldade).
- **Teste de combinação**: o estrategista é restrito a cada tipo isolado e a cada par de tipos liberados; todos devem perder.

## Resultado por fase

| Fase | hpMult | Renda total | Cap mínimo | Renda/ref. | Estrategista (vidas, ★) | 5 sementes (vitórias, ★ média) | Tipos usados | Aleatório (vitórias) | Melhor par (vidas) | Bloqueio top-10 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 Posto Avançado | 4.81 | 1189 | 0.784 | 1.27× ✅ | vitória (14, 2★) | 5/5, 2.2★ | 1 | 0/20 ✅ | — | 60% |
| 2 Dunas Vermelhas | 2.50 | 1837 | 0.794 | 1.26× ✅ | vitória (10, 2★) | 5/5, 2.0★ | 2 | 0/20 ✅ | — | 70% |
| 3 Oásis Seco | 1.14 | 2301 | 0.803 | 1.25× ✅ | vitória (20, 3★) | 5/5, 3.0★ | 3 | 1/20 ✅ | at+aa (VENCE, 20) | 90% |
| 4 Céu de Areia | 1.66 | 2749 | 0.784 | 1.27× ✅ | vitória (17, 2★) | 5/5, 2.0★ | 3 | 0/20 ✅ | at+aa (VENCE, 14) | 80% |
| 5 Toca do Escorpião | 1.58 | 3416 | 0.831 | 1.20× ✅ | vitória (17, 2★) | 5/5, 2.0★ | 3 | 0/20 ✅ | at+aa (VENCE, 13) | 90% |
| 6 Avenida Partida | 1.75 | 3811 | 0.803 | 1.25× ✅ | vitória (15, 2★) | 5/5, 2.0★ | 4 | 0/20 ✅ | at+aa (VENCE, 10) | 100% |
| 7 Distrito Fantasma | 0.99 | 4178 | 0.803 | 1.25× ✅ | vitória (14, 2★) | 5/5, 2.0★ | 6 | 0/20 ✅ | at+aa (VENCE, 12) | 100% |
| 8 Praça do Relógio | 0.89 | 4334 | 0.784 | 1.27× ✅ | vitória (9, 1★) | 5/5, 1.6★ | 5 | 0/20 ✅ | at+aa (VENCE, 20) | 100% |
| 9 Viaduto Caído | 1.31 | 5238 | 0.737 | 1.36× ❌ | vitória (4, 1★) | 5/5, 1.0★ | 7 | 0/20 ✅ | aa+sn (VENCE, 11) | 100% |
| 10 Coração da Cidade | 1.58 | 6057 | 0.850 | 1.18× ✅ | vitória (20, 3★) | 5/5, 2.0★ | 5 | 0/20 ✅ | at+aa (VENCE, 11) | 100% |
| 11 Passo Gelado | 1.18 | 6063 | 0.803 | 1.25× ✅ | vitória (18, 3★) | 5/5, 2.8★ | 5 | 0/20 ✅ | aa+mo (VENCE, 16) | 100% |
| 12 Floresta Branca | 1.21 | 6801 | 0.756 | 1.32× ❌ | vitória (20, 3★) | 5/5, 2.8★ | 7 | 0/20 ✅ | mg+sn (VENCE, 20) | 100% |
| 13 Lago Congelado | 1.00 | 6840 | 0.775 | 1.29× ✅ | vitória (10, 2★) | 5/5, 1.4★ | 5 | 0/20 ✅ | mg+sn (VENCE, 5) | 100% |
| 14 Estação Polar | 1.33 | 7941 | 0.653 | 1.53× ❌ | vitória (10, 2★) | 5/5, 1.2★ | 5 | 0/20 ✅ | mg+sn (VENCE, 20) | 100% |
| 15 Muralha de Gelo | 1.13 | 9084 | 0.831 | 1.20× ✅ | vitória (20, 3★) | 5/5, 3.0★ | 6 | 0/20 ✅ | aa+sn (VENCE, 20) | 100% |
| 16 Pátio de Cargas | 1.57 | 9429 | 0.794 | 1.26× ✅ | vitória (15, 2★) | 5/5, 2.0★ | 7 | 0/20 ✅ | mg+sn (VENCE, 1) | 100% |
| 17 Refinaria | 1.12 | 10798 | 0.841 | 1.19× ✅ | vitória (8, 1★) | 5/5, 3.0★ | 6 | 0/20 ✅ | mg+sn (VENCE, 16) | 100% |
| 18 Altos-Fornos | 1.75 | 10663 | 0.794 | 1.26× ✅ | vitória (15, 2★) | 5/5, 2.4★ | 8 | 0/20 ✅ | mg+sn (VENCE, 11) | 100% |
| 19 Usina Norte | 1.15 | 12010 | 0.803 | 1.25× ✅ | vitória (20, 3★) | 5/5, 2.4★ | 7 | 0/20 ✅ | mg+sn (VENCE, 20) | 100% |
| 20 Ninho do Ciclope | 1.93 | 12727 | 0.831 | 1.20× ✅ | vitória (15, 2★) | 5/5, 2.0★ | 7 | 0/20 ✅ | mg+at (perde, 0) | 100% |

Torres usadas pelo estrategista (orçamento cheio):

- Fase 1: Metralhadora ×5
- Fase 2: Metralhadora ×1, Canhão Antitanque ×3
- Fase 3: Metralhadora ×4, Canhão Antitanque ×2, Bateria Antiaérea ×2
- Fase 4: Morteiro ×2, Bateria Antiaérea ×4, Canhão Antitanque ×1
- Fase 5: Morteiro ×2, Bateria Antiaérea ×2, Sniper ×4
- Fase 6: Canhão Antitanque ×2, Bateria Antiaérea ×5, Lança-chamas ×1, Morteiro ×3
- Fase 7: Morteiro ×4, Bateria Antiaérea ×3, Radar de Suporte ×2, Lança-chamas ×2, Canhão Antitanque ×1, Metralhadora ×1
- Fase 8: Morteiro ×4, Bateria Antiaérea ×3, Canhão Antitanque ×1, Lança-chamas ×5, Metralhadora ×1
- Fase 9: Canhão Antitanque ×2, Bateria Antiaérea ×3, Sniper ×2, Lança-chamas ×4, Morteiro ×3, Radar de Suporte ×1, Metralhadora ×2
- Fase 10: Morteiro ×3, Bateria Antiaérea ×4, Radar de Suporte ×2, Canhão Antitanque ×5, Sniper ×3
- Fase 11: Morteiro ×6, Bateria Antiaérea ×6, Radar de Suporte ×2, Lança-chamas ×2, Sniper ×1
- Fase 12: Morteiro ×5, Bateria Antiaérea ×5, Sniper ×2, Canhão Antitanque ×3, Radar de Suporte ×3, Lança-chamas ×2, Metralhadora ×2
- Fase 13: Morteiro ×7, Bateria Antiaérea ×4, Canhão Antitanque ×4, Radar de Suporte ×3, Lança-chamas ×1
- Fase 14: Morteiro ×7, Bateria Antiaérea ×6, Radar de Suporte ×2, Lança-chamas ×4, Metralhadora ×3
- Fase 15: Laser ×3, Bateria Antiaérea ×4, Lança-chamas ×8, Sniper ×8, Morteiro ×4, Radar de Suporte ×3
- Fase 16: Morteiro ×8, Laser ×1, Radar de Suporte ×3, Bateria Antiaérea ×9, Sniper ×3, Lança-chamas ×3, Metralhadora ×1
- Fase 17: Morteiro ×8, Bateria Antiaérea ×6, Canhão Antitanque ×3, Radar de Suporte ×4, Lança-chamas ×8, Metralhadora ×5
- Fase 18: Morteiro ×10, Laser ×1, Bateria Antiaérea ×7, Radar de Suporte ×4, Sniper ×2, Canhão Antitanque ×1, Lança-chamas ×3, Metralhadora ×3
- Fase 19: Morteiro ×9, Bateria Antiaérea ×6, Canhão Antitanque ×1, Sniper ×3, Radar de Suporte ×5, Lança-chamas ×11, Metralhadora ×1
- Fase 20: Morteiro ×6, Canhão Antitanque ×1, Radar de Suporte ×3, Bateria Antiaérea ×16, Sniper ×1, Lança-chamas ×5, Metralhadora ×2

## DPS efetivo a cada 100 de custo (sem área nem cobertura)

Morteiro e Lança-chamas: já incluem o fator médio de área usado pelo bot; Laser: média do aquecimento.

| Torre | Nível | Custo acumulado | Infantaria | Blindagem leve | Blindagem pesada | Aéreo | Escudo de energia |
|---|---|---|---|---|---|---|---|
| Metralhadora | 1 | 100 | 60.0 | 20.0 | 10.0 | 20.0 | 20.0 |
| Metralhadora | 3 | 295 | 52.9 | 17.6 | 8.8 | 17.6 | 17.6 |
| Canhão Antitanque | 1 | 200 | 9.0 | 60.0 | 80.0 | — | 20.0 |
| Canhão Antitanque | 3 | 580 | 8.1 | 54.1 | 72.1 | — | 18.0 |
| Bateria Antiaérea | 1 | 160 | — | — | — | 63.0 | — |
| Bateria Antiaérea | 3 | 470 | — | — | — | 58.5 | — |
| Morteiro | 1 | 175 | 37.0 | 37.0 | 22.2 | — | 14.8 |
| Morteiro | 3 | 505 | 42.2 | 42.2 | 25.3 | — | 16.9 |
| Sniper | 1 | 150 | 5.2 | 22.5 | 30.0 | — | 7.5 |
| Sniper | 3 | 430 | 5.4 | 23.0 | 30.7 | — | 7.7 |
| Lança-chamas | 1 | 130 | 72.6 | 13.6 | — | — | 6.8 |
| Lança-chamas | 3 | 390 | 56.0 | 10.5 | — | — | 5.3 |
| Laser | 1 | 220 | 8.9 | 20.5 | 20.5 | 27.3 | 54.5 |
| Laser | 3 | 640 | 7.1 | 18.5 | 18.5 | 24.6 | 49.2 |

## Cobertura real de caminho nas 20 fases

| Torre | Alcance N1 | Cobertura média (casas de caminho) | DPS efetivo × cobertura / custo (melhor classe) |
|---|---|---|---|
| Metralhadora | 2.8 | 12.3 | 7.39 |
| Canhão Antitanque | 3.2 | 14.8 | 11.81 |
| Bateria Antiaérea | 4.5 | 11.0 | 6.92 |
| Morteiro | 5 | 26.0 | 9.62 |
| Sniper | 6 | 33.3 | 10.00 |
| Lança-chamas | 1.8 | 6.3 | 4.58 |
| Laser | 3.2 | 14.8 | 8.05 |

Nenhuma torre domina: cada uma tem pelo menos duas classes em que rende menos da metade da melhor opção
(ou não consegue atingir), e o teste de pares acima mostra que nenhuma dupla basta a partir da fase 3.
