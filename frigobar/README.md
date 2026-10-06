# Frigobar — vendas, estoque, compras e resultado

App para iPhone (PWA). Funciona offline; os dados ficam salvos só no aparelho.

## Instalar no iPhone
1. Abra no **Safari**: `https://felipenotari.github.io/FelipeNotari/frigobar/`
2. **Compartilhar** → **Adicionar à Tela de Início** → **Adicionar**.

## Telas
- **Início** — por dia, semana, mês ou período: lucro líquido operacional, faturamento esperado, entradas, ofertas, faturamento total, custo dos vendidos, gastos com compras, divergência e ofertas dia a dia.
- **Vender** — toca nos produtos, confere o total e registra (só Pix). Pode lançar o valor recebido junto: se for maior, a diferença vira oferta.
- **Entradas** — dinheiro recebido (manual). A oferta é calculada sozinha.
- **Estoque** — quantidade, custo médio, margem, valor pelo custo e pela venda, estoque baixo/zerado, relatório por produto.
- **Notas** — notas fiscais por ano e mês, com QR Code/link, produtos, anexo (foto/PDF), gasto por produto e custo médio.
- **Mais** — Conferência financeira, Relatórios por produto, Configurações e backup.

## Regras de cálculo (`calc.js`)
- Faturamento esperado = Σ preço × quantidade vendida.
- Oferta do dia = entradas − esperado (se positivo); divergência = se negativo. Período = soma dos dias.
- Faturamento total = esperado + ofertas.
- CMV = custo médio (no momento da venda) × quantidade.
- Lucro líquido operacional = faturamento total − CMV (a oferta não tem custo).
- Custo médio = total gasto no produto ÷ quantidade comprada (todas as notas + estoque inicial com custo).
- Compras (notas) não são descontadas do lucro; só o custo do que foi vendido.

Testes: `node frigobar/testes/calc.test.js`

## Dados
- `localStorage` chave `frigobar.v1` (`versao: 2`). Dados da versão 1 são migrados sozinhos; a cópia original fica em `frigobar.v1.copia-antes-v2`.
- Arquivos das notas ficam no IndexedDB `frigobar-arquivos` e vão junto no backup.
- `vendor/jsQR.js`: leitor de QR Code (Apache 2.0).
