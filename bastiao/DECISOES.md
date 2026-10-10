# Decisões tomadas (sem perguntar, escolhendo o mais simples para você)

1. **Nome e identidade**: o jogo se chama **Bastião de Aço** (o jogador defende o "Bastião" contra a "Legião Cinza").
   Paleta verde-oliva, areia, aço e laranja de sinalização. Toda a arte é desenhada por código (SVG); nenhum asset externo.
2. **Prints de referência**: os 2 prints mencionados no pedido **não chegaram** nesta sessão (só o texto).
   Usei como referência apenas a descrição (tela de partida + árvore de pesquisa com abas TORRES e HABILIDADES).
3. **Onde fica o jogo**: na pasta `bastiao/` do repositório, para não mexer nos apps que já existiam (Hangar e Frigobar).
4. **Branch**: o trabalho foi enviado para a branch `ccr-7024fa04-x7awj3` (a branch desta sessão).
   O workflow roda em **qualquer branch** (inclusive a `main`) sempre que algo dentro de `bastiao/` muda,
   e também pode ser disparado à mão. Pushes que não mexem no jogo (ex.: no Frigobar) não geram APK novo.
5. **Assinatura do APK**: a chave fixa fica em `bastiao/keystore/bastiao.jks` (senha `bastiao2026`), dentro do repositório.
   É o jeito mais simples: não exige configurar "secrets" no GitHub. Toda versão é assinada com a mesma chave,
   então o Android aceita instalar por cima sem desinstalar e sem perder o save.
   Risco aceito: como o repositório é público, outra pessoa poderia assinar um APK com a mesma chave. Para um jogo
   pessoal fora da Play Store isso não é problema. Se um dia for para a loja, troque por uma chave em segredo do GitHub.
6. **Versão**: cada build usa o número da execução do GitHub Actions (`versionCode = 100 + número`), sempre crescente,
   o que permite atualizar por cima. A Release recebe o nome `bastiao-v1.0.N`.
7. **Tecnologia**: TypeScript + Phaser 3.90 + Vite 6 + Capacitor 7 (Android, Java 21 no GitHub Actions).
   Resolução lógica 1920×1080, escala "caber na tela" (faixas laterais escuras em telas mais largas que 16:9).
8. **Simulação separada da tela**: toda a regra do jogo está em `src/core/` (sem Phaser), com passo fixo de 1/60 s.
   O simulador de balanceamento usa exatamente o mesmo código do jogo.
9. **Matriz de dano**: valores entre 0,25× e 2×. As duas únicas células 0 são as pedidas: "Explosivo não atinge aéreo"
   e "Fogo nulo contra blindagem pesada". Para garantir que nenhuma torre seja boa contra tudo, Balístico também é fraco
   contra aéreos (0,5×), Perfurante é 0,25× contra infantaria e Energia só é boa contra escudos.
10. **Sniper só atira em alvos terrestres** (o antiaéreo é o especialista em ar). Morteiro, Antitanque e Lança-chamas também
    são só terrestres.
11. **Ordem de liberação das torres**: Metralhadora (1), Antitanque (2), Antiaérea (3), Morteiro (4), Sniper (5),
    Lança-chamas (6), Radar (7), Laser (8). A antiaérea vem na fase 3 junto com os primeiros aéreos, para que a fase 3 já
    exija 3 tipos de torre.
12. **Obstáculos**: só recebem dano quando marcados pelo jogador (um por vez). Torres no alcance atiram neles em vez dos
    inimigos — essa é a decisão "gastar tiros agora ou defender". Barris explodem e ferem inimigos próximos.
13. **Primeira onda**: começa sozinha após 30 s (ou quando o jogador chamar). Evita limpar o mapa de graça antes de começar.
14. **Estrelas**: 3★ com 18+ vidas, 2★ com 10+ vidas, 1★ com menos. Pontos: vitória vale 2, cada estrela 1
    (máximo 100 no jogo). Um ramo completo de todas as árvores custa 192 pontos: é preciso escolher especialização.
15. **"Defesa vencedora de referência"**: definida como o menor gasto com que o bot estrategista ainda vence a fase
    (busca binária). Detalhes e resultados em `BALANCE.md`.
16. **Dificuldade por fase**: cada fase tem um multiplicador de vida dos inimigos (`hpMult`) calculado pelo ajustador
    automático para que a fase exija uma fração crescente da renda (fase 1 mais folgada, fase 20 mais apertada, picos nos chefes).
17. **Save**: `localStorage` do próprio app (persiste ao fechar e ao atualizar o APK, pois a assinatura é a mesma).
18. **Áudio**: tudo sintetizado com WebAudio (tiros, explosões, música marcial simples). Botão de mudo no menu e opções em
    Configurações e na pausa.
19. **Tela cheia e paisagem**: o app trava em paisagem e esconde as barras do Android (modo imersivo).
20. **Ícone e tela de abertura**: gerados a partir da arte do jogo (torre antitanque sobre faixa de perigo).
