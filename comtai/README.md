# Comtai — minhas finanças (iPhone)

App de finanças pessoais (PWA). Funciona offline; os dados ficam salvos só no aparelho.

## Instalar no iPhone
1. Abra no **Safari**: `https://felipenotari.github.io/FelipeNotari/comtai/`
2. **Compartilhar** → **Adicionar à Tela de Início** → **Adicionar**.
3. Use sempre pelo ícone da tela inicial (assim o iPhone mantém os dados salvos).

## O que tem
- **Início** — saldo do mês, entradas/saídas, saldo por conta, gastos por categoria, últimos lançamentos.
- **+** — lançar gasto ou ganho: valor, categoria, descrição, data, conta e “repetir todo mês”.
- **Extrato** — por mês, com busca e filtro por categoria; toque para editar, duplicar ou excluir.
- **Metas** — objetivos de economia e limite mensal de gasto por categoria.
- **Ajustes** — nome, moeda, cor, tema claro/escuro, categorias (nome, ícone, cor, limite), contas, lançamentos fixos, backup/restauração, exportar planilha (CSV) e apagar tudo.
- 👁 no topo esconde os valores.

## Dados
- `localStorage`, chave `comtai.v1`. Backup em arquivo `.json` (Ajustes → Salvar backup).
