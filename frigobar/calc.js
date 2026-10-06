'use strict';
/*
 * Regras de negócio do Frigobar (sem tela). Usado pelo app e pelos testes.
 *
 * Todos os valores em dinheiro são CENTAVOS inteiros. A única exceção é o
 * custo médio por unidade, que pode ter fração de centavo (ex.: 101,33) para
 * não perder precisão; o custo de cada venda é arredondado para centavos.
 *
 * Conceitos (nunca misturar):
 *  - faturamento esperado = Σ preço de venda × qtd dos produtos vendidos
 *  - entradas             = dinheiro recebido e lançado (só vendas do frigobar)
 *  - oferta (do dia)      = entradas − esperado, quando positivo
 *  - divergência (do dia) = entradas − esperado, quando negativo
 *  - faturamento total    = esperado + ofertas
 *  - CMV                  = Σ custo médio (da hora da venda) × qtd vendida
 *  - lucro operacional    = faturamento total − CMV   (a oferta não tem custo)
 *  - gastos com compras   = notas fiscais do período (NÃO entram no lucro)
 */
(function (raiz) {

  const VERSAO = 2;

  function vazio() {
    return { versao: VERSAO, produtos: [], vendas: [], entradas: [], notas: [], chavePix: '' };
  }

  /* ---------- Migração de dados antigos (nunca apaga informação) ---------- */
  function migrar(d) {
    const db = Object.assign(vazio(), JSON.parse(JSON.stringify(d || {})));
    const info = { migrou: false, de: db.versao || 1 };
    if (!d || d.versao >= VERSAO) return { db, info };
    info.migrou = true;

    db.produtos.forEach(p => {
      p.custo = Number(p.custo) || 0;   // custo informado no cadastro (base)
      p.qtdBase = Number(p.qtdBase) || 0;
      p.qtd = Number(p.qtd) || 0;
    });

    // Reposições antigas viram notas fiscais de compra (mesmo valor, mesma data).
    (d.gastos || []).forEach(g => {
      db.notas.push({
        id: g.id, data: g.data, hora: g.hora || '', mercado: 'Reposição',
        itens: [{ pid: g.pid, nome: g.nome, qtd: g.qtd, total: g.valor || 0 }],
        link: '', chave: '', obs: 'Lançada pelo botão Repor (versão anterior)', origem: 'reposicao'
      });
    });
    delete db.gastos;

    // Na versão anterior toda venda era "Registrar venda no Pix", ou seja,
    // o dinheiro já tinha entrado. Cria a entrada correspondente.
    db.vendas.forEach(v => {
      v.forma = v.forma || 'pix';
      v.itens.forEach(i => { i.custo = Number(i.custo) || 0; });
      v.total = totalVenda(v);
      db.entradas.push({ id: 'e' + v.id, data: v.data, hora: v.hora || '', valor: v.total, forma: 'pix', obs: 'Venda no Pix (versão anterior)', vendaId: v.id });
    });

    preencherCustosFaltando(db);
    db.versao = VERSAO;
    info.produtos = db.produtos.length;
    info.vendas = db.vendas.length;
    info.notas = db.notas.length;
    return { db, info };
  }

  /* ---------- Custo médio ponderado ---------- */
  // CUSTO MÉDIO = valor total gasto no produto ÷ quantidade total comprada.
  // Entram todas as notas (itens com valor) e o estoque inicial com custo informado.
  function lotes(db, pid) {
    const p = db.produtos.find(x => x.id === pid);
    const ls = [];
    if (p && p.qtdBase > 0 && p.custo > 0) ls.push({ qtd: p.qtdBase, total: p.qtdBase * p.custo });
    db.notas.forEach(n => n.itens.forEach(i => {
      if (i.pid === pid && i.qtd > 0 && i.total > 0) ls.push({ qtd: i.qtd, total: i.total });
    }));
    return ls;
  }
  function custoMedio(db, pid) {
    const ls = lotes(db, pid);
    const q = ls.reduce((s, l) => s + l.qtd, 0);
    if (q > 0) return ls.reduce((s, l) => s + l.total, 0) / q;
    const p = db.produtos.find(x => x.id === pid);
    return p ? (p.custo || 0) : 0;
  }

  // Vendas registradas sem custo conhecido recebem o custo médio atual
  // (ex.: a nota da compra foi lançada depois da venda).
  function preencherCustosFaltando(db) {
    let n = 0;
    db.vendas.forEach(v => v.itens.forEach(i => {
      if (!i.custo) {
        const c = custoMedio(db, i.pid);
        if (c > 0) { i.custo = c; n++; }
      }
    }));
    return n;
  }

  /* ---------- Vendas ---------- */
  const totalVenda = v => v.itens.reduce((s, i) => s + i.preco * i.qtd, 0);
  const cmvItem = i => Math.round((i.custo || 0) * i.qtd);
  const cmvVenda = v => v.itens.reduce((s, i) => s + cmvItem(i), 0);
  const totalNota = n => n.itens.reduce((s, i) => s + (i.total || 0), 0);

  /* ---------- Datas (ISO AAAA-MM-DD, horário local) ---------- */
  function iso(dt) {
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }
  function data(isoStr) { const [a, m, d] = isoStr.split('-').map(Number); return new Date(a, m - 1, d); }
  function somaDias(isoStr, n) { const d = data(isoStr); d.setDate(d.getDate() + n); return iso(d); }
  function inicioSemana(isoStr) { const d = data(isoStr); const dow = (d.getDay() + 6) % 7; return somaDias(isoStr, -dow); } // segunda
  function diasEntre(ini, fim) { const r = []; for (let d = ini; d <= fim; d = somaDias(d, 1)) r.push(d); return r; }

  /* ---------- Resumo financeiro de um período ---------- */
  function novoDia() {
    return { esperado: 0, entradas: 0, cmv: 0, itens: 0, vendas: 0, compras: 0, oferta: 0, divergencia: 0, semCusto: 0 };
  }
  function resumo(db, ini, fim) {
    const dias = {};
    const dia = d => (dias[d] = dias[d] || novoDia());
    const dentro = d => d >= ini && d <= fim;
    const porProduto = {};

    db.vendas.forEach(v => {
      if (!dentro(v.data)) return;
      const x = dia(v.data);
      x.vendas++;
      v.itens.forEach(i => {
        const fat = i.preco * i.qtd, cmv = cmvItem(i);
        x.esperado += fat; x.cmv += cmv; x.itens += i.qtd;
        if (!i.custo) x.semCusto += i.qtd;
        const k = i.pid || i.nome;
        const p = porProduto[k] = porProduto[k] || { pid: i.pid, nome: i.nome, qtd: 0, faturamento: 0, cmv: 0 };
        p.qtd += i.qtd; p.faturamento += fat; p.cmv += cmv;
      });
    });
    db.entradas.forEach(e => { if (dentro(e.data)) dia(e.data).entradas += e.valor; });
    db.notas.forEach(n => { if (dentro(n.data)) dia(n.data).compras += totalNota(n); });

    const tot = novoDia();
    Object.keys(dias).forEach(d => {
      const x = dias[d];
      const dif = x.entradas - x.esperado;
      x.oferta = dif > 0 ? dif : 0;
      x.divergencia = dif < 0 ? dif : 0;
      x.faturamentoTotal = x.esperado + x.oferta;
      x.lucro = x.faturamentoTotal - x.cmv;
      Object.keys(tot).forEach(k => { tot[k] += x[k]; });
    });
    // O total do período é a soma dos dias: a oferta da semana bate com a soma
    // das ofertas de cada dia, e entradas = esperado + ofertas + divergências.
    tot.faturamentoTotal = tot.esperado + tot.oferta;
    tot.lucro = tot.faturamentoTotal - tot.cmv;
    tot.lucroComDivergencia = tot.entradas - tot.cmv;
    Object.values(porProduto).forEach(p => {
      p.lucro = p.faturamento - p.cmv;
      p.margem = p.faturamento ? p.lucro / p.faturamento : 0;
    });
    return { ini, fim, dias, tot, porProduto };
  }

  /* ---------- Relatório de um produto (todo o histórico) ---------- */
  function relatorioProduto(db, pid) {
    const p = db.produtos.find(x => x.id === pid);
    let comprado = p ? p.qtdBase || 0 : 0, gasto = p && p.qtdBase && p.custo ? p.qtdBase * p.custo : 0;
    db.notas.forEach(n => n.itens.forEach(i => { if (i.pid === pid) { comprado += i.qtd; gasto += i.total || 0; } }));
    let vendido = 0, faturamento = 0, cmv = 0;
    db.vendas.forEach(v => v.itens.forEach(i => {
      if (i.pid === pid) { vendido += i.qtd; faturamento += i.preco * i.qtd; cmv += cmvItem(i); }
    }));
    const lucro = faturamento - cmv;
    return {
      comprado, gasto, vendido, faturamento, cmv, lucro,
      margem: faturamento ? lucro / faturamento : 0,
      estoque: p ? p.qtd : 0, preco: p ? p.preco : 0, custoMedio: custoMedio(db, pid)
    };
  }

  /* ---------- Estoque ---------- */
  function resumoEstoque(db) {
    let unidades = 0, valorCusto = 0, valorVenda = 0;
    db.produtos.forEach(p => {
      const q = Math.max(0, p.qtd);
      unidades += q;
      valorCusto += Math.round(q * custoMedio(db, p.id));
      valorVenda += q * p.preco;
    });
    return {
      unidades, valorCusto, valorVenda,
      semEstoque: db.produtos.filter(p => p.qtd <= 0),
      baixo: db.produtos.filter(p => p.qtd > 0 && p.qtd <= (p.minimo ?? 3))
    };
  }

  /* ---------- QR Code / link da NFC-e ---------- */
  // O QR Code da NFC-e é um link da Sefaz. A página da Sefaz não pode ser lida
  // de dentro do app (bloqueio do navegador/captcha), então aproveitamos o que
  // vem no próprio link: chave de acesso (CNPJ, número, mês/ano) e, nas notas
  // emitidas offline ou no formato antigo, também o dia e o valor total.
  function lerNfce(texto) {
    const t = String(texto || '').trim();
    if (!t) return null;
    const r = { link: /^https?:\/\//i.test(t) ? t : '', chave: '', data: '', valor: null, cnpj: '', numero: '' };
    let partes = null;
    const mP = t.match(/[?&]p=([^&#\s]+)/i);
    if (mP) partes = decodeURIComponent(mP[1]).split('|');
    const mCh = t.match(/chNFe=(\d{44})/i);
    const chave = (partes && /^\d{44}$/.test(partes[0]) && partes[0]) || (mCh && mCh[1]) || ((t.replace(/\D/g, '').match(/\d{44}/) || [])[0]) || '';
    if (!chave) return r.link ? r : null;
    r.chave = chave;
    r.cnpj = chave.slice(6, 20);
    r.numero = String(Number(chave.slice(25, 34)));
    const ano = 2000 + Number(chave.slice(2, 4)), mes = chave.slice(4, 6);
    // Formato offline (v2/v3): chave|versão|ambiente|dia|valor|...
    if (partes && partes.length >= 5 && /^\d{1,2}$/.test(partes[3]) && /^\d+(\.\d+)?$/.test(partes[4])) {
      r.data = `${ano}-${mes}-${String(partes[3]).padStart(2, '0')}`;
      r.valor = Math.round(Number(partes[4]) * 100);
    }
    // Formato antigo (v1): ...&dhEmi=<hex>&vNF=12.34
    const mDh = t.match(/dhEmi=([0-9a-f]+)/i);
    if (mDh) {
      let s = '';
      for (let i = 0; i + 1 < mDh[1].length; i += 2) s += String.fromCharCode(parseInt(mDh[1].slice(i, i + 2), 16));
      const md = s.match(/^(\d{4}-\d{2}-\d{2})/);
      if (md) r.data = md[1];
    }
    const mV = t.match(/vNF=(\d+(\.\d+)?)/i);
    if (mV) r.valor = Math.round(Number(mV[1]) * 100);
    if (!r.data) r.mesAno = `${ano}-${mes}`;
    return r;
  }

  const api = {
    VERSAO, vazio, migrar, custoMedio, lotes, preencherCustosFaltando,
    totalVenda, cmvItem, cmvVenda, totalNota,
    iso, data, somaDias, inicioSemana, diasEntre,
    resumo, relatorioProduto, resumoEstoque, lerNfce
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Calc = api;
})(this);
