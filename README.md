# Sinais da Banda

Site de comunicação em tempo real para a banda da igreja.
Durante o culto, com as mãos no instrumento, **1 toque = 1 sinal** aparece na tela de todo mundo.

Feito para rodar em **hospedagem compartilhada HostGator** (Apache + PHP).
Sem Node, sem banco de dados, sem biblioteca externa, sem CDN. É só subir os arquivos.

---

## 1. Passo a passo para colocar no ar (cPanel)

### 1.1 Abrir o Gerenciador de Arquivos

1. Entre no cPanel da HostGator.
2. Clique em **Gerenciador de Arquivos** (File Manager).
3. Entre na pasta **`public_html`**.
   - Se você quiser o site na raiz (`https://seusite.com.br`), fique em `public_html`.
   - Se preferir numa subpasta (`https://seusite.com.br/banda`), crie a pasta `banda` dentro de `public_html` e entre nela.

### 1.2 Enviar os arquivos

Envie **exatamente esta estrutura**:

```
public_html/
├── index.html
├── app.js
├── style.css
├── api/
│   ├── send.php
│   ├── stream.php
│   ├── poll.php
│   └── lib.php
└── data/
    └── .htaccess
```

Duas formas de enviar:

- **Pelo cPanel:** botão **Upload** → arraste os arquivos. Crie as pastas `api` e `data` com o botão **+ Pasta** e envie os arquivos de cada uma dentro dela.
- **Por FTP (FileZilla):** arraste as pastas `api` e `data` e os 3 arquivos da raiz direto para `public_html`.

> **Atenção:** o arquivo `data/.htaccess` começa com ponto e por isso fica escondido.
> No Gerenciador de Arquivos, clique em **Configurações** (canto superior direito) e marque
> **"Mostrar arquivos ocultos (dotfiles)"** antes de enviar, senão você não vai ver se ele subiu.
> No FileZilla: menu **Servidor → Forçar exibição de arquivos ocultos**.

### 1.3 Ajustar a permissão da pasta `data`

Essa é a única configuração obrigatória. É onde os sinais são gravados.

1. No Gerenciador de Arquivos, clique com o botão direito na pasta **`data`**.
2. Escolha **Alterar permissões** (Change Permissions).
3. Marque para dar **755**.
4. Marque a opção **"Aplicar recursivamente"** se aparecer.

Se ao usar o site aparecer a mensagem *"A pasta data/salas não existe ou não tem permissão de escrita"*,
repita o passo acima usando **777** em vez de 755.

A subpasta `data/salas/` é criada sozinha na primeira vez que alguém entra numa sala. Você não precisa criá-la.

### 1.4 Testar

Abra o endereço no celular, por exemplo `https://seusite.com.br`.
Se aparecer a tela **"Sinais da Banda"** com os campos de entrada, está funcionando.

---

## 2. Como usar

### Primeira vez (cada pessoa faz uma vez só)

Na tela de entrada preencha:

| Campo | O que é |
|---|---|
| **Nome da sala** | Um nome combinado com a equipe, ex.: `culto domingo`. Quem digitar o mesmo nome entra na mesma sala. |
| **Senha da sala** | Combinada com a equipe. **A sala é criada na primeira entrada** com a senha que a primeira pessoa digitar. Depois disso, quem errar a senha não entra. |
| **Seu nome** | Como você aparece para os outros. |
| **Seu instrumento** | Voz, Violão, Guitarra, Baixo, Bateria, Teclado, Percussão, Som/Mesa ou Outro. |

Tudo fica salvo no celular. **Nas próximas vezes o app entra direto**, sem redigitar nada.
Para trocar de sala ou de pessoa, use o botão pequeno **"Trocar"** no rodapé.

### Durante o culto

- **Em cima (35% da tela):** o último sinal recebido em letra grande, com quem mandou e há quanto tempo. Abaixo, os 5 anteriores. O celular vibra quando chega sinal novo. Sinal com mais de 20 segundos fica esmaecido.
- **Embaixo (65% da tela):** três abas. Trocar de aba é 1 toque, enviar é 1 toque. Nunca precisa confirmar.

| Aba | O que tem |
|---|---|
| **TOM** | As 12 notas (C até B) + "▲ Meio tom acima" e "▼ Meio tom abaixo". |
| **VOLUME** | Uma linha por fonte (Voz, Violão, Guitarra, Baixo, Bateria, Teclado e MEU RETORNO) com **−** e **+**. Tocar no **+** da Guitarra manda "Guitarra +". |
| **DINÂMICA** | Repetir, Ir pra ponte, Refrão, Último refrão, Final, CORTAR, Mais forte, Mais suave, Segurar acorde, Acelerar, Diminuir, Só voz. |

### A bolinha no canto superior direito

| Cor | Significa |
|---|---|
| 🟢 **verde — "ao vivo"** | Tempo real (SSE). É o normal. |
| 🟡 **amarelo — "lento"** | O tempo real falhou e o app passou sozinho para consulta a cada 0,4s. Continua funcionando. |
| 🔴 **vermelho — "sem sinal"** | Sem internet. O que você tocar fica guardado e é enviado quando a conexão voltar. |

A tela do celular **não apaga** enquanto o app está aberto.

---

## 3. Como funciona por dentro

- **Sem banco de dados.** Cada sala é um arquivo JSON em `data/salas/{hash}.json`.
  Toda escrita usa `flock(LOCK_EX)` e toda leitura usa `flock(LOCK_SH)`, então dois envios ao mesmo tempo não se atropelam.
- **Tempo real:** `api/stream.php` mantém uma conexão SSE aberta por no máximo 30 segundos,
  checando o arquivo da sala a cada 200 ms. Ao fim dos 30s o navegador reconecta sozinho.
- **Fallback:** se o SSE der erro 2 vezes seguidas, o app troca sozinho para `api/poll.php` a cada 400 ms.
- **Retenção:** cada sala guarda no máximo os **30 últimos sinais** e descarta o que tem **mais de 10 minutos**.
  Os arquivos ficam com poucos KB e não crescem com o tempo.
- **Segurança:** é básica de propósito (uso interno). A senha da sala é guardada como
  hash SHA-256 com salt aleatório por sala e a pasta `data/` é bloqueada pelo `.htaccess`.
  Não existe cadastro, e-mail nem recuperação de senha.

---

## 4. Se der problema

| Sintoma | O que fazer |
|---|---|
| *"A pasta data/salas não existe ou não tem permissão de escrita"* | Coloque a pasta `data` em **777** (item 1.3). |
| A bolinha fica sempre **amarela** | O servidor está com buffer no SSE. O app funciona normal assim; se quiser investigar, peça ao suporte da HostGator para não aplicar buffer/gzip em `api/stream.php`. |
| A bolinha fica **vermelha** para todo mundo | Confira se a pasta `api` subiu inteira (os 4 arquivos `.php`). |
| Diz **"Senha incorreta"** e ninguém lembra a senha | Apague o arquivo da sala em `data/salas/` pelo Gerenciador de Arquivos. A sala será recriada na próxima entrada com a nova senha. |
| Página em branco | Confira no cPanel se a versão do PHP é **7.4 ou superior** (Select PHP Version). |

> **Sobre o limite da hospedagem compartilhada:** cada pessoa conectada segura um processo PHP
> enquanto o SSE está aberto. Com a banda toda (até ~12 pessoas) funciona bem.
> Se um dia entrar muita gente ao mesmo tempo, os que sobrarem caem automaticamente
> para o modo amarelo (polling) e continuam recebendo os sinais.
