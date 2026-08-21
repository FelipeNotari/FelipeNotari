# Lanchonete — controle de vendas e gastos

Aplicativo Android simples para anotar, dia a dia, **quanto você vendeu** e
**quanto gastou** na lanchonete, e ver o **lucro do mês**. Tudo funciona
**offline** — os dados ficam guardados no próprio celular.

## Funciona assim

- **Lançar**: escolha a data, escreva uma **descrição do dia** (opcional),
  informe as vendas separadas por **Pix**, **Dinheiro** e **Cartão**, o valor
  de **gastos** do dia, e toque em **Salvar**.
- **Resumo**: escolha o mês e veja os totais de **vendas**, o resumo **por tipo
  de venda** (Pix, Dinheiro e Cartão), os **gastos** e o **lucro** (vendas −
  gastos), com o histórico de todos os dias. Dá para editar ou apagar cada dia.
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

> É uma versão de teste assinada com uma chave própria do projeto — instala e
> roda normalmente. Não é publicada na Play Store.

### Atualizando sem perder os dados

A partir da versão **1.3** o app usa sempre a mesma chave de assinatura, então
basta baixar o novo `lanchonete.apk` e instalar **por cima** — os lançamentos
continuam salvos.

Se estiver vindo de uma versão **anterior à 1.3**, a assinatura mudou e o
Android pode recusar a instalação. Nesse caso:

1. Abra o app antigo → aba **Backup** → **Exportar backup** e salve o arquivo.
2. Desinstale o app antigo e instale o novo APK.
3. Abra o app → aba **Backup** → **Importar backup** e escolha o arquivo salvo.

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
