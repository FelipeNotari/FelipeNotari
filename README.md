# Lanchonete — controle de vendas e gastos

Aplicativo Android simples para anotar, dia a dia, **quanto você vendeu** e
**quanto gastou** na lanchonete, e ver o **lucro do mês**. Tudo funciona
**offline** — os dados ficam guardados no próprio celular.

## Funciona assim

- **Lançar**: escolha a data, digite o valor de vendas e o valor de gastos do
  dia, e toque em **Salvar**.
- **Resumo**: escolha o mês e veja os totais de **vendas**, **gastos** e o
  **lucro** (vendas − gastos), com a lista de todos os dias. Dá para editar ou
  apagar cada dia.
- **Backup**: exporte todos os dados para um arquivo (guarde no Google Drive,
  Downloads etc.) e importe depois — útil ao trocar de celular.

## Como baixar e instalar o APK

1. Acesse a página de **Releases** deste repositório e abra a release
   **"Lanchonete - último APK"**.
2. Baixe o arquivo `lanchonete.apk` **pelo próprio celular**.
3. Abra o arquivo baixado. Se o Android pedir, permita **"instalar de fontes
   desconhecidas"** para o navegador ou gerenciador de arquivos.
4. Confirme a instalação. O app aparece na tela inicial com o ícone do
   hambúrguer.

> É uma versão de teste assinada com a chave de depuração — instala e roda
> normalmente. Não é publicada na Play Store.

## Para desenvolvedores

- App nativo em **Kotlin + Jetpack Compose** (Material 3).
- Dados guardados em JSON no armazenamento interno do app (`EntryStore`).
- O APK é compilado automaticamente pelo **GitHub Actions**
  (`.github/workflows/build-apk.yml`) a cada push, e publicado como Release.

Build local (precisa do Android SDK):

```bash
./gradlew assembleDebug
# APK gerado em app/build/outputs/apk/debug/app-debug.apk
```
