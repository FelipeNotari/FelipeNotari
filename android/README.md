# Escala do Apoio — app Android

A escala da equipe de apoio da Igreja Meta, agora como aplicativo de celular.
É a mesma tela de sempre — mesmo visual, mesmas funções — empacotada num APK
que guarda tudo **no próprio aparelho**.

## Baixar o app

Link fixo, sempre com a versão mais nova:

**https://github.com/FelipeNotari/FelipeNotari/releases/latest/download/escala-do-apoio.apk**

### Como instalar
1. Abra o link acima **pelo celular** e baixe o arquivo.
2. Toque no arquivo baixado.
3. Se o Android perguntar, autorize "instalar apps desconhecidos" para o
   navegador (ou para o gerenciador de arquivos) e confirme.

Funciona no Android 6.0 ou mais novo.

## Como os dados são guardados

A escala fica salva no armazenamento privado do app (SharedPreferences), pelo
mesmo `window.storage` que a página já usava — só que agora ligado ao Android
por uma ponte nativa (`assets/bridge.js` + `PonteArmazenamento.java`).

Na prática:

- funciona **sem internet** — o app nem pede permissão de rede;
- nada é enviado para fora do celular, não tem conta nem servidor;
- cada edição é gravada em disco na hora, então nada se perde ao fechar o app;
- só desinstalar o app apaga a escala.

As fontes (Archivo, Inter e JetBrains Mono) vão dentro do APK, então o layout
fica igual ao original mesmo offline.

## Estrutura

```
android/
  app/src/main/assets/       a página: index.html, bridge.js, fonts.css, fonts/
  app/src/main/java/...      MainActivity (WebView) e PonteArmazenamento (dados)
  app/src/main/res/          ícone, cores e tema
  testes/testar.js           testes automatizados da tela
  escala-apoio.jks           chave que assina o APK (ver keystore.properties)
```

## Gerar o APK

O APK é gerado automaticamente pelo GitHub Actions
(`.github/workflows/apk.yml`) a cada push nesta pasta, e publicado como
release para download.

Para gerar na sua máquina (precisa do Android SDK instalado):

```bash
cd android
./gradlew assembleRelease
# sai em app/build/outputs/apk/release/app-release.apk
```

## Testes

Rodam a página no mesmo motor do WebView (Chromium), com um mock da ponte
nativa igual à implementação Java — cobrem escalar pelo painel, arrastar e
soltar, datas, pessoas, funções, equilíbrio, cópia para o WhatsApp e a
persistência entre aberturas do app.

```bash
npm install playwright && npx playwright install chromium
node android/testes/testar.js
```

## Sobre a chave de assinatura

`escala-apoio.jks` fica no repositório de propósito: assim toda build sai
assinada com a **mesma** chave e as atualizações instalam por cima da versão
anterior, sem desinstalar e sem perder a escala. Como o repositório é público,
essa chave não serve para publicar na Play Store — nesse caso, gere uma chave
nova e mantenha privada.
