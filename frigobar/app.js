'use strict';

/* ================= Dados ================= */
// A chave continua a mesma da primeira versão: os dados de quem já usa o app
// são lidos daqui e migrados automaticamente (veja carregar()).
const CHAVE = 'frigobar.v1';
const CHAVE_COPIA = 'frigobar.v1.copia-antes-v2';   // cópia intacta dos dados antigos
const CHAVE_AVISO = 'frigobar.aviso-v2';
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const SUGESTOES = ['Água', 'Água com gás', 'Red Bull', 'Coca-Cola', 'Coca Zero', 'Guaraná', 'Cerveja', 'Gatorade', 'Suco', 'Chocolate'];
const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', outro: 'Outro' };

const vazio = () => Calc.vazio();

let somenteLeitura = false;   // true se os dados salvos não puderam ser lidos: nunca sobrescreve
let infoMigracao = null;
let db = carregar();

function carregar() {
  let raw = null;
  try { raw = localStorage.getItem(CHAVE); } catch (e) {}
  if (!raw) return vazio();
  try {
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.produtos)) throw new Error('formato');
    if (!d.versao || d.versao < Calc.VERSAO) {
      // Guarda os dados antigos exatamente como estavam antes de migrar.
      try { if (!localStorage.getItem(CHAVE_COPIA)) localStorage.setItem(CHAVE_COPIA, raw); } catch (e) {}
      const r = Calc.migrar(d);
      localStorage.setItem(CHAVE, JSON.stringify(r.db));
      infoMigracao = r.info;
      return r.db;
    }
    return Calc.migrar(d).db;
  } catch (e) {
    somenteLeitura = true;
    return vazio();
  }
}
function salvar() {
  if (somenteLeitura) { toast('Dados protegidos: importe um backup em Mais → Configurações.'); return; }
  try { localStorage.setItem(CHAVE, JSON.stringify(db)); }
  catch (e) { toast('Não foi possível salvar.'); }
}

/* ================= Utilidades ================= */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Valores em centavos para não ter erro de arredondamento.
function reais(c) {
  c = Math.round(c);
  return (c < 0 ? '-' : '') + 'R$ ' + (Math.abs(c) / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
const reaisCurto = c => reais(c).replace(/,\d\d$/, '');
const pct = x => (x * 100).toFixed(0) + '%';
const campoValor = c => (c / 100).toFixed(2).replace('.', ',');
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
function hojeISO() { return Calc.iso(new Date()); }
function dataBonita(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${SEMANA[Calc.data(iso).getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
const dataBR = iso => iso ? iso.split('-').reverse().join('/') : '';
const dataCurta = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
function horaAgora() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

const prodPorId = pid => db.produtos.find(p => p.id === pid);
const prodPorNome = nome => db.produtos.find(p => p.nome.toLowerCase() === nome.trim().toLowerCase());
const ordenados = () => db.produtos.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
const estoqueBaixo = p => p.qtd <= (p.minimo ?? 3);
const custoMedio = pid => Calc.custoMedio(db, pid);

/* ================= Navegação ================= */
const TITULOS = {
  inicio: 'Início', vender: 'Vender', entradas: 'Entradas financeiras', estoque: 'Estoque', notas: 'Notas fiscais',
  mais: 'Mais', conferencia: 'Conferência financeira', relatorios: 'Relatórios por produto', config: 'Configurações'
};
const SUBTELAS = ['conferencia', 'relatorios', 'config'];
let telaAtual = 'inicio';
function irPara(tela) {
  telaAtual = tela;
  $$('.screen').forEach(s => { s.hidden = s.id !== 'tela-' + tela; });
  const aba = SUBTELAS.includes(tela) ? 'mais' : tela;
  $$('.tab').forEach(b => b.classList.toggle('ativo', b.dataset.tela === aba));
  $('#btn-voltar').hidden = !SUBTELAS.includes(tela);
  $('#titulo-tela').textContent = TITULOS[tela];
  window.scrollTo(0, 0);
  render();
}
$$('.tab').forEach(b => b.addEventListener('click', () => irPara(b.dataset.tela)));
$$('[data-ir]').forEach(b => b.addEventListener('click', () => irPara(b.dataset.ir)));
$('#btn-voltar').addEventListener('click', () => irPara('mais'));

function render() {
  renderPeriodos();
  renderInicio();
  renderVender();
  renderEntradas();
  renderEstoque();
  renderNotas();
  renderConferencia();
  renderRelatorios();
  renderConfig();
}

let ultimoModal = null;
function abrirModal(sel) { $(sel).hidden = false; ultimoModal = sel; }
function fecharModais() { $$('.modal').forEach(m => { m.hidden = true; }); }
function fecharModal(sel) { $(sel).hidden = true; }
$$('.modal').forEach(m => m.addEventListener('click', e => {
  if (e.target === m || e.target.closest('[data-fechar]')) m.hidden = true;
}));

/* ================= Período (dia, semana, mês, personalizado) ================= */
const periodo = { tipo: 'dia', ref: hojeISO(), ini: hojeISO(), fim: hojeISO() };

function ajustarPeriodo() {
  const p = periodo;
  if (p.tipo === 'dia') { p.ini = p.fim = p.ref; }
  else if (p.tipo === 'semana') { p.ini = Calc.inicioSemana(p.ref); p.fim = Calc.somaDias(p.ini, 6); }
  else if (p.tipo === 'mes') {
    const d = Calc.data(p.ref);
    p.ini = Calc.iso(new Date(d.getFullYear(), d.getMonth(), 1));
    p.fim = Calc.iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }
  if (p.ini > p.fim) [p.ini, p.fim] = [p.fim, p.ini];
}
function moverPeriodo(n) {
  const p = periodo;
  if (p.tipo === 'dia') p.ref = Calc.somaDias(p.ref, n);
  else if (p.tipo === 'semana') p.ref = Calc.somaDias(p.ref, 7 * n);
  else if (p.tipo === 'mes') { const d = Calc.data(p.ref); p.ref = Calc.iso(new Date(d.getFullYear(), d.getMonth() + n, 1)); }
  else {
    const len = Calc.diasEntre(p.ini, p.fim).length;
    p.ini = Calc.somaDias(p.ini, n * len); p.fim = Calc.somaDias(p.fim, n * len);
  }
  ajustarPeriodo();
}
function rotuloPeriodo() {
  const p = periodo, hoje = hojeISO();
  if (p.tipo === 'dia') return p.ref === hoje ? 'Hoje' : p.ref === Calc.somaDias(hoje, -1) ? 'Ontem' : dataBonita(p.ref);
  if (p.tipo === 'semana') return `${dataCurta(p.ini)} a ${dataCurta(p.fim)}${p.ini === Calc.inicioSemana(hoje) ? ' · esta semana' : ''}`;
  if (p.tipo === 'mes') { const d = Calc.data(p.ini); return `${MESES[d.getMonth()]} ${d.getFullYear()}`; }
  return `${dataBR(p.ini)} a ${dataBR(p.fim)}`;
}
const NOME_PERIODO = { dia: 'do dia', semana: 'da semana', mes: 'do mês', custom: 'do período' };

function renderPeriodos() {
  const p = periodo;
  const html = `
    <div class="seg">
      ${[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['custom', 'Período']].map(([t, n]) =>
        `<button data-ptipo="${t}" class="${p.tipo === t ? 'ativo' : ''}">${n}</button>`).join('')}
    </div>
    ${p.tipo === 'custom' ? `
      <div class="duas periodo-datas">
        <input type="date" class="input" data-pini value="${p.ini}">
        <input type="date" class="input" data-pfim value="${p.fim}">
      </div>` : `
      <div class="mes-nav">
        <button class="icon-btn" data-pmover="-1" aria-label="Anterior">‹</button>
        <div>${esc(rotuloPeriodo())}</div>
        <button class="icon-btn" data-pmover="1" aria-label="Próximo">›</button>
      </div>`}`;
  $$('.periodo-box').forEach(b => { b.innerHTML = html; });
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-ptipo]');
  const m = e.target.closest('[data-pmover]');
  if (t) {
    periodo.tipo = t.dataset.ptipo;
    if (periodo.tipo === 'custom') { periodo.ini = Calc.somaDias(hojeISO(), -6); periodo.fim = hojeISO(); }
    else periodo.ref = hojeISO();
    ajustarPeriodo(); render();
  } else if (m) { moverPeriodo(Number(m.dataset.pmover)); render(); }
});
document.addEventListener('change', e => {
  if (e.target.matches('[data-pini]')) { periodo.ini = e.target.value || periodo.ini; ajustarPeriodo(); render(); }
  if (e.target.matches('[data-pfim]')) { periodo.fim = e.target.value || periodo.fim; ajustarPeriodo(); render(); }
});

/* ================= Início (dashboard) ================= */
function chipResultado(x) {
  if (x.oferta > 0) return `<span class="chip-res pos">+${reais(x.oferta)} oferta</span>`;
  if (x.divergencia < 0) return `<span class="chip-res neg">${reais(x.divergencia)} abaixo</span>`;
  if (x.esperado || x.entradas) return '<span class="chip-res ok">confere</span>';
  return '<span class="chip-res nada">—</span>';
}

function renderInicio() {
  const r = Calc.resumo(db, periodo.ini, periodo.fim);
  const t = r.tot;
  const nome = NOME_PERIODO[periodo.tipo];
  $('#ini-lucro').textContent = reais(t.lucro);
  $('#ini-lucro').className = 'grande ' + (t.lucro < 0 ? 'neg' : '');
  $('#ini-lucro-sub').innerHTML = `Faturamento total ${reais(t.faturamentoTotal)} − custo dos vendidos ${reais(t.cmv)}` +
    (t.divergencia < 0 ? `<br><span class="neg">Considerando a divergência, o lucro em dinheiro foi ${reais(t.lucroComDivergencia)}.</span>` : '');
  $('#ini-esperado').textContent = reais(t.esperado);
  $('#ini-entradas').textContent = reais(t.entradas);
  $('#ini-ofertas').textContent = reais(t.oferta);
  $('#ini-fattotal').textContent = reais(t.faturamentoTotal);
  $('#ini-cmv').textContent = reais(t.cmv);
  $('#ini-itens').textContent = t.itens;
  $('#ini-compras').textContent = reais(t.compras);
  $('#ini-div').textContent = t.divergencia < 0 ? reais(t.divergencia) : 'Nenhuma';
  $('#ini-div-box').classList.toggle('alerta-kpi', t.divergencia < 0);

  const avisos = [];
  if (t.semCusto) avisos.push(`⚠️ ${t.semCusto} unidade${t.semCusto === 1 ? '' : 's'} vendida${t.semCusto === 1 ? '' : 's'} sem custo cadastrado. Lance a nota fiscal da compra (ou o custo no produto) para o lucro ficar certo.`);
  const ub = db.ultimoBackup;
  if (db.vendas.length && (!ub || Calc.diasEntre(ub, hojeISO()).length > 31)) avisos.push('💾 Faz mais de 30 dias sem backup. Vá em Mais → Configurações → Exportar backup.');
  $('#ini-semcusto').hidden = !avisos.length;
  $('#ini-semcusto').innerHTML = avisos.join('<br>');

  // Ofertas dia a dia (semana mostra os 7 dias, mês/período mostra os dias com movimento).
  let dias = [];
  if (periodo.tipo === 'semana') dias = Calc.diasEntre(periodo.ini, periodo.fim);
  else if (periodo.tipo !== 'dia') dias = Object.keys(r.dias).sort();
  $('#ini-dias-box').hidden = periodo.tipo === 'dia';
  const vaz = { esperado: 0, entradas: 0, oferta: 0, divergencia: 0 };
  $('#ini-dias').innerHTML = dias.length ? dias.map(d => {
    const x = r.dias[d] || vaz;
    return `<div class="linha-dia">
      <div><b>${periodo.tipo === 'semana' ? SEMANA[Calc.data(d).getDay()] : dataBonita(d)}</b><small>esperado ${reais(x.esperado)} · recebido ${reais(x.entradas)}</small></div>
      ${chipResultado(x)}
    </div>`;
  }).join('') + `<div class="linha-dia total"><b>Ofertas ${nome}</b><b class="pos">${reais(t.oferta)}</b></div>`
    : '<div class="txt2 sem-margem">Nenhum movimento neste período.</div>';
}

/* ================= Vender ================= */
let carrinho = {}; // pid -> qtd
let recebidoEditado = false;

function totalCarrinho() {
  return Object.entries(carrinho).reduce((s, [pid, q]) => { const p = prodPorId(pid); return s + (p ? p.preco * q : 0); }, 0);
}

function renderVender() {
  const grid = $('#grid-prod');
  const prods = ordenados();
  $('#vender-vazio').hidden = prods.length > 0;
  grid.innerHTML = prods.map(p => {
    const q = carrinho[p.id] || 0;
    const resta = p.qtd - q;
    const semPreco = !(p.preco > 0);
    return `<button class="prod ${q ? 'sel' : ''} ${p.qtd <= 0 || semPreco ? 'zerado' : ''}" data-add="${p.id}">
      ${q ? `<span class="prod-qtd">${q}</span>` : ''}
      <span class="prod-nome">${esc(p.nome)}</span>
      <span>
        <span class="prod-preco">${semPreco ? 'Sem preço' : reais(p.preco)}</span><br>
        <span class="prod-est ${estoqueBaixo({ ...p, qtd: resta }) ? 'baixo' : ''}">${p.qtd <= 0 ? 'Sem estoque' : `Restam ${resta}`}</span>
      </span>
    </button>`;
  }).join('');

  const itens = Object.entries(carrinho).filter(([pid, q]) => q > 0 && prodPorId(pid));
  $('#carrinho').hidden = itens.length === 0;
  const total = totalCarrinho();
  $('#carrinho-itens').innerHTML = itens.map(([pid, q]) => {
    const p = prodPorId(pid);
    return `<div class="item-car">
      <span class="nome">${esc(p.nome)}</span>
      <span class="qtd-ctrl"><button data-menos="${pid}" aria-label="Menos">−</button><span>${q}</span><button data-add="${pid}" aria-label="Mais">+</button></span>
      <span class="sub">${reais(p.preco * q)}</span>
    </div>`;
  }).join('');
  $('#carrinho-total').textContent = reais(total);
  if (!recebidoEditado) $('#venda-recebido').value = total ? campoValor(total) : '';
  atualizarDicaOferta();
  $('#btn-registrar').textContent = `Registrar venda no Pix · ${reais(total)}`;

  $('#chave-pix-box').hidden = !db.chavePix;
  $('#chave-pix-txt').textContent = db.chavePix || '';
  renderVendasDia();
}

function atualizarDicaOferta() {
  const receber = $('#venda-receber').checked;
  $('#venda-recebido-box').hidden = !receber;
  const total = totalCarrinho();
  const rec = lerValor($('#venda-recebido').value);
  const dica = $('#venda-oferta-dica');
  if (!receber) { dica.textContent = ''; return; }
  if (isNaN(rec)) dica.textContent = '';
  else if (rec > total) dica.innerHTML = `<span class="pos">Oferta de ${reais(rec - total)}</span> (calculada sozinha, sem custo).`;
  else if (rec < total) dica.innerHTML = `<span class="neg">${reais(rec - total)} abaixo do esperado</span> — vai aparecer na conferência.`;
  else dica.textContent = 'Valor exato da venda.';
}
$('#venda-recebido').addEventListener('input', () => { recebidoEditado = true; atualizarDicaOferta(); });
$('#venda-receber').addEventListener('change', atualizarDicaOferta);
$('#venda-data').addEventListener('change', renderVendasDia);

$('#tela-vender').addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  const menos = e.target.closest('[data-menos]');
  if (add) {
    const p = prodPorId(add.dataset.add);
    if (!p) return;
    if (!(p.preco > 0)) { toast(`Defina o preço de venda de ${p.nome} em Estoque.`); return; }
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

$('#btn-limpar').addEventListener('click', () => { carrinho = {}; recebidoEditado = false; renderVender(); });

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
    // O custo da venda é o custo médio do produto neste momento.
    itens.push({ pid, nome: p.nome, preco: p.preco, custo: custoMedio(pid), qtd: q });
  }
  if (!itens.length) return;
  const receber = $('#venda-receber').checked;
  const recebido = lerValor($('#venda-recebido').value);
  if (receber && isNaN(recebido)) { toast('Digite o valor recebido ou desmarque "Lançar a entrada".'); return; }

  itens.forEach(i => { prodPorId(i.pid).qtd -= i.qtd; });
  const venda = { id: id(), data, hora: horaAgora(), forma: 'pix', itens };
  venda.total = Calc.totalVenda(venda);
  db.vendas.push(venda);
  if (receber && recebido > 0) {
    db.entradas.push({ id: id(), data, hora: venda.hora, valor: recebido, forma: 'pix', obs: '', vendaId: venda.id });
  }
  salvar();
  carrinho = {}; recebidoEditado = false;
  render();
  const oferta = receber ? recebido - venda.total : 0;
  toast(`Venda de ${reais(venda.total)} registrada${oferta > 0 ? ` · oferta ${reais(oferta)}` : ''}!`);
});

function entradaDaVenda(vid) { return db.entradas.find(e => e.vendaId === vid); }

function htmlVenda(v) {
  const e = entradaDaVenda(v.id);
  return `<div class="mov">
    <div class="desc">${v.itens.map(i => `${i.qtd}× ${esc(i.nome)}`).join(', ')}
      <div class="hora">${v.hora || ''} · esperado ${reais(v.total)} · custo ${reais(Calc.cmvVenda(v))}${e ? ` · recebido ${reais(e.valor)}` : ''}</div></div>
    <button class="btn-mini" data-editar-venda="${v.id}">Editar</button>
  </div>`;
}
function renderVendasDia() {
  const d = $('#venda-data').value || hojeISO();
  const vs = db.vendas.filter(v => v.data === d).sort((a, b) => (b.hora || '').localeCompare(a.hora || ''));
  $('#vendas-dia-titulo').textContent = `Vendas de ${d === hojeISO() ? 'hoje' : dataBR(d)}`;
  $('#vendas-dia').innerHTML = vs.length ? vs.map(htmlVenda).join('') : '<div class="txt2 sem-margem">Nenhuma venda neste dia.</div>';
}

/* ----- Editar / excluir venda ----- */
let vendaEdit = null;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-editar-venda]');
  if (b) abrirVenda(db.vendas.find(v => v.id === b.dataset.editarVenda));
});
function abrirVenda(v) {
  if (!v) return;
  vendaEdit = { id: v.id, itens: v.itens.map(i => ({ ...i })) };
  $('#ev-data').value = v.data;
  const e = entradaDaVenda(v.id);
  $('#ev-recebido').value = e ? campoValor(e.valor) : '';
  $('#ev-add').innerHTML = '<option value="">+ Adicionar produto…</option>' +
    ordenados().filter(p => p.preco > 0).map(p => `<option value="${p.id}">${esc(p.nome)} (${p.qtd} em estoque)</option>`).join('');
  renderVendaEdit();
  abrirModal('#modal-venda');
}
function renderVendaEdit() {
  $('#ev-itens').innerHTML = vendaEdit.itens.map((i, k) => `<div class="item-car">
    <span class="nome">${esc(i.nome)} <small class="txt2">${reais(i.preco)}</small></span>
    <span class="qtd-ctrl"><button data-evmenos="${k}">−</button><span>${i.qtd}</span><button data-evmais="${k}">+</button></span>
    <span class="sub">${reais(i.preco * i.qtd)}</span></div>`).join('') || '<div class="txt2">Sem itens.</div>';
  $('#ev-total').textContent = reais(Calc.totalVenda(vendaEdit));
}
$('#ev-itens').addEventListener('click', e => {
  const m = e.target.closest('[data-evmenos]'), p = e.target.closest('[data-evmais]');
  if (m) { const i = vendaEdit.itens[m.dataset.evmenos]; i.qtd--; if (i.qtd <= 0) vendaEdit.itens.splice(m.dataset.evmenos, 1); }
  if (p) vendaEdit.itens[p.dataset.evmais].qtd++;
  renderVendaEdit();
});
$('#ev-add').addEventListener('change', e => {
  const p = prodPorId(e.target.value);
  e.target.value = '';
  if (!p) return;
  const ex = vendaEdit.itens.find(i => i.pid === p.id);
  if (ex) ex.qtd++;
  else vendaEdit.itens.push({ pid: p.id, nome: p.nome, preco: p.preco, custo: custoMedio(p.id), qtd: 1 });
  renderVendaEdit();
});
$('#btn-salvar-venda').addEventListener('click', () => {
  const v = db.vendas.find(x => x.id === vendaEdit.id);
  if (!v) return;
  if (!vendaEdit.itens.length) { toast('A venda ficou sem itens. Use "Excluir venda".'); return; }
  const recTxt = $('#ev-recebido').value.trim();
  const rec = recTxt ? lerValor(recTxt) : null;
  if (recTxt && isNaN(rec)) { toast('Valor recebido inválido.'); return; }
  // Diferença de estoque: devolve o que saiu da venda antiga e tira o da nova.
  const delta = {};
  v.itens.forEach(i => { delta[i.pid] = (delta[i.pid] || 0) + i.qtd; });
  vendaEdit.itens.forEach(i => { delta[i.pid] = (delta[i.pid] || 0) - i.qtd; });
  for (const [pid, d] of Object.entries(delta)) {
    const p = prodPorId(pid);
    if (p && p.qtd + d < 0) { toast(`Só tem ${p.qtd} de ${p.nome} no estoque.`); return; }
  }
  Object.entries(delta).forEach(([pid, d]) => { const p = prodPorId(pid); if (p) p.qtd += d; });
  v.data = $('#ev-data').value || v.data;
  v.itens = vendaEdit.itens;
  v.total = Calc.totalVenda(v);
  const e = entradaDaVenda(v.id);
  if (rec && rec > 0) {
    if (e) { e.valor = rec; e.data = v.data; }
    else db.entradas.push({ id: id(), data: v.data, hora: v.hora, valor: rec, forma: 'pix', obs: '', vendaId: v.id });
  } else if (e) db.entradas = db.entradas.filter(x => x !== e);
  salvar(); fecharModal('#modal-venda'); render();
  toast('Venda atualizada.');
});
$('#btn-excluir-venda').addEventListener('click', () => {
  const v = db.vendas.find(x => x.id === vendaEdit.id);
  const e = v && entradaDaVenda(v.id);
  if (!v || !confirm(`Excluir venda de ${reais(v.total)}? Os itens voltam para o estoque${e ? ` e a entrada de ${reais(e.valor)} lançada com ela também é excluída` : ''}.`)) return;
  v.itens.forEach(i => { const p = prodPorId(i.pid); if (p) p.qtd += i.qtd; });
  db.vendas = db.vendas.filter(x => x !== v);
  db.entradas = db.entradas.filter(x => x.vendaId !== v.id);
  salvar(); fecharModal('#modal-venda'); render();
  toast('Venda excluída e estoque devolvido.');
});

/* ================= Entradas financeiras ================= */
function formaSelecionada(sel) { const b = $(sel + ' .ativo'); return b ? b.dataset.forma : 'pix'; }
function selecionarForma(sel, forma) { $$(sel + ' button').forEach(b => b.classList.toggle('ativo', b.dataset.forma === (forma || 'pix'))); }
['#ent-forma', '#ee-forma'].forEach(sel => $(sel).addEventListener('click', e => {
  const b = e.target.closest('[data-forma]'); if (b) selecionarForma(sel, b.dataset.forma);
}));

$('#btn-salvar-entrada').addEventListener('click', () => {
  const valor = lerValor($('#ent-valor').value);
  if (isNaN(valor) || valor <= 0) return toast('Digite o valor recebido.');
  const data = $('#ent-data').value || hojeISO();
  db.entradas.push({ id: id(), data, hora: horaAgora(), valor, forma: formaSelecionada('#ent-forma'), obs: $('#ent-obs').value.trim() });
  salvar();
  $('#ent-valor').value = ''; $('#ent-obs').value = '';
  render();
  const x = Calc.resumo(db, data, data).tot;
  toast(`Entrada de ${reais(valor)} lançada.${x.oferta ? ` Oferta do dia: ${reais(x.oferta)}.` : ''}`);
});

function blocoConferencia(t) {
  let status;
  if (t.oferta > 0 && t.divergencia < 0) status = `<div class="status pos">Ofertas: ${reais(t.oferta)}</div><div class="status neg">Recebido abaixo do esperado: ${reais(t.divergencia)}</div>`;
  else if (t.oferta > 0) status = `<div class="status pos">Ofertas identificadas: ${reais(t.oferta)}</div>`;
  else if (t.divergencia < 0) status = `<div class="status neg">Valor recebido abaixo do esperado: ${reais(t.divergencia)}</div>`;
  else if (t.esperado || t.entradas) status = '<div class="status ok">✔ Entradas conferem com o esperado</div>';
  else status = '<div class="txt2 sem-margem">Nenhum movimento neste período.</div>';
  return `<div class="comparativo">
      <div><span>Faturamento esperado</span><b>${reais(t.esperado)}</b></div>
      <div class="vs">×</div>
      <div><span>Entradas</span><b>${reais(t.entradas)}</b></div>
    </div>${status}`;
}

function renderEntradas() {
  if (!$('#ent-data').value) $('#ent-data').value = hojeISO();
  const r = Calc.resumo(db, periodo.ini, periodo.fim);
  $('#ent-resumo').innerHTML = blocoConferencia(r.tot);
  const es = db.entradas.filter(e => e.data >= periodo.ini && e.data <= periodo.fim)
    .sort((a, b) => (b.data + (b.hora || '')).localeCompare(a.data + (a.hora || '')));
  $('#lista-entradas').innerHTML = es.length ? `<div class="card">${es.map(e => `
    <button class="mov mov-btn" data-editar-entrada="${e.id}">
      <div class="desc">${dataBonita(e.data)}${e.hora ? ' · ' + e.hora : ''}
        <div class="hora">${FORMAS[e.forma] || 'Pix'}${e.vendaId ? ' · lançada com a venda' : ''}${e.obs ? ' · ' + esc(e.obs) : ''}</div></div>
      <b class="pos">${reais(e.valor)}</b>
    </button>`).join('')}</div>` : '<div class="vazio">Nenhuma entrada neste período.</div>';
}

let entradaEdit = null;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-editar-entrada]');
  if (!b) return;
  const en = db.entradas.find(x => x.id === b.dataset.editarEntrada);
  if (!en) return;
  entradaEdit = en.id;
  $('#ee-valor').value = campoValor(en.valor);
  $('#ee-data').value = en.data;
  $('#ee-obs').value = en.obs || '';
  selecionarForma('#ee-forma', en.forma);
  abrirModal('#modal-entrada');
});
$('#btn-salvar-ee').addEventListener('click', () => {
  const en = db.entradas.find(x => x.id === entradaEdit);
  const valor = lerValor($('#ee-valor').value);
  if (!en) return;
  if (isNaN(valor) || valor <= 0) return toast('Valor inválido.');
  Object.assign(en, { valor, data: $('#ee-data').value || en.data, obs: $('#ee-obs').value.trim(), forma: formaSelecionada('#ee-forma') });
  salvar(); fecharModal('#modal-entrada'); render();
  toast('Entrada atualizada.');
});
$('#btn-excluir-ee').addEventListener('click', () => {
  const en = db.entradas.find(x => x.id === entradaEdit);
  if (!en || !confirm(`Excluir a entrada de ${reais(en.valor)}?`)) return;
  db.entradas = db.entradas.filter(x => x !== en);
  salvar(); fecharModal('#modal-entrada'); render();
  toast('Entrada excluída.');
});

/* ================= Estoque ================= */
function renderEstoque() {
  const prods = ordenados();
  const est = Calc.resumoEstoque(db);
  $('#est-unidades').textContent = est.unidades;
  $('#est-valor-custo').textContent = reaisCurto(est.valorCusto);
  $('#est-valor').textContent = reaisCurto(est.valorVenda);

  $('#est-zerado').hidden = est.semEstoque.length === 0;
  $('#est-zerado').innerHTML = '⛔ Sem estoque: ' + est.semEstoque.map(p => `<b>${esc(p.nome)}</b>`).join(', ');
  $('#est-alerta').hidden = est.baixo.length === 0;
  $('#est-alerta').innerHTML = '⚠️ Estoque baixo: ' + est.baixo.map(p => `<b>${esc(p.nome)}</b> (${p.qtd})`).join(', ');

  $('#estoque-vazio').hidden = prods.length > 0;
  $('#lista-estoque').innerHTML = prods.map(p => {
    const cm = custoMedio(p.id);
    const margem = p.preco > 0 && cm > 0 ? (p.preco - cm) / p.preco : null;
    return `
    <div class="est-item">
      <div class="est-qtd ${estoqueBaixo(p) ? 'baixo' : ''}"><b>${p.qtd}</b><span>unid.</span></div>
      <button class="est-info" data-relprod="${p.id}">
        <div class="est-nome">${esc(p.nome)}</div>
        <div class="est-det">Venda ${p.preco > 0 ? reais(p.preco) : '<span class="neg">sem preço</span>'} · custo médio ${cm ? reais(cm) : '<span class="neg">—</span>'}${margem != null ? ` · margem ${pct(margem)}` : ''}</div>
        <div class="est-det">Em estoque: ${reais(p.qtd * cm)} pelo custo · ${reais(p.qtd * p.preco)} pela venda</div>
      </button>
      <div class="est-acoes">
        <button class="btn-mini" data-repor="${p.id}">+ Repor</button>
        <button class="btn-mini" data-editar="${p.id}">Editar</button>
      </div>
    </div>`;
  }).join('');
}

let editando = null;

function abrirProduto(p) {
  editando = p ? p.id : null;
  $('#modal-prod-titulo').textContent = p ? 'Editar produto' : 'Novo produto';
  $('#p-nome').value = p ? p.nome : '';
  $('#p-preco').value = p && p.preco ? campoValor(p.preco) : '';
  $('#p-custo').value = p && p.custo ? campoValor(p.custo) : '';
  $('#p-qtd').value = p ? p.qtd : '';
  $('#p-min').value = p ? (p.minimo ?? 3) : '';
  $('#p-qtd-lbl').textContent = p ? 'Unidades em estoque (corrigir)' : 'Unidades em estoque';
  const temNotas = p && db.notas.some(n => n.itens.some(i => i.pid === p.id && i.total > 0));
  $('#p-custo-lbl').textContent = temNotas ? 'Custo do estoque inicial' : 'Custo por unidade';
  $('#p-custo-medio').innerHTML = p ? (temNotas
    ? `Custo médio atual: <b>${reais(custoMedio(p.id))}</b> (calculado pelas notas fiscais).`
    : 'Quando você lançar notas fiscais, o custo médio passa a ser calculado por elas.') : 'O custo médio é recalculado sozinho a cada nota fiscal lançada.';
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
    // O estoque inicial com custo informado entra no custo médio como uma "compra".
    db.produtos.push({ id: id(), nome, preco, custo, qtdBase: qtd, qtd, minimo });
  }
  Calc.preencherCustosFaltando(db);
  salvar(); fecharModal('#modal-prod'); render();
  toast(editando ? 'Produto atualizado!' : 'Produto adicionado!');
});

$('#btn-excluir-prod').addEventListener('click', () => {
  const p = prodPorId(editando);
  if (!p || !confirm(`Excluir "${p.nome}" do estoque? As vendas e notas antigas continuam no histórico.`)) return;
  db.produtos = db.produtos.filter(x => x.id !== p.id);
  delete carrinho[p.id];
  salvar(); fecharModal('#modal-prod'); render();
  toast('Produto excluído.');
});

/* ----- Repor = nota rápida de um produto ----- */
let repondo = null;
function abrirRepor(p) {
  if (!p) return;
  repondo = p.id;
  $('#repor-titulo').textContent = 'Repor ' + p.nome;
  const cm = custoMedio(p.id);
  $('#repor-atual').textContent = `Hoje tem ${p.qtd} unidade${p.qtd === 1 ? '' : 's'}.${cm ? ` Custo médio atual: ${reais(cm)}.` : ''}`;
  $('#r-qtd').value = '';
  $('#r-valor').value = '';
  $('#r-valor').placeholder = 'opcional';
  $('#r-mercado').value = '';
  $('#r-data').value = hojeISO();
  abrirModal('#modal-repor');
  setTimeout(() => $('#r-qtd').focus(), 250);
}
$('#r-qtd').addEventListener('input', () => {
  // Sugere o gasto com base no custo médio.
  const cm = custoMedio(repondo);
  const q = lerInteiro($('#r-qtd').value);
  if (cm && !isNaN(q)) $('#r-valor').placeholder = 'ex.: ' + campoValor(Math.round(cm * q));
});
$('#btn-confirmar-repor').addEventListener('click', () => {
  const p = prodPorId(repondo);
  if (!p) return;
  const q = lerInteiro($('#r-qtd').value);
  const vTxt = $('#r-valor').value.trim();
  const valor = vTxt ? lerValor(vTxt) : 0;
  if (isNaN(q) || q <= 0) return toast('Digite quantas unidades chegaram.');
  if (isNaN(valor)) return toast('Valor inválido.');
  p.qtd += q;
  db.notas.push({
    id: id(), data: $('#r-data').value || hojeISO(), hora: horaAgora(), mercado: $('#r-mercado').value.trim() || 'Reposição',
    itens: [{ pid: p.id, nome: p.nome, qtd: q, total: valor }], link: '', chave: '', obs: valor ? '' : 'Valor não informado', origem: 'reposicao'
  });
  Calc.preencherCustosFaltando(db);
  salvar(); fecharModais(); render();
  toast(`+${q} ${p.nome} no estoque.${valor ? ` Custo médio: ${reais(custoMedio(p.id))}.` : ''}`);
});

/* ----- Relatório de um produto ----- */
let relProdId = null;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-relprod]');
  if (!b) return;
  const p = prodPorId(b.dataset.relprod);
  if (!p) return;
  relProdId = p.id;
  const r = Calc.relatorioProduto(db, p.id);
  $('#rp-titulo').textContent = p.nome;
  const l = (n, v, cls = '') => `<div><span>${n}</span><b class="${cls}">${v}</b></div>`;
  $('#rp-corpo').innerHTML = `<div class="res-linhas">
    ${l('Quantidade comprada', r.comprado)}
    ${l('Quantidade vendida', r.vendido)}
    ${l('Estoque atual', r.estoque)}
    ${l('Custo médio', r.custoMedio ? reais(r.custoMedio) : '—')}
    ${l('Preço de venda', reais(r.preco))}
    ${l('Gasto em compras', reais(r.gasto))}
    ${l('Faturamento gerado', reais(r.faturamento))}
    ${l('Custo das unidades vendidas', reais(r.cmv))}
    ${l('Lucro gerado', reais(r.lucro), r.lucro < 0 ? 'neg' : 'pos')}
    ${l('Margem de lucro', r.faturamento ? pct(r.margem) : '—')}
  </div><p class="dica">Desde o início do uso do app. Ofertas não entram aqui porque não pertencem a um produto.</p>`;
  abrirModal('#modal-relprod');
});
$('#rp-editar').addEventListener('click', () => { fecharModal('#modal-relprod'); abrirProduto(prodPorId(relProdId)); });
$('#rp-repor').addEventListener('click', () => { fecharModal('#modal-relprod'); abrirRepor(prodPorId(relProdId)); });

/* ================= Notas fiscais ================= */
let notasAno = new Date().getFullYear();
let notasMes = null; // 'AAAA-MM' quando um mês está aberto

$('#ano-ant').addEventListener('click', () => { notasAno--; renderNotas(); });
$('#ano-prox').addEventListener('click', () => { notasAno++; renderNotas(); });
$('#btn-ver-anos').addEventListener('click', () => { notasMes = null; renderNotas(); window.scrollTo(0, 0); });
function moverMesNotas(n) {
  const [a, m] = notasMes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  notasMes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  notasAno = d.getFullYear();
  renderNotas();
}
$('#mesn-ant').addEventListener('click', () => moverMesNotas(-1));
$('#mesn-prox').addEventListener('click', () => moverMesNotas(1));
$('#notas-meses').addEventListener('click', e => {
  const b = e.target.closest('[data-mesn]');
  if (b) { notasMes = b.dataset.mesn; renderNotas(); window.scrollTo(0, 0); }
});

function renderNotas() {
  $('#notas-anos').hidden = !!notasMes;
  $('#notas-mes').hidden = !notasMes;
  if (!notasMes) {
    $('#ano-label').textContent = notasAno;
    const doAno = db.notas.filter(n => n.data.startsWith(notasAno + '-'));
    $('#ano-total').textContent = reais(doAno.reduce((s, n) => s + Calc.totalNota(n), 0));
    $('#ano-qtd').textContent = `${doAno.length} nota${doAno.length === 1 ? '' : 's'}`;
    const hoje = new Date();
    const meses = MESES.map((nome, m) => {
      const pref = `${notasAno}-${String(m + 1).padStart(2, '0')}`;
      const ns = doAno.filter(n => n.data.startsWith(pref));
      return { pref, nome, qtd: ns.length, total: ns.reduce((s, n) => s + Calc.totalNota(n), 0), m };
    }).filter(x => x.qtd || (notasAno === hoje.getFullYear() && x.m === hoje.getMonth()));
    const max = Math.max(1, ...meses.map(x => x.total));
    $('#notas-meses').innerHTML = meses.length ? meses.map(x => `
      <button class="linha-mes" data-mesn="${x.pref}">
        <div class="lm-topo"><b>${x.nome}</b><span>${x.qtd} nota${x.qtd === 1 ? '' : 's'} · <b>${reais(x.total)}</b> ›</span></div>
        <div class="barra"><i style="width:${(x.total / max * 100).toFixed(1)}%"></i></div>
      </button>`).join('') : '<div class="txt2 sem-margem">Nenhuma nota neste ano.</div>';
    return;
  }
  const [a, m] = notasMes.split('-').map(Number);
  $('#mesn-label').textContent = `${MESES[m - 1]} ${a}`;
  const ns = db.notas.filter(n => n.data.startsWith(notasMes)).sort((x, y) => y.data.localeCompare(x.data));
  $('#mesn-total').textContent = reais(ns.reduce((s, n) => s + Calc.totalNota(n), 0));
  $('#mesn-qtd').textContent = ns.length;
  $('#mesn-lista').innerHTML = ns.length ? `<div class="card">${ns.map(n => `
    <button class="mov mov-btn" data-editar-nota="${n.id}">
      <div class="desc"><b>${esc(n.mercado || 'Compra')}</b> ${n.arquivoId ? '📎' : ''}${n.link || n.chave ? ' 🧾' : ''}
        <div class="hora">${dataBR(n.data)} · ${n.itens.map(i => `${i.qtd}× ${esc(i.nome)}`).join(', ')}</div></div>
      <b>${reais(Calc.totalNota(n))}</b>
    </button>`).join('')}</div>` : '<div class="vazio">Nenhuma nota neste mês.</div>';

  const porProd = {};
  ns.forEach(n => n.itens.forEach(i => {
    const k = i.pid || i.nome;
    const x = porProd[k] = porProd[k] || { pid: i.pid, nome: i.nome, qtd: 0, total: 0, qtdComValor: 0 };
    x.qtd += i.qtd; x.total += i.total || 0; if (i.total > 0) x.qtdComValor += i.qtd;
  }));
  const lista = Object.values(porProd).sort((x, y) => y.total - x.total);
  $('#mesn-prod').innerHTML = lista.length ? lista.map(x => `
    <div class="top-item"><span>${esc(x.nome)} <span class="txt2">× ${x.qtd}</span>
      <br><small class="txt2">no mês ${x.qtdComValor ? reais(x.total / x.qtdComValor) : '—'}/un · custo médio geral ${x.pid && prodPorId(x.pid) ? reais(custoMedio(x.pid)) : '—'}</small></span>
      <b>${reais(x.total)}</b></div>`).join('') : '<div class="txt2 sem-margem">—</div>';
}

/* ----- Arquivos das notas (IndexedDB: fotos/PDF não cabem no localStorage) ----- */
const Arq = (() => {
  let dbp;
  const abrir = () => dbp || (dbp = new Promise((ok, erro) => {
    const r = indexedDB.open('frigobar-arquivos', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('arquivos');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  }));
  const tx = async (modo, fn) => {
    const d = await abrir();
    return new Promise((ok, erro) => {
      const t = d.transaction('arquivos', modo);
      const req = fn(t.objectStore('arquivos'));
      t.oncomplete = () => ok(req && req.result);
      t.onerror = () => erro(t.error);
    });
  };
  return {
    salvar: (k, blob) => tx('readwrite', s => s.put(blob, k)),
    ler: k => tx('readonly', s => s.get(k)),
    apagar: k => tx('readwrite', s => s.delete(k)),
    chaves: () => tx('readonly', s => s.getAllKeys())
  };
})();

function comprimirImagem(arquivo, max = 1600) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob(b => b ? ok(b) : erro(new Error('imagem')), 'image/jpeg', 0.72);
    };
    img.onerror = () => erro(new Error('imagem'));
    img.src = URL.createObjectURL(arquivo);
  });
}
const blobParaDataURL = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
const dataURLParaBlob = async u => (await fetch(u)).blob();

/* ----- Formulário da nota ----- */
let notaEdit = null;

function linhaVazia() { return { nome: '', qtd: '', unit: '', total: '' }; }
function abrirNota(n) {
  notaEdit = {
    id: n ? n.id : null,
    linhas: n ? n.itens.map(i => ({ pid: i.pid, nome: i.nome, qtd: String(i.qtd), total: i.total ? campoValor(i.total) : '', unit: i.total && i.qtd ? (i.total / i.qtd / 100).toFixed(2).replace('.', ',') : '' })) : [linhaVazia()],
    arquivoId: n ? n.arquivoId || null : null,
    arquivoNome: n ? n.arquivoNome || '' : '',
    arquivoBlob: null, removerArquivo: false
  };
  $('#nota-titulo').textContent = n ? 'Editar nota fiscal' : 'Nova nota fiscal';
  $('#n-link').value = n ? (n.link || n.chave || '') : '';
  $('#n-data').value = n ? n.data : hojeISO();
  $('#n-mercado').value = n ? n.mercado || '' : '';
  $('#n-total-nota').value = n && n.totalNota ? campoValor(n.totalNota) : '';
  $('#n-obs').value = n ? n.obs || '' : '';
  $('#btn-excluir-nota').hidden = !n;
  $('#lista-produtos').innerHTML = ordenados().map(p => `<option value="${esc(p.nome)}">`).join('');
  $('#lista-mercados').innerHTML = [...new Set(db.notas.map(x => x.mercado).filter(Boolean))].map(m => `<option value="${esc(m)}">`).join('');
  mostrarInfoQr(false);
  renderLinhasNota();
  renderAnexo();
  abrirModal('#modal-nota');
}
$('#btn-nova-nota').addEventListener('click', () => abrirNota(null));
document.addEventListener('click', e => {
  const b = e.target.closest('[data-editar-nota]');
  if (b) abrirNota(db.notas.find(n => n.id === b.dataset.editarNota));
});

function renderLinhasNota() {
  $('#n-itens').innerHTML = notaEdit.linhas.map((l, k) => `
    <div class="item-nota" data-linha="${k}">
      <div class="in-topo">
        <input class="input" data-campo="nome" list="lista-produtos" placeholder="Produto" value="${esc(l.nome)}" autocomplete="off">
        <button class="icon-btn" data-remover-linha="${k}" aria-label="Remover">✕</button>
      </div>
      <div class="tres">
        <label><span>Qtd</span><input class="input" data-campo="qtd" inputmode="numeric" placeholder="0" value="${esc(l.qtd)}"></label>
        <label><span>Valor un.</span><input class="input" data-campo="unit" inputmode="decimal" placeholder="0,00" value="${esc(l.unit)}"></label>
        <label><span>Total</span><input class="input" data-campo="total" inputmode="decimal" placeholder="0,00" value="${esc(l.total)}"></label>
      </div>
    </div>`).join('');
  atualizarTotalNota();
}
function atualizarTotalNota() {
  const total = notaEdit.linhas.reduce((s, l) => s + (lerValor(l.total) || 0), 0);
  $('#n-total').textContent = reais(total);
  const tn = lerValor($('#n-total-nota').value);
  $('#n-total-aviso').innerHTML = !isNaN(tn) && tn !== total
    ? `<span class="neg">A soma dos produtos (${reais(total)}) é diferente do valor da nota (${reais(tn)}). Tudo bem se a nota tiver itens que não são do frigobar.</span>` : '';
}
$('#n-total-nota').addEventListener('input', atualizarTotalNota);
$('#n-itens').addEventListener('input', e => {
  const campo = e.target.dataset.campo;
  const box = e.target.closest('[data-linha]');
  if (!campo || !box) return;
  const l = notaEdit.linhas[box.dataset.linha];
  l[campo] = e.target.value;
  const q = lerInteiro(l.qtd);
  const set = (c, v) => { l[c] = v; box.querySelector(`[data-campo="${c}"]`).value = v; };
  if ((campo === 'unit' || campo === 'qtd') && q > 0 && !isNaN(lerValor(l.unit))) set('total', campoValor(Math.round(lerValor(l.unit) * q)));
  else if (campo === 'total' && q > 0 && !isNaN(lerValor(l.total))) set('unit', (lerValor(l.total) / q / 100).toFixed(2).replace('.', ','));
  if (campo === 'nome') { const p = prodPorNome(l.nome); l.pid = p ? p.id : null; }
  atualizarTotalNota();
});
$('#n-itens').addEventListener('click', e => {
  const b = e.target.closest('[data-remover-linha]');
  if (!b) return;
  notaEdit.linhas.splice(Number(b.dataset.removerLinha), 1);
  if (!notaEdit.linhas.length) notaEdit.linhas.push(linhaVazia());
  renderLinhasNota();
});
$('#btn-add-item').addEventListener('click', () => {
  notaEdit.linhas.push(linhaVazia());
  renderLinhasNota();
  const ins = $$('#n-itens [data-campo="nome"]');
  ins[ins.length - 1].focus();
});

/* QR Code / link */
function mostrarInfoQr(preencher) {
  const r = Calc.lerNfce($('#n-link').value);
  const info = $('#n-qr-info');
  if (!r) { info.innerHTML = $('#n-link').value.trim() ? '<span class="neg">Não reconheci uma chave de NFC-e neste texto.</span>' : 'Dica: aponte a câmera do iPhone para o QR Code, copie o link e cole aqui — ou use o botão acima.'; return; }
  const cnpj = r.cnpj ? r.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';
  const partes = [];
  if (r.chave) partes.push(`Nota nº ${r.numero} · CNPJ ${cnpj}`);
  if (r.data) partes.push(`Data ${dataBR(r.data)}`);
  else if (r.mesAno) partes.push(`Emitida em ${r.mesAno.slice(5)}/${r.mesAno.slice(0, 4)}`);
  if (r.valor != null) partes.push(`Valor ${reais(r.valor)}`);
  info.innerHTML = `✅ ${partes.join(' · ')}` +
    (r.link ? `<br><a href="${esc(r.link)}" target="_blank" rel="noopener">Abrir a nota no site da Sefaz</a> para ver os produtos e digitar abaixo.` : '') +
    (r.valor == null ? '<br><small>O site da Sefaz não deixa outros apps lerem os produtos da nota. Por isso eles são digitados.</small>' : '');
  if (!preencher) return;
  if (r.data) $('#n-data').value = r.data;
  if (r.valor != null) { $('#n-total-nota').value = campoValor(r.valor); atualizarTotalNota(); }
  if (!$('#n-mercado').value.trim() && cnpj) {
    const anterior = db.notas.find(n => n.chave && n.chave.slice(6, 20) === r.cnpj && n.mercado);
    $('#n-mercado').value = anterior ? anterior.mercado : 'CNPJ ' + cnpj;
  }
}
$('#n-link').addEventListener('input', () => mostrarInfoQr(true));
$('#btn-ler-qr').addEventListener('click', () => $('#arq-qr').click());

let jsqrCarregado = null;
function carregarJsQR() {
  return jsqrCarregado || (jsqrCarregado = new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'vendor/jsQR.js'; s.onload = () => ok(window.jsQR); s.onerror = () => { jsqrCarregado = null; erro(new Error('jsqr')); };
    document.head.appendChild(s);
  }));
}
$('#arq-qr').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  toast('Lendo QR Code…');
  try {
    const jsQR = await carregarJsQR();
    const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = URL.createObjectURL(f); });
    let texto = null;
    for (const max of [1200, 800, 1800, 500]) {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const r = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height, { inversionAttempts: 'attemptBoth' });
      if (r && r.data) { texto = r.data; break; }
    }
    URL.revokeObjectURL(img.src);
    if (!texto) return toast('Não consegui ler o QR Code. Tente uma foto mais de perto ou cole o link.');
    $('#n-link').value = texto;
    mostrarInfoQr(true);
    toast('QR Code lido!');
  } catch (err) { toast('Não consegui ler o QR Code.'); }
});

/* Anexo */
function renderAnexo() {
  const tem = (notaEdit.arquivoId && !notaEdit.removerArquivo) || notaEdit.arquivoBlob;
  $('#n-arquivo-nome').textContent = tem ? (notaEdit.arquivoNome || 'Arquivo anexado') : 'Nenhum arquivo';
  $('#btn-ver-anexo').hidden = !tem;
  $('#btn-remover-anexo').hidden = !tem;
}
$('#btn-anexar').addEventListener('click', () => $('#arq-nota').click());
$('#arq-nota').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    let blob = f;
    if (f.type.startsWith('image/')) blob = await comprimirImagem(f);
    else if (f.size > 5 * 1024 * 1024) return toast('PDF muito grande (máx. 5 MB).');
    notaEdit.arquivoBlob = blob;
    notaEdit.arquivoNome = f.name || 'nota';
    notaEdit.removerArquivo = false;
    renderAnexo();
  } catch (err) { toast('Não consegui abrir esse arquivo.'); }
});
$('#btn-remover-anexo').addEventListener('click', () => {
  notaEdit.arquivoBlob = null; notaEdit.removerArquivo = true; renderAnexo();
});
$('#btn-ver-anexo').addEventListener('click', async () => {
  try {
    const blob = notaEdit.arquivoBlob || await Arq.ler(notaEdit.arquivoId);
    if (!blob) return toast('Arquivo não encontrado neste aparelho.');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    if (!blob.type.startsWith('image/')) a.download = notaEdit.arquivoNome || 'nota.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) { toast('Não consegui abrir o arquivo.'); }
});

$('#btn-salvar-nota').addEventListener('click', async () => {
  const itens = [];
  for (const l of notaEdit.linhas) {
    if (!l.nome.trim() && !l.qtd && !l.total) continue;
    const q = lerInteiro(l.qtd);
    const totTxt = String(l.total).trim();
    const total = totTxt ? lerValor(totTxt) : 0;
    if (!l.nome.trim()) return toast('Falta o nome de um produto.');
    if (isNaN(q) || q <= 0) return toast(`Digite a quantidade de ${l.nome}.`);
    if (isNaN(total)) return toast(`Valor inválido em ${l.nome}.`);
    itens.push({ nome: l.nome.trim(), qtd: q, total });
  }
  if (!itens.length) return toast('Adicione pelo menos um produto.');
  const tnTxt = $('#n-total-nota').value.trim();
  const totalNotaInf = tnTxt ? lerValor(tnTxt) : null;
  if (tnTxt && isNaN(totalNotaInf)) return toast('Valor total da nota inválido.');

  // Produtos novos são criados no estoque (sem preço de venda ainda).
  const novos = [];
  itens.forEach(i => {
    let p = prodPorNome(i.nome);
    if (!p) {
      p = { id: id(), nome: i.nome, preco: 0, custo: 0, qtdBase: 0, qtd: 0, minimo: 3 };
      db.produtos.push(p); novos.push(p.nome);
    }
    i.pid = p.id; i.nome = p.nome;
  });

  const antiga = notaEdit.id ? db.notas.find(n => n.id === notaEdit.id) : null;
  // Estoque: desfaz a entrada da versão antiga da nota e aplica a nova.
  if (antiga) antiga.itens.forEach(i => { const p = prodPorId(i.pid); if (p) p.qtd = Math.max(0, p.qtd - i.qtd); });
  itens.forEach(i => { prodPorId(i.pid).qtd += i.qtd; });

  const r = Calc.lerNfce($('#n-link').value);
  const nota = antiga || { id: id(), hora: horaAgora() };
  Object.assign(nota, {
    data: $('#n-data').value || hojeISO(),
    mercado: $('#n-mercado').value.trim(),
    itens,
    link: r ? r.link : '',
    chave: r ? r.chave : '',
    totalNota: totalNotaInf || null,
    obs: $('#n-obs').value.trim()
  });
  try {
    if (notaEdit.arquivoBlob) {
      const k = 'nota-' + nota.id;
      await Arq.salvar(k, notaEdit.arquivoBlob);
      nota.arquivoId = k; nota.arquivoNome = notaEdit.arquivoNome;
    } else if (notaEdit.removerArquivo && nota.arquivoId) {
      await Arq.apagar(nota.arquivoId);
      delete nota.arquivoId; delete nota.arquivoNome;
    }
  } catch (err) { toast('A nota foi salva, mas o arquivo não.'); }
  if (!antiga) db.notas.push(nota);
  Calc.preencherCustosFaltando(db);
  salvar(); fecharModal('#modal-nota');
  notasMes = nota.data.slice(0, 7); notasAno = Number(nota.data.slice(0, 4));
  render();
  toast(novos.length ? `Nota salva. Defina o preço de venda de: ${novos.join(', ')} (em Estoque).` : 'Nota salva! Estoque e custo médio atualizados.');
});

$('#btn-excluir-nota').addEventListener('click', async () => {
  const n = db.notas.find(x => x.id === notaEdit.id);
  if (!n || !confirm(`Excluir a nota de ${reais(Calc.totalNota(n))}? As unidades dela saem do estoque.`)) return;
  n.itens.forEach(i => { const p = prodPorId(i.pid); if (p) p.qtd = Math.max(0, p.qtd - i.qtd); });
  db.notas = db.notas.filter(x => x !== n);
  if (n.arquivoId) { try { await Arq.apagar(n.arquivoId); } catch (e) {} }
  salvar(); fecharModal('#modal-nota'); render();
  toast('Nota excluída.');
});

/* ================= Conferência ================= */
let diaAberto = null;

function renderConferencia() {
  const r = Calc.resumo(db, periodo.ini, periodo.fim);
  const t = r.tot;
  $('#conf-resumo').innerHTML = blocoConferencia(t) + `<div class="res-linhas">
      <div><span>Faturamento total (esperado + ofertas)</span><b>${reais(t.faturamentoTotal)}</b></div>
      <div><span>Custo dos produtos vendidos</span><b>${reais(t.cmv)}</b></div>
      <div><span>Lucro líquido operacional</span><b class="${t.lucro < 0 ? 'neg' : 'pos'}">${reais(t.lucro)}</b></div>
      <div><span>Gastos com compras (notas)</span><b>${reais(t.compras)}</b></div>
    </div>`;

  const chaves = Object.keys(r.dias).sort().reverse();
  $('#conf-dias').innerHTML = chaves.length ? chaves.map(d => {
    const x = r.dias[d];
    const aberto = diaAberto === d;
    let corpo = '';
    if (aberto) {
      const vs = db.vendas.filter(v => v.data === d);
      const es = db.entradas.filter(e => e.data === d);
      const ns = db.notas.filter(n => n.data === d);
      corpo = `<div class="dia-corpo">
        <div class="res-linhas mini">
          <div><span>Faturamento esperado</span><b>${reais(x.esperado)}</b></div>
          <div><span>Entradas</span><b>${reais(x.entradas)}</b></div>
          <div><span>Ofertas</span><b class="pos">${reais(x.oferta)}</b></div>
          ${x.divergencia < 0 ? `<div><span>Recebido abaixo do esperado</span><b class="neg">${reais(x.divergencia)}</b></div>` : ''}
          <div><span>Custo dos vendidos</span><b>${reais(x.cmv)}</b></div>
          <div><span>Lucro operacional</span><b>${reais(x.lucro)}</b></div>
        </div>
        ${vs.length ? `<div class="sub-tit">Vendas</div>${vs.map(htmlVenda).join('')}` : ''}
        ${es.length ? `<div class="sub-tit">Entradas</div>${es.map(e => `<button class="mov mov-btn" data-editar-entrada="${e.id}"><div class="desc">${FORMAS[e.forma] || 'Pix'}${e.vendaId ? ' · com a venda' : ''}${e.obs ? ' · ' + esc(e.obs) : ''}<div class="hora">${e.hora || ''}</div></div><b class="pos">${reais(e.valor)}</b></button>`).join('')}` : ''}
        ${ns.length ? `<div class="sub-tit">Compras</div>${ns.map(n => `<button class="mov mov-btn" data-editar-nota="${n.id}"><div class="desc">${esc(n.mercado || 'Compra')}<div class="hora">${n.itens.map(i => `${i.qtd}× ${esc(i.nome)}`).join(', ')}</div></div><b class="neg">-${reais(Calc.totalNota(n))}</b></button>`).join('')}` : ''}
      </div>`;
    }
    return `<div class="dia">
      <button class="dia-topo" data-dia="${d}">
        <div><div class="dia-data">${dataBonita(d)}</div><div class="dia-sub">esperado ${reais(x.esperado)} · recebido ${reais(x.entradas)}</div></div>
        <div class="dia-val">${chipResultado(x)}<div class="dia-sub">${aberto ? '▲' : '▼'}</div></div>
      </button>${corpo}
    </div>`;
  }).join('') : '<div class="vazio">Nenhum lançamento neste período.</div>';
}
$('#conf-dias').addEventListener('click', e => {
  const dia = e.target.closest('[data-dia]');
  if (dia) { diaAberto = diaAberto === dia.dataset.dia ? null : dia.dataset.dia; renderConferencia(); }
});

/* ================= Relatórios por produto ================= */
let relOrdem = 'qtd';
$('#rel-ordem').addEventListener('click', e => {
  const b = e.target.closest('[data-ordem]');
  if (!b) return;
  relOrdem = b.dataset.ordem;
  $$('#rel-ordem button').forEach(x => x.classList.toggle('ativo', x === b));
  renderRelatorios();
});
function renderRelatorios() {
  const r = Calc.resumo(db, periodo.ini, periodo.fim);
  const lista = Object.values(r.porProduto).sort((a, b) => b[relOrdem] - a[relOrdem]);
  const t = r.tot;
  $('#rel-lista').innerHTML = lista.length ? lista.map((p, k) => `
    <button class="card rel-item" ${p.pid && prodPorId(p.pid) ? `data-relprod="${p.pid}"` : ''}>
      <div class="rel-topo"><b>${k + 1}. ${esc(p.nome)}</b><span>${p.qtd} vendido${p.qtd === 1 ? '' : 's'}</span></div>
      <div class="rel-nums">
        <div><span>Faturamento</span><b>${reais(p.faturamento)}</b></div>
        <div><span>Custo</span><b>${reais(p.cmv)}</b></div>
        <div><span>Lucro</span><b class="${p.lucro < 0 ? 'neg' : 'pos'}">${reais(p.lucro)}</b></div>
        <div><span>Margem</span><b>${pct(p.margem)}</b></div>
      </div>
    </button>`).join('') + `<div class="card"><div class="res-linhas mini">
      <div><span>Total faturamento esperado</span><b>${reais(t.esperado)}</b></div>
      <div><span>Total custo dos vendidos</span><b>${reais(t.cmv)}</b></div>
      <div><span>Lucro dos produtos</span><b>${reais(t.esperado - t.cmv)}</b></div>
      <div><span>+ Ofertas (sem custo)</span><b class="pos">${reais(t.oferta)}</b></div>
      <div><span>Lucro líquido operacional</span><b>${reais(t.lucro)}</b></div>
    </div></div>` : '<div class="vazio">Nenhuma venda neste período.</div>';
}

/* ================= Configurações e backup ================= */
function renderConfig() {
  $('#cfg-chave').value = db.chavePix || '';
  $('#ultimo-backup').textContent = db.ultimoBackup ? `Último backup: ${dataBR(db.ultimoBackup)}` : 'Nenhum backup feito ainda.';
  let temCopia = false;
  try { temCopia = !!localStorage.getItem(CHAVE_COPIA); } catch (e) {}
  $('#cfg-copia-box').hidden = !temCopia;
}

$('#btn-salvar-chave').addEventListener('click', () => {
  db.chavePix = $('#cfg-chave').value.trim();
  salvar(); render();
  toast(db.chavePix ? 'Chave Pix salva!' : 'Chave Pix removida.');
});

async function compartilharOuBaixar(nome, texto, titulo) {
  const blob = new Blob([texto], { type: 'application/json' });
  const arquivo = new File([blob], nome, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: titulo });
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

$('#btn-exportar').addEventListener('click', async () => {
  const copia = JSON.parse(JSON.stringify(db));
  copia.arquivos = {};
  try {
    for (const n of db.notas) if (n.arquivoId) {
      const b = await Arq.ler(n.arquivoId);
      if (b) copia.arquivos[n.arquivoId] = await blobParaDataURL(b);
    }
  } catch (e) {}
  const ok = await compartilharOuBaixar(`frigobar-backup-${hojeISO()}.json`, JSON.stringify(copia, null, 2), 'Backup Frigobar');
  if (!ok) return;
  db.ultimoBackup = hojeISO();
  salvar(); render();
  toast('Backup pronto!');
});

$('#btn-baixar-copia').addEventListener('click', async () => {
  let raw = null;
  try { raw = localStorage.getItem(CHAVE_COPIA); } catch (e) {}
  if (raw) await compartilharOuBaixar('frigobar-versao-anterior.json', raw, 'Frigobar — dados da versão anterior');
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
    const arquivos = d.arquivos || {};
    delete d.arquivos;
    db = Calc.migrar(d).db;   // aceita backups da versão anterior também
    for (const [k, u] of Object.entries(arquivos)) { try { await Arq.salvar(k, await dataURLParaBlob(u)); } catch (er) {} }
    somenteLeitura = false;
    salvar(); carrinho = {}; render();
    toast('Backup importado!');
  } catch (err) { toast('Arquivo inválido.'); }
});

$('#btn-apagar-tudo').addEventListener('click', async () => {
  if (!confirm('Apagar TODOS os produtos, vendas, entradas e notas?')) return;
  if (!confirm('Tem certeza? Não dá para desfazer.')) return;
  db = vazio(); somenteLeitura = false; salvar(); carrinho = {};
  try { for (const k of await Arq.chaves()) await Arq.apagar(k); } catch (e) {}
  render();
  toast('Tudo apagado.');
});

/* ================= Início ================= */
$('#venda-data').value = hojeISO();
$('#ent-data').value = hojeISO();
ajustarPeriodo();
render();

if (somenteLeitura) {
  $('#update-corpo').innerHTML = '<p>Não consegui ler os dados salvos neste aparelho. Nada foi apagado nem sobrescrito.</p><p>Importe um backup em <b>Mais → Configurações</b> ou fale com quem instalou o app.</p>';
  abrirModal('#modal-update');
} else if (infoMigracao && infoMigracao.migrou) {
  let jaAvisou = false;
  try { jaAvisou = !!localStorage.getItem(CHAVE_AVISO); localStorage.setItem(CHAVE_AVISO, '1'); } catch (e) {}
  if (!jaAvisou) {
    const i = infoMigracao;
    $('#update-corpo').innerHTML = `<p><b>Seus dados foram mantidos:</b></p>
      <ul><li>${i.produtos} produto${i.produtos === 1 ? '' : 's'} com o mesmo estoque</li>
      <li>${i.vendas} venda${i.vendas === 1 ? '' : 's'} (cada uma com a entrada do Pix)</li>
      <li>${i.notas} reposiç${i.notas === 1 ? 'ão' : 'ões'}, agora na aba Notas</li></ul>
      <p>Novidades: Início com lucro e ofertas, Entradas, Notas fiscais com custo médio, Conferência e Relatórios (em Mais).</p>
      <p class="txt2">Uma cópia dos dados antigos ficou guardada em Mais → Configurações.</p>`;
    abrirModal('#modal-update');
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
