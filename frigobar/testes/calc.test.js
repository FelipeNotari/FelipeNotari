// Verificação dos cálculos. Rodar: node frigobar/testes/calc.test.js
'use strict';
const assert = require('assert');
const C = require('../calc.js');

let ok = 0;
function teste(nome, fn) {
  try { fn(); ok++; console.log('✔ ' + nome); }
  catch (e) { console.log('✘ ' + nome + '\n   ' + e.message); process.exitCode = 1; }
}

// Monta um banco v2 com água (R$ 4,00) e refrigerante (R$ 7,00).
function base() {
  const db = C.vazio();
  db.produtos.push({ id: 'agua', nome: 'Água', preco: 400, custo: 0, qtdBase: 0, qtd: 0, minimo: 3 });
  db.produtos.push({ id: 'refri', nome: 'Refrigerante', preco: 700, custo: 0, qtdBase: 0, qtd: 0, minimo: 3 });
  db.produtos.push({ id: 'ener', nome: 'Energético', preco: 1600, custo: 0, qtdBase: 0, qtd: 0, minimo: 3 });
  return db;
}
function nota(db, dataIso, itens) {
  const n = { id: 'n' + db.notas.length, data: dataIso, mercado: 'Mercado', itens };
  db.notas.push(n);
  itens.forEach(i => { db.produtos.find(p => p.id === i.pid).qtd += i.qtd; });
}
// Igual ao botão "Registrar venda": usa o custo médio do momento.
function vender(db, dataIso, itens, recebido) {
  const v = { id: 'v' + db.vendas.length, data: dataIso, itens: itens.map(([pid, qtd]) => {
    const p = db.produtos.find(x => x.id === pid);
    p.qtd -= qtd;
    return { pid, nome: p.nome, preco: p.preco, custo: C.custoMedio(db, pid), qtd };
  }) };
  v.total = C.totalVenda(v);
  db.vendas.push(v);
  if (recebido != null) db.entradas.push({ id: 'e' + v.id, data: dataIso, valor: recebido, vendaId: v.id });
  return v;
}
const entrada = (db, dataIso, valor) => db.entradas.push({ id: 'x' + db.entradas.length, data: dataIso, valor });

teste('1. Venda sem oferta: 2 águas a R$ 4,00 com custo R$ 0,99', () => {
  const db = base();
  nota(db, '2026-10-05', [{ pid: 'agua', qtd: 10, total: 990 }]);
  vender(db, '2026-10-05', [['agua', 2]], 800);
  const t = C.resumo(db, '2026-10-05', '2026-10-05').tot;
  assert.strictEqual(t.esperado, 800);
  assert.strictEqual(t.cmv, 198);
  assert.strictEqual(t.oferta, 0);
  assert.strictEqual(t.lucro, 602);
  assert.strictEqual(db.produtos[0].qtd, 8, 'estoque baixou 2');
});

teste('2. Venda com oferta: água de R$ 4,00 paga com R$ 15,00 + refri', () => {
  const db = base();
  vender(db, '2026-10-05', [['agua', 1], ['refri', 1]], 1500);
  const t = C.resumo(db, '2026-10-05', '2026-10-05').tot;
  assert.strictEqual(t.esperado, 1100);
  assert.strictEqual(t.oferta, 400);
  assert.strictEqual(t.faturamentoTotal, 1500);
  assert.strictEqual(t.entradas, 1500);
});

teste('3. Semana com ofertas em vários dias (seg a dom)', () => {
  const db = base();
  const seg = '2026-10-05';
  const ofertas = [500, 1200, 0, 800, 1500, 2000, 0];
  ofertas.forEach((of, i) => {
    const d = C.somaDias(seg, i);
    const v = vender(db, d, [['agua', 3], ['refri', 2]]); // esperado R$ 26,00
    entrada(db, d, v.total + of);
  });
  const r = C.resumo(db, seg, C.somaDias(seg, 6));
  assert.strictEqual(C.inicioSemana('2026-10-08'), seg, 'semana começa na segunda');
  assert.deepStrictEqual(C.diasEntre(seg, C.somaDias(seg, 6)).map(d => r.dias[d].oferta), ofertas);
  assert.strictEqual(r.tot.oferta, 6000, 'ofertas da semana = R$ 60,00');
  assert.strictEqual(r.tot.esperado, 7 * 2600);
  assert.strictEqual(r.tot.entradas, 7 * 2600 + 6000);
  assert.strictEqual(r.tot.divergencia, 0);
});

teste('4. Entradas iguais ao esperado: oferta R$ 0,00', () => {
  const db = base();
  vender(db, '2026-10-05', [['ener', 3]], 4800);
  const t = C.resumo(db, '2026-10-05', '2026-10-05').tot;
  assert.strictEqual(t.oferta, 0);
  assert.strictEqual(t.divergencia, 0);
  assert.strictEqual(t.faturamentoTotal, t.entradas);
});

teste('5. Entradas menores: divergência −R$ 10,00 e oferta R$ 0,00 (nunca negativa)', () => {
  const db = base();
  vender(db, '2026-10-05', [['ener', 5], ['agua', 5]]); // 80 + 20 = R$ 100,00
  entrada(db, '2026-10-05', 9000);
  const t = C.resumo(db, '2026-10-05', '2026-10-05').tot;
  assert.strictEqual(t.esperado, 10000);
  assert.strictEqual(t.oferta, 0);
  assert.strictEqual(t.divergencia, -1000);
  // Uma divergência num dia não "come" a oferta de outro dia.
  vender(db, '2026-10-06', [['agua', 1]], 1000);
  const s = C.resumo(db, '2026-10-05', '2026-10-06').tot;
  assert.strictEqual(s.oferta, 600);
  assert.strictEqual(s.divergencia, -1000);
  assert.strictEqual(s.entradas, s.esperado + s.oferta + s.divergencia);
});

teste('6 e 7. Custo médio ponderado com notas de custos e quantidades diferentes', () => {
  const db = base();
  nota(db, '2026-09-10', [{ pid: 'agua', qtd: 10, total: 990 }]);
  assert.strictEqual(C.custoMedio(db, 'agua'), 99);
  nota(db, '2026-09-20', [{ pid: 'agua', qtd: 10, total: 1090 }]);
  assert.strictEqual(C.custoMedio(db, 'agua'), 104);
  nota(db, '2026-10-01', [{ pid: 'agua', qtd: 10, total: 950 }]);
  assert.strictEqual(C.custoMedio(db, 'agua'), 101); // 30,30 ÷ 30
  // Quantidades diferentes: 24 × 0,90 + 6 × 1,50 = 30,60 ÷ 30 = 1,02
  const db2 = base();
  nota(db2, '2026-10-01', [{ pid: 'agua', qtd: 24, total: 2160 }]);
  nota(db2, '2026-10-02', [{ pid: 'agua', qtd: 6, total: 900 }]);
  assert.strictEqual(C.custoMedio(db2, 'agua'), 102);
  // Média simples daria (0,90+1,50)/2 = 1,20 — errado.
  // A venda usa o custo médio do momento; uma nota nova muda só as próximas vendas.
  const v1 = vender(db2, '2026-10-03', [['agua', 1]], 400);
  nota(db2, '2026-10-04', [{ pid: 'agua', qtd: 10, total: 2000 }]);
  const v2 = vender(db2, '2026-10-05', [['agua', 1]], 400);
  assert.strictEqual(C.cmvVenda(v1), 102);
  assert.strictEqual(C.cmvVenda(v2), 127); // 50,60 ÷ 40 = 1,265 → R$ 1,27
});

teste('8. Oferta não desconta o custo duas vezes: água R$ 4,00, custo R$ 0,99, cliente paga R$ 10,00', () => {
  const db = base();
  nota(db, '2026-10-05', [{ pid: 'agua', qtd: 10, total: 990 }]);
  vender(db, '2026-10-05', [['agua', 1]], 1000);
  const t = C.resumo(db, '2026-10-05', '2026-10-05').tot;
  assert.strictEqual(t.esperado, 400);
  assert.strictEqual(t.oferta, 600);
  assert.strictEqual(t.entradas, 1000);
  assert.strictEqual(t.cmv, 99);
  assert.strictEqual(t.lucro, 901, 'lucro = 10,00 − 0,99');
  assert.notStrictEqual(t.lucro, 400 - 99 + 600 - 99);
});

teste('Compras do período não entram no lucro (só o custo do que saiu)', () => {
  const db = base();
  nota(db, '2026-10-05', [{ pid: 'agua', qtd: 100, total: 9900 }]);
  vender(db, '2026-10-05', [['agua', 2]], 800);
  const t = C.resumo(db, '2026-10-05', '2026-10-05').tot;
  assert.strictEqual(t.compras, 9900);
  assert.strictEqual(t.lucro, 602);
});

teste('Exemplo do item 13: esperado 500 + ofertas 50 − CMV 180 = lucro 370', () => {
  const db = base();
  db.produtos.push({ id: 'k', nome: 'Kit', preco: 50000, custo: 18000, qtdBase: 1, qtd: 1, minimo: 0 });
  vender(db, '2026-10-05', [['k', 1]], 55000);
  const t = C.resumo(db, '2026-10-05', '2026-10-05').tot;
  assert.deepStrictEqual([t.esperado, t.oferta, t.entradas, t.cmv, t.lucro], [50000, 5000, 55000, 18000, 37000]);
});

teste('Migração da versão anterior mantém tudo e não cria divergência falsa', () => {
  const v1 = {
    produtos: [{ id: 'a', nome: 'Água', preco: 300, custo: 0, qtd: 8, minimo: 3 }, { id: 'r', nome: 'Red Bull', preco: 1200, custo: 0, qtd: 7, minimo: 3 }],
    vendas: [{ id: 'v1', data: '2026-09-27', hora: '17:05', forma: 'pix', itens: [{ pid: 'a', nome: 'Água', preco: 300, custo: 0, qtd: 2 }, { pid: 'r', nome: 'Red Bull', preco: 1200, custo: 0, qtd: 1 }], total: 1800 }],
    gastos: [{ id: 'g1', data: '2026-09-27', hora: '17:06', pid: 'r', nome: 'Red Bull', qtd: 6, valor: 4000 }],
    chavePix: '11999999999'
  };
  const { db, info } = C.migrar(v1);
  assert.ok(info.migrou);
  assert.strictEqual(db.versao, 2);
  assert.strictEqual(db.chavePix, '11999999999');
  assert.deepStrictEqual(db.produtos.map(p => p.qtd), [8, 7], 'estoque intacto');
  assert.strictEqual(db.vendas.length, 1);
  assert.strictEqual(db.notas.length, 1);
  assert.strictEqual(C.totalNota(db.notas[0]), 4000);
  assert.strictEqual(db.entradas.length, 1);
  const t = C.resumo(db, '2026-09-01', '2026-09-30').tot;
  assert.strictEqual(t.esperado, 1800);
  assert.strictEqual(t.entradas, 1800);
  assert.strictEqual(t.oferta + t.divergencia, 0);
  assert.strictEqual(t.compras, 4000);
  assert.strictEqual(C.custoMedio(db, 'r'), 4000 / 6);
  assert.strictEqual(t.cmv, 667, 'venda antiga sem custo recebeu o custo médio do Red Bull');
  // Migrar de novo não duplica nada.
  const again = C.migrar(db);
  assert.ok(!again.info.migrou);
  assert.strictEqual(again.db.entradas.length, 1);
  assert.strictEqual(again.db.notas.length, 1);
  assert.deepStrictEqual(v1.gastos.length, 1, 'objeto original não foi alterado');
});

teste('QR Code da NFC-e: chave, CNPJ e (no formato offline) data e valor', () => {
  const chave = '41261012345678000190650010000123451123456789';
  const on = C.lerNfce(`https://www.fazenda.pr.gov.br/nfce/qrcode?p=${chave}|2|1|1|ABCDEF`);
  assert.strictEqual(on.chave, chave);
  assert.strictEqual(on.cnpj, '12345678000190');
  assert.strictEqual(on.numero, '12345');
  assert.strictEqual(on.mesAno, '2026-10');
  const off = C.lerNfce(`https://x.gov.br/qrcode?p=${chave}|2|1|05|37.80|6162|1|ABC`);
  assert.strictEqual(off.data, '2026-10-05');
  assert.strictEqual(off.valor, 3780);
  assert.strictEqual(C.lerNfce('chave ' + chave).chave, chave);
  assert.strictEqual(C.lerNfce('qualquer coisa'), null);
});

console.log(`\n${ok} testes passaram${process.exitCode ? ', com falhas' : ''}.`);
