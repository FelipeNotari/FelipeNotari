# Hangar — controle de vendas

App de celular para controlar as vendas, os custos e o estoque das bebidas da
geladeira do hangar. Funciona **100% offline** e os dados ficam salvos **só no
aparelho** (nada vai para a internet, nenhum cadastro, nenhuma conta).

## Como instalar no iPhone

1. Abra o link do app no **Safari** (precisa ser o Safari).
2. Toque no botão **Compartilhar** (quadradinho com a seta pra cima).
3. Escolha **Adicionar à Tela de Início**.
4. Toque em **Adicionar**.

Pronto: o ícone do rotor aparece na tela do iPhone e abre em tela cheia, igual a
um app normal. Depois disso funciona sem internet.

> No Android é o mesmo caminho pelo Chrome: menu ⋮ → **Instalar aplicativo**.

## O que o app faz

- **Início** — vendas do dia, lucro, itens vendidos, custos do dia, totais do
  mês, valor parado em estoque e aviso de estoque baixo.
- **Vender** — toque no produto para somar ao carrinho, toque no `−` para tirar.
  Ao confirmar, a venda é registrada e o estoque baixa sozinho.
- **Produtos** — adicionar, editar e excluir produtos, com custo, preço de venda
  e quantidade em estoque (por unidade).
- **Registrar compra** — quando ele compra bebida, lança a quantidade e o custo
  por unidade: entra no estoque e vira custo daquele dia.
- **Agenda** — calendário do mês com os dias marcados; o total de vendas,
  custos e lucro do mês; e, tocando no dia, o detalhe de tudo que entrou e saiu
  (dá para excluir um lançamento errado, que o estoque volta).
- **Ajustes** — exportar backup em arquivo, importar backup e apagar tudo.

## Detalhes técnicos

- PWA em HTML, CSS e JavaScript puro, sem dependências e sem build.
- Dados em `localStorage` (chave `hangar.v1`).
- `sw.js` faz o cache para funcionar offline.
- Publicado pelo GitHub Pages através de `.github/workflows/pages.yml`.

### Rodar localmente

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```
