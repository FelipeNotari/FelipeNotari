'use strict';

/* ================= Dados ================= */
const CHAVE = 'frigobar.v1';
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const SUGESTOES = ['Água', 'Água com gás', 'Red Bull', 'Coca-Cola', 'Coca Zero', 'Guaraná', 'Cerveja', 'Gatorade', 'Suco', 'Chocolate'];

function vazio() { return { produtos: [], vendas: [], gastos: [], chavePix: '' }; }

let db = carregar();

function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE));
    if (d && Array.isArray(d.produtos)) return Object.assign(vazio(), d);
  } catch (e) {}
  return vazio();
}
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(db)); }
  catch (e) { toast('Não foi possível salvar.'); }
}

/* ================= Utilidades ================= */
const $ = s => document.querySelector(s);
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Valores em centavos para não ter erro de arredondamento.
function reais(c) {
  return (c < 0 ? '-' : '') + 'R$ ' + (Math.abs(c) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function lerValor(txt) {
  if (txt == null) return NaN;
  let s = String(txt).trim().replace(/[R$\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}
function lerInteiro(txt) {
  const n = parseInt(String(txt).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
function hojeISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function dataBonita(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  const sem = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][dt.getDay()];
  return `${sem}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
function horaAgora() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

const prodPorId = pid => db.produtos.find(p => p.id === pid);
const ordenados = () => db.produtos.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
const estoqueBaixo = p => p.qtd <= (p.minimo ?? 3);

/* ================= Navegação ================= */
const TITULOS = { vender: 'Vender', estoque: 'Estoque', resumo: 'Resumo', backup: 'Backup' };
function irPara(tela) {
  document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== 'tela-' + tela; });
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('ativo', b.dataset.tela === tela));
  $('#titulo-tela').textContent = TITULOS[tela];
  window.scrollTo(0, 0);
  render();
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => irPara(b.dataset.tela)));

function render() {
  renderVender();
  renderEstoque();
  renderResumo();
  $('#cfg-chave').value = db.chavePix || '';
}

/* ================= Vender ================= */
let carrinho = {}; // pid -> qtd

function renderVender() {
  const grid = $('#grid-prod');
  const prods = ordenados();
  $('#vender-vazio').hidden = prods.length > 0;
  grid.innerHTML = prods.map(p => {
    const q = carrinho[p.id] || 0;
    const resta = p.qtd - q;
    return `<button class="prod ${q ? 'sel' : ''} ${p.qtd <= 0 ? 'zerado' : ''}" data-add="${p.id}">
      ${q ? `<span class="prod-qtd">${q}</span>` : ''}
      <span class="prod-nome">${esc(p.nome)}</span>
      <span>
        <span class="prod-preco">${reais(p.preco)}</span><br>
        <span class="prod-est ${estoqueBaixo({ ...p, qtd: resta }) ? 'baixo' : ''}">${p.qtd <= 0 ? 'Sem estoque' : `Restam ${resta}`}</span>
      </span>
    </button>`;
  }).join('');

  const itens = Object.entries(carrinho).filter(([pid, q]) => q > 0 && prodPorId(pid));
  $('#carrinho').hidden = itens.length === 0;
  let total = 0;
  $('#carrinho-itens').innerHTML = itens.map(([pid, q]) => {
    const p = prodPorId(pid);
    total += p.preco * q;
    return `<div class="item-car">
      <span class="nome">${esc(p.nome)}</span>
      <span class="qtd-ctrl"><button data-menos="${pid}" aria-label="Menos">−</button><span>${q}</span><button data-add="${pid}" aria-label="Mais">+</button></span>
      <span class="sub">${reais(p.preco * q)}</span>
    </div>`;
  }).join('');
  $('#carrinho-total').textContent = reais(total);
  $('#btn-registrar').textContent = `Registrar venda no Pix · ${reais(total)}`;

  $('#chave-pix-box').hidden = !db.chavePix;
  $('#chave-pix-txt').textContent = db.chavePix || '';
}

document.addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  const menos = e.target.closest('[data-menos]');
  if (add) {
    const p = prodPorId(add.dataset.add);
    if (!p) return;
    const q = carrinho[p.id] || 0;
    if (q >= p.qtd) { toast(p.qtd <= 0 ? `${p.nome} está sem estoque.` : `Só tem ${p.qtd} de ${p.nome}.`); return; }
    carrinho[p.id] = q + 1;
    renderVender();
  } else if (menos) {
    const pid = menos.dataset.menos;
    carrinho[pid] = Math.max(0, (carrinho[pid] || 0) - 1);
    if (!carrinho[pid]) delete carrinho[pid];
    renderVender();
  }
});

$('#btn-limpar').addEventListener('click', () => { carrinho = {}; renderVender(); });

$('#btn-copiar-chave').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(db.chavePix); toast('Chave Pix copiada!'); }
  catch (e) { toast('Não deu para copiar.'); }
});

$('#btn-registrar').addEventListener('click', () => {
  const data = $('#venda-data').value || hojeISO();
  const itens = [];
  for (const [pid, q] of Object.entries(carrinho)) {
    const p = prodPorId(pid);
    if (!p || q <= 0) continue;
    if (q > p.qtd) { toast(`Só tem ${p.qtd} de ${p.nome}.`); return; }
    itens.push({ pid, nome: p.nome, preco: p.preco, custo: p.custo || 0, qtd: q });
  }
  if (!itens.length) return;
  itens.forEach(i => { prodPorId(i.pid).qtd -= i.qtd; });
  const total = itens.reduce((s, i) => s + i.preco * i.qtd, 0);
  db.vendas.push({ id: id(), data, hora: horaAgora(), forma: 'pix', itens, total });
  salvar();
  carrinho = {};
  render();
  toast(`Venda de ${reais(total)} no Pix registrada!`);
});

/* ================= Estoque ================= */
function renderEstoque() {
  const prods = ordenados();
  const unidades = prods.reduce((s, p) => s + p.qtd, 0);
  const valor = prods.reduce((s, p) => s + p.qtd * p.preco, 0);
  $('#est-unidades').textContent = unidades;
  $('#est-produtos').textContent = prods.length;
  $('#est-valor').textContent = reais(valor).replace(/,\d\d$/, '');

  const baixos = prods.filter(estoqueBaixo);
  $('#est-alerta').hidden = baixos.length === 0;
  $('#est-alerta').innerHTML = '⚠️ Repor: ' + baixos.map(p => `<b>${esc(p.nome)}</b> (${p.qtd})`).join(', ');

  $('#estoque-vazio').hidden = prods.length > 0;
  $('#lista-estoque').innerHTML = prods.map(p => `
    <div class="est-item">
      <div class="est-qtd ${estoqueBaixo(p) ? 'baixo' : ''}"><b>${p.qtd}</b><span>unid.</span></div>
      <div class="est-info">
        <div class="est-nome">${esc(p.nome)}</div>
        <div class="est-det">Venda ${reais(p.preco)}${p.custo ? ` · custo ${reais(p.custo)}` : ''}</div>
      </div>
      <div class="est-acoes">
        <button class="btn-mini" data-repor="${p.id}">+ Repor</button>
        <button class="btn-mini" data-editar="${p.id}">Editar</button>
      </div>
    </div>`).join('');
}

let editando = null;

function abrirModal(sel) { $(sel).hidden = false; }
function fecharModais() { document.querySelectorAll('.modal').forEach(m => { m.hidden = true; }); }
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
  if (e.target === m || e.target.closest('[data-fechar]')) fecharModais();
}));

function abrirProduto(p) {
  editando = p ? p.id : null;
  $('#modal-prod-titulo').textContent = p ? 'Editar produto' : 'Novo produto';
  $('#p-nome').value = p ? p.nome : '';
  $('#p-preco').value = p ? (p.preco / 100).toFixed(2).replace('.', ',') : '';
  $('#p-custo').value = p && p.custo ? (p.custo / 100).toFixed(2).replace('.', ',') : '';
  $('#p-qtd').value = p ? p.qtd : '';
  $('#p-min').value = p ? (p.minimo ?? 3) : '';
  $('#p-qtd-lbl').textContent = p ? 'Unidades em estoque (corrigir)' : 'Unidades em estoque';
  $('#btn-excluir-prod').hidden = !p;
  const usados = new Set(db.produtos.map(x => x.nome.toLowerCase()));
  $('#chips-sugestao').hidden = !!p;
  $('#chips-sugestao').innerHTML = SUGESTOES.filter(s => !usados.has(s.toLowerCase()))
    .map(s => `<button class="chip" data-sug="${esc(s)}">${esc(s)}</button>`).join('');
  abrirModal('#modal-prod');
}

$('#btn-novo-prod').addEventListener('click', () => abrirProduto(null));
$('#chips-sugestao').addEventListener('click', e => {
  const c = e.target.closest('[data-sug]');
  if (c) { $('#p-nome').value = c.dataset.sug; $('#p-preco').focus(); }
});
$('#lista-estoque').addEventListener('click', e => {
  const ed = e.target.closest('[data-editar]');
  const rp = e.target.closest('[data-repor]');
  if (ed) abrirProduto(prodPorId(ed.dataset.editar));
  if (rp) abrirRepor(prodPorId(rp.dataset.repor));
});

$('#btn-salvar-prod').addEventListener('click', () => {
  const nome = $('#p-nome').value.trim();
  const preco = lerValor($('#p-preco').value);
  const custoTxt = $('#p-custo').value.trim();
  const custo = custoTxt ? lerValor(custoTxt) : 0;
  const qtdTxt = $('#p-qtd').value.trim();
  const qtd = qtdTxt ? lerInteiro(qtdTxt) : 0;
  const minTxt = $('#p-min').value.trim();
  const minimo = minTxt ? lerInteiro(minTxt) : 3;
  if (!nome) return toast('Digite o nome do produto.');
  if (isNaN(preco) || preco <= 0) return toast('Digite um preço válido.');
  if (isNaN(custo)) return toast('Custo inválido.');
  if (isNaN(qtd)) return toast('Quantidade inválida.');
  if (isNaN(minimo)) return toast('Aviso de estoque inválido.');
  if (db.produtos.some(p => p.id !== editando && p.nome.toLowerCase() === nome.toLowerCase())) return toast('Já existe um produto com esse nome.');

  if (editando) {
    Object.assign(prodPorId(editando), { nome, preco, custo, qtd, minimo });
  } else {
    db.produtos.push({ id: id(), nome, preco, custo, qtd, minimo });
  }
  salvar(); fecharModais(); render();
  toast(editando ? 'Produto atualizado!' : 'Produto adicionado!');
});

$('#btn-excluir-prod').addEventListener('click', () => {
  const p = prodPorId(editando);
  if (!p || !confirm(`Excluir "${p.nome}" do estoque? As vendas antigas continuam no histórico.`)) return;
  db.produtos = db.produtos.filter(x => x.id !== p.id);
  delete carrinho[p.id];
  salvar(); fecharModais(); render();
  toast('Produto excluído.');
});

let repondo = null;
function abrirRepor(p) {
  repondo = p.id;
  $('#repor-titulo').textContent = 'Repor ' + p.nome;
  $('#repor-atual').textContent = `Hoje tem ${p.qtd} unidade${p.qtd === 1 ? '' : 's'}.`;
  $('#r-qtd').value = '';
  $('#r-valor').value = '';
  $('#r-data').value = hojeISO();
  abrirModal('#modal-repor');
  setTimeout(() => $('#r-qtd').focus(), 250);
}
$('#r-qtd').addEventListener('input', () => {
  // Sugere o gasto com base no custo por unidade cadastrado.
  const p = prodPorId(repondo);
  const q = lerInteiro($('#r-qtd').value);
  if (p && p.custo && !isNaN(q)) $('#r-valor').placeholder = (p.custo * q / 100).toFixed(2).replace('.', ',');
});
$('#btn-confirmar-repor').addEventListener('click', () => {
  const p = prodPorId(repondo);
  if (!p) return;
  const q = lerInteiro($('#r-qtd').value);
  const vTxt = $('#r-valor').value.trim();
  const valor = vTxt ? lerValor(vTxt) : (p.custo ? p.custo * q : 0);
  if (isNaN(q) || q <= 0) return toast('Digite quantas unidades chegaram.');
  if (isNaN(valor)) return toast('Valor inválido.');
  p.qtd += q;
  if (vTxt && valor > 0) p.custo = Math.round(valor / q);
  db.gastos.push({ id: id(), data: $('#r-data').value || hojeISO(), hora: horaAgora(), pid: p.id, nome: p.nome, qtd: q, valor });
  salvar(); fecharModais(); render();
  toast(`+${q} ${p.nome} no estoque.`);
});

/* ================= Resumo ================= */
let mesVisto = (() => { const d = new Date(); return { a: d.getFullYear(), m: d.getMonth() }; })();

$('#mes-ant').addEventListener('click', () => { mudarMes(-1); });
$('#mes-prox').addEventListener('click', () => { mudarMes(1); });
function mudarMes(n) {
  let m = mesVisto.m + n, a = mesVisto.a;
  if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
  mesVisto = { a, m };
  renderResumo();
}

let diaAberto = null;

function renderResumo() {
  const pref = `${mesVisto.a}-${String(mesVisto.m + 1).padStart(2, '0')}`;
  $('#mes-label').textContent = `${MESES[mesVisto.m]} ${mesVisto.a}`;
  const vendas = db.vendas.filter(v => v.data.startsWith(pref));
  const gastos = db.gastos.filter(g => g.data.startsWith(pref));
  const totV = vendas.reduce((s, v) => s + v.total, 0);
  const totG = gastos.reduce((s, g) => s + g.valor, 0);
  const lucro = totV - totG;
  const itens = vendas.reduce((s, v) => s + v.itens.reduce((a, i) => a + i.qtd, 0), 0);

  $('#res-vendas').textContent = reais(totV);
  $('#res-gastos').textContent = reais(totG);
  $('#res-lucro-lbl').textContent = lucro < 0 ? 'Prejuízo do mês' : 'Lucro do mês';
  $('#res-lucro').textContent = reais(lucro);
  $('#res-lucro').className = lucro < 0 ? 'neg' : 'pos';
  $('#res-itens').textContent = itens;

  const porProd = {};
  vendas.forEach(v => v.itens.forEach(i => {
    porProd[i.nome] = porProd[i.nome] || { q: 0, v: 0 };
    porProd[i.nome].q += i.qtd; porProd[i.nome].v += i.qtd * i.preco;
  }));
  const top = Object.entries(porProd).sort((a, b) => b[1].q - a[1].q).slice(0, 6);
  $('#res-top').innerHTML = top.length
    ? top.map(([n, x]) => `<div class="top-item"><span>${esc(n)} <span class="txt2">× ${x.q}</span></span><b>${reais(x.v)}</b></div>`).join('')
    : '<div class="txt2" style="margin:0">Nenhuma venda neste mês.</div>';

  const dias = {};
  vendas.forEach(v => { (dias[v.data] = dias[v.data] || { v: [], g: [] }).v.push(v); });
  gastos.forEach(g => { (dias[g.data] = dias[g.data] || { v: [], g: [] }).g.push(g); });
  const chaves = Object.keys(dias).sort().reverse();

  $('#res-dias').innerHTML = chaves.length ? chaves.map(d => {
    const x = dias[d];
    const tv = x.v.reduce((s, v) => s + v.total, 0);
    const tg = x.g.reduce((s, g) => s + g.valor, 0);
    const aberto = diaAberto === d;
    const movs = [
      ...x.v.map(v => ({ tipo: 'v', hora: v.hora || '', html: `<div class="mov"><div class="desc">${v.itens.map(i => `${i.qtd}× ${esc(i.nome)}`).join(', ')}<div class="hora">${v.hora || ''} · Pix</div></div><b>${reais(v.total)}</b><button class="x" data-apagar-venda="${v.id}">Excluir</button></div>` })),
      ...x.g.map(g => ({ tipo: 'g', hora: g.hora || '', html: `<div class="mov"><div class="desc">Reposição: ${g.qtd}× ${esc(g.nome)}<div class="hora">${g.hora || ''} · gasto</div></div><b class="neg">-${reais(g.valor)}</b><button class="x" data-apagar-gasto="${g.id}">Excluir</button></div>` }))
    ].sort((a, b) => b.hora.localeCompare(a.hora)).map(m => m.html).join('');
    return `<div class="dia">
      <button class="dia-topo" data-dia="${d}">
        <div><div class="dia-data">${dataBonita(d)}</div><div class="dia-sub">${x.v.length} venda${x.v.length === 1 ? '' : 's'}${tg ? ` · gastos ${reais(tg)}` : ''}</div></div>
        <div class="dia-val">${reais(tv)}<div class="dia-sub">${aberto ? '▲' : '▼'}</div></div>
      </button>
      ${aberto ? `<div class="dia-corpo">${movs}</div>` : ''}
    </div>`;
  }).join('') : '<div class="vazio">Nenhum lançamento neste mês.<br>Vá em <b>Vender</b> para registrar.</div>';
}

$('#res-dias').addEventListener('click', e => {
  const dia = e.target.closest('[data-dia]');
  const av = e.target.closest('[data-apagar-venda]');
  const ag = e.target.closest('[data-apagar-gasto]');
  if (av) {
    const v = db.vendas.find(x => x.id === av.dataset.apagarVenda);
    if (!v || !confirm(`Excluir venda de ${reais(v.total)}? Os itens voltam para o estoque.`)) return;
    v.itens.forEach(i => { const p = prodPorId(i.pid); if (p) p.qtd += i.qtd; });
    db.vendas = db.vendas.filter(x => x !== v);
    salvar(); render(); toast('Venda excluída e estoque devolvido.');
  } else if (ag) {
    const g = db.gastos.find(x => x.id === ag.dataset.apagarGasto);
    if (!g || !confirm(`Excluir reposição de ${g.qtd}× ${g.nome}? As unidades saem do estoque.`)) return;
    const p = prodPorId(g.pid); if (p) p.qtd = Math.max(0, p.qtd - g.qtd);
    db.gastos = db.gastos.filter(x => x !== g);
    salvar(); render(); toast('Reposição excluída.');
  } else if (dia) {
    diaAberto = diaAberto === dia.dataset.dia ? null : dia.dataset.dia;
    renderResumo();
  }
});

/* ================= Backup ================= */
$('#btn-salvar-chave').addEventListener('click', () => {
  db.chavePix = $('#cfg-chave').value.trim();
  salvar(); render();
  toast(db.chavePix ? 'Chave Pix salva!' : 'Chave Pix removida.');
});

$('#btn-exportar').addEventListener('click', async () => {
  const nome = `frigobar-backup-${hojeISO()}.json`;
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const arquivo = new File([blob], nome, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: 'Backup Frigobar' });
      return toast('Backup pronto!');
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Backup salvo!');
});

$('#btn-importar').addEventListener('click', () => $('#arq-importar').click());
$('#arq-importar').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!d || !Array.isArray(d.produtos) || !Array.isArray(d.vendas)) throw new Error();
    if (!confirm('Substituir os dados atuais pelos do backup?')) return;
    db = Object.assign(vazio(), d);
    salvar(); carrinho = {}; render();
    toast('Backup importado!');
  } catch (err) { toast('Arquivo inválido.'); }
});

$('#btn-apagar-tudo').addEventListener('click', () => {
  if (!confirm('Apagar TODOS os produtos, vendas e gastos?')) return;
  if (!confirm('Tem certeza? Não dá para desfazer.')) return;
  db = vazio(); salvar(); carrinho = {}; render();
  toast('Tudo apagado.');
});

/* ================= Início ================= */
$('#venda-data').value = hojeISO();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
