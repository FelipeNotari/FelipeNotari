# Relatório de Balanceamento — Bastião de Aço

Gerado automaticamente por `npx tsx tools/balance.ts` (simulador headless, mesma lógica do jogo, passo fixo de 1/60 s).

## Resumo das condições

| Condição | Resultado |
|---|---|
| Bot estrategista vence as 20 fases (e em 5 sementes diferentes) | ✅ |
| Média de estrelas do estrategista a partir da fase 8 ≤ 2 | ✅ (1.74) |
| Bot aleatório perde > 90% a partir da fase 3 (50 partidas/fase) | ✅ |
| Renda total entre 1,15× e 1,30× da defesa vencedora de referência | ✅ |
| A partir da fase 3, nenhuma combinação de 1 ou 2 tipos de torre vence | ✅ |
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
  gasto mínimo do estrategista atinge a meta da curva de dificuldade: 77,5% da renda na fase 1, +1,1 ponto por fase até 84%,
  com os chefes +1,2 ponto (pico). Também exige vitória com orçamento cheio em 5 sementes diferentes.
- **Teste de combinação**: o estrategista é restrito a cada tipo isolado e a cada par de tipos liberados; todos devem perder.

## Resultado por fase

| Fase | hpMult | Renda total | Cap mínimo | Renda/ref. | Estrategista (vidas, ★) | 5 sementes (vitórias, ★ média) | Tipos usados | Aleatório (vitórias) | Teste de pares | Bloqueio top-10 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 Posto Avançado | 4.54 | 1134 | 0.775 | 1.29× ✅ | vitória (17, 2★) | 5/5, 2.0★ | 1 | 0/50 ✅ | — | 60% |
| 2 Dunas Vermelhas | 2.84 | 1760 | 0.798 | 1.25× ✅ | vitória (7, 1★) | 5/5, 1.6★ | 2 | 0/50 ✅ | — | 70% |
| 3 Oásis Seco | 1.54 | 2269 | 0.798 | 1.25× ✅ | vitória (12, 2★) | 5/5, 2.0★ | 3 | 0/50 ✅ | todos os 3 pares e 3 isoladas perdem | 90% |
| 4 Céu de Areia | 1.37 | 2796 | 0.813 | 1.23× ✅ | vitória (18, 2★) | 5/5, 2.0★ | 3 | 0/50 ✅ | todos os 6 pares e 4 isoladas perdem | 80% |
| 5 Toca do Escorpião | 1.69 | 3345 | 0.822 | 1.22× ✅ | vitória (14, 2★) | 5/5, 2.8★ | 3 | 0/50 ✅ | todos os 10 pares e 5 isoladas perdem | 90% |
| 6 Avenida Partida | 1.76 | 3636 | 0.794 | 1.26× ✅ | vitória (14, 2★) | 5/5, 2.0★ | 4 | 0/50 ✅ | todos os 15 pares e 6 isoladas perdem | 100% |
| 7 Distrito Fantasma | 1.39 | 3992 | 0.845 | 1.18× ✅ | vitória (10, 2★) | 5/5, 1.0★ | 5 | 0/50 ✅ | todos os 21 pares e 7 isoladas perdem | 100% |
| 8 Praça do Relógio | 1.48 | 4035 | 0.831 | 1.20× ✅ | vitória (11, 2★) | 5/5, 1.6★ | 5 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 9 Viaduto Caído | 1.62 | 4771 | 0.827 | 1.21× ✅ | vitória (3, 1★) | 5/5, 1.8★ | 5 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 10 Coração da Cidade | 1.42 | 5718 | 0.808 | 1.24× ✅ | vitória (17, 2★) | 5/5, 2.0★ | 5 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 11 Passo Gelado | 2.55 | 5298 | 0.850 | 1.18× ✅ | vitória (12, 2★) | 5/5, 1.8★ | 5 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 12 Floresta Branca | 1.84 | 6006 | 0.822 | 1.22× ✅ | vitória (10, 2★) | 5/5, 1.0★ | 5 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 13 Lago Congelado | 1.17 | 6558 | 0.859 | 1.16× ✅ | vitória (20, 3★) | 5/5, 2.0★ | 5 | 1/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 14 Estação Polar | 1.67 | 7303 | 0.775 | 1.29× ✅ | vitória (15, 2★) | 5/5, 2.0★ | 4 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 15 Muralha de Gelo | 1.23 | 8653 | 0.841 | 1.19× ✅ | vitória (9, 1★) | 5/5, 1.4★ | 5 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 16 Pátio de Cargas | 2.00 | 8664 | 0.831 | 1.20× ✅ | vitória (1, 1★) | 5/5, 1.0★ | 4 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 17 Refinaria | 1.15 | 10383 | 0.850 | 1.18× ✅ | vitória (7, 1★) | 5/5, 1.2★ | 6 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 18 Altos-Fornos | 1.92 | 10406 | 0.845 | 1.18× ✅ | vitória (13, 2★) | 5/5, 2.0★ | 4 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 19 Usina Norte | 1.41 | 11850 | 0.845 | 1.18× ✅ | vitória (12, 2★) | 5/5, 1.8★ | 5 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |
| 20 Ninho do Ciclope | 1.93 | 12388 | 0.855 | 1.17× ✅ | vitória (20, 3★) | 5/5, 3.0★ | 4 | 0/50 ✅ | todos os 28 pares e 8 isoladas perdem | 100% |

Torres usadas pelo estrategista (orçamento cheio):

- Fase 1: Metralhadora ×4
- Fase 2: Metralhadora ×3, Canhão Antitanque ×1
- Fase 3: Metralhadora ×3, Bateria Antiaérea ×3, Canhão Antitanque ×2
- Fase 4: Morteiro ×3, Bateria Antiaérea ×2, Canhão Antitanque ×1
- Fase 5: Morteiro ×2, Bateria Antiaérea ×2, Canhão Antitanque ×5
- Fase 6: Morteiro ×2, Bateria Antiaérea ×3, Canhão Antitanque ×2, Metralhadora ×1
- Fase 7: Bateria Antiaérea ×3, Morteiro ×3, Canhão Antitanque ×3, Radar de Suporte ×2, Metralhadora ×1
- Fase 8: Morteiro ×3, Bateria Antiaérea ×4, Canhão Antitanque ×3, Radar de Suporte ×1, Metralhadora ×1
- Fase 9: Morteiro ×3, Bateria Antiaérea ×4, Canhão Antitanque ×3, Radar de Suporte ×2, Metralhadora ×3
- Fase 10: Morteiro ×3, Bateria Antiaérea ×4, Canhão Antitanque ×6, Radar de Suporte ×2, Sniper ×1
- Fase 11: Morteiro ×4, Bateria Antiaérea ×4, Canhão Antitanque ×3, Radar de Suporte ×3, Sniper ×1
- Fase 12: Morteiro ×4, Bateria Antiaérea ×5, Canhão Antitanque ×4, Radar de Suporte ×3, Metralhadora ×1
- Fase 13: Morteiro ×6, Bateria Antiaérea ×6, Canhão Antitanque ×3, Radar de Suporte ×3, Metralhadora ×1
- Fase 14: Morteiro ×8, Bateria Antiaérea ×7, Canhão Antitanque ×2, Radar de Suporte ×2
- Fase 15: Morteiro ×6, Bateria Antiaérea ×5, Canhão Antitanque ×7, Radar de Suporte ×2, Metralhadora ×1
- Fase 16: Morteiro ×8, Canhão Antitanque ×3, Bateria Antiaérea ×7, Radar de Suporte ×3
- Fase 17: Morteiro ×9, Bateria Antiaérea ×5, Canhão Antitanque ×5, Metralhadora ×3, Lança-chamas ×2, Radar de Suporte ×5
- Fase 18: Morteiro ×9, Canhão Antitanque ×4, Bateria Antiaérea ×7, Radar de Suporte ×3
- Fase 19: Morteiro ×10, Canhão Antitanque ×4, Bateria Antiaérea ×10, Radar de Suporte ×4, Lança-chamas ×1
- Fase 20: Morteiro ×10, Canhão Antitanque ×1, Bateria Antiaérea ×16, Radar de Suporte ×2

## DPS efetivo a cada 100 de custo (sem área nem cobertura)

Morteiro e Lança-chamas: já incluem o fator médio de área usado pelo bot; Laser: média do aquecimento.

| Torre | Nível | Custo acumulado | Infantaria | Blindagem leve | Blindagem pesada | Aéreo | Escudo de energia |
|---|---|---|---|---|---|---|---|
| Metralhadora | 1 | 100 | 60.0 | 20.0 | 10.0 | 10.0 | 20.0 |
| Metralhadora | 3 | 295 | 52.9 | 17.6 | 8.8 | 8.8 | 17.6 |
| Canhão Antitanque | 1 | 200 | 3.5 | 60.0 | 80.0 | — | 20.0 |
| Canhão Antitanque | 3 | 580 | 3.2 | 54.1 | 72.1 | — | 18.0 |
| Bateria Antiaérea | 1 | 160 | — | — | — | 63.0 | — |
| Bateria Antiaérea | 3 | 470 | — | — | — | 58.5 | — |
| Morteiro | 1 | 175 | 37.0 | 37.0 | 14.8 | — | 14.8 |
| Morteiro | 3 | 505 | 42.2 | 42.2 | 16.9 | — | 16.9 |
| Sniper | 1 | 150 | 1.9 | 16.0 | 21.3 | — | 5.3 |
| Sniper | 3 | 430 | 2.0 | 16.7 | 22.3 | — | 5.6 |
| Lança-chamas | 1 | 130 | 72.6 | 13.6 | — | — | 6.8 |
| Lança-chamas | 3 | 390 | 56.0 | 10.5 | — | — | 5.3 |
| Laser | 1 | 220 | 8.9 | 10.2 | 10.2 | 10.2 | 40.9 |
| Laser | 3 | 640 | 7.1 | 9.6 | 9.6 | 9.6 | 38.3 |

## Cobertura real de caminho nas 20 fases

| Torre | Alcance N1 | Cobertura média (casas de caminho) | DPS efetivo × cobertura / custo (melhor classe) |
|---|---|---|---|
| Metralhadora | 2.8 | 12.3 | 7.39 |
| Canhão Antitanque | 3.2 | 14.8 | 11.81 |
| Bateria Antiaérea | 4.5 | 11.0 | 6.92 |
| Morteiro | 5 | 26.0 | 9.62 |
| Sniper | 5.5 | 29.9 | 6.37 |
| Lança-chamas | 1.8 | 6.3 | 4.58 |
| Laser | 3.2 | 14.8 | 6.04 |

Nenhuma torre domina: cada uma tem pelo menos duas classes em que rende menos da metade da melhor opção
(ou não consegue atingir), e o teste de pares acima mostra que nenhuma dupla basta a partir da fase 3.
