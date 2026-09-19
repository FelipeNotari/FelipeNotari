/* Hangar — controle de vendas do hangar. 100% local (localStorage). */
'use strict';

const KEY = 'hangar.v1';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------------- estado ---------------- */

const PADRAO = () => ({
  produtos: [
    { id: uid(), nome: 'Coca-Cola lata', emoji: '🥤', custo: 3.00, preco: 6.00, estoque: 0 },
    { id: uid(), nome: 'Água 500ml',     emoji: '💧', custo: 1.20, preco: 3.00, estoque: 0 },
    { id: uid(), nome: 'Red Bull',       emoji: '⚡', custo: 7.50, preco: 15.00, estoque: 0 },
    { id: uid(), nome: 'Monster',        emoji: '🧃', custo: 8.00, preco: 15.00, estoque: 0 },
  ],
  vendas: [],
  compras: [],
  criadoEm: Date.now(),
});

let S = carregar();

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

function carregar() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return PADRAO();
    const d = JSON.parse(raw);
    d.produtos = d.produtos || [];
    d.vendas   = d.vendas   || [];
    d.compras  = d.compras  || [];
    return d;
  } catch (e) {
    return PADRAO();
  }
}

function salvar() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Erro ao salvar 😕'); }
}

/* ---------------- utilidades ---------------- */

const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function hojeISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
function isoParaData(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}
function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
function dataLonga(iso) {
  return cap(isoParaData(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }));
}
function dataCurta(iso) {
  return isoParaData(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function hora(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function num(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function prodPorId(id) { return S.produtos.find(p => p.id === id); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2100);
}

function vibra(ms = 8) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }

/* ---------------- agregações ---------------- */

function vendasDoDia(iso)  { return S.vendas.filter(v => v.data === iso); }
function comprasDoDia(iso) { return S.compras.filter(c => c.data === iso); }

function resumoDia(iso) {
  const v = vendasDoDia(iso), c = comprasDoDia(iso);
  const vendas = v.reduce((s, x) => s + x.total, 0);
  const custoVendido = v.reduce((s, x) => s + (x.custo || 0), 0);
  const itens  = v.reduce((s, x) => s + x.itens.reduce((a, i) => a + i.qtd, 0), 0);
  const compras = c.reduce((s, x) => s + x.total, 0);
  return { vendas, compras, itens, lucro: vendas - custoVendido, caixa: vendas - compras };
}

function resumoMes(ano, mes) { // mes 0-11
  const pref = `${ano}-${String(mes + 1).padStart(2, '0')}`;
  const v = S.vendas.filter(x => x.data.startsWith(pref));
  const c = S.compras.filter(x => x.data.startsWith(pref));
  const vendas = v.reduce((s, x) => s + x.total, 0);
  const custoVendido = v.reduce((s, x) => s + (x.custo || 0), 0);
  const compras = c.reduce((s, x) => s + x.total, 0);
  return { vendas, compras, lucro: vendas - custoVendido };
}

/* ---------------- navegação ---------------- */

let abaAtual = 'inicio';

function irPara(aba) {
  abaAtual = aba;
  $$('.screen').forEach(s => { s.hidden = s.id !== 'screen-' + aba; });
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === aba));
  render();
  const sc = $('#screen-' + aba + ' .scroll');
  if (sc) sc.scrollTop = 0;
}

$$('.tab').forEach(t => t.addEventListener('click', () => { vibra(); irPara(t.dataset.tab); }));
$$('[data-go]').forEach(b => b.addEventListener('click', () => irPara(b.dataset.go)));

/* ---------------- sheet (modal) ---------------- */

function abrirSheet(html) {
  $('#sheet-body').innerHTML = html;
  $('#sheet-wrap').hidden = false;
  document.body.style.overflow = 'hidden';
}
function fecharSheet() {
  $('#sheet-wrap').hidden = true;
  $('#sheet-body').innerHTML = '';
  document.body.style.overflow = '';
}
$('#sheet-bg').addEventListener('click', fecharSheet);

/* ---------------- INÍCIO ---------------- */

function renderInicio() {
  const iso = hojeISO();
  const d = resumoDia(iso);
  $('#hoje-label').textContent = dataLonga(iso);
  $('#hero-vendas').textContent = brl(d.vendas);
  $('#hero-lucro').textContent  = brl(d.lucro);
  $('#hero-itens').textContent  = d.itens;
  $('#hero-custos').textContent = brl(d.compras);

  const hoje = new Date();
  const m = resumoMes(hoje.getFullYear(), hoje.getMonth());
  $('#mes-vendas').textContent = brl(m.vendas);
  $('#mes-custos').textContent = brl(m.compras);
  $('#mes-lucro').textContent  = brl(m.lucro);

  const unid = S.produtos.reduce((s, p) => s + p.estoque, 0);
  $('#est-unid').textContent  = unid;
  $('#est-custo').textContent = brl(S.produtos.reduce((s, p) => s + p.estoque * p.custo, 0));
  $('#est-venda').textContent = brl(S.produtos.reduce((s, p) => s + p.estoque * p.preco, 0));

  const baixos = S.produtos.filter(p => p.estoque <= 3);
  $('#alertas').innerHTML = baixos.length
    ? `<div class="alerta"><span>⚠️</span><div><b>Estoque baixo:</b> ${baixos.map(p => `${p.nome} (${p.estoque})`).join(', ')}</div></div>`
    : '';

  const ult = [...S.vendas].sort((a, b) => b.ts - a.ts).slice(0, 6);
  $('#ultimas').innerHTML = ult.length
    ? ult.map(v => `
        <button class="row" data-venda="${v.id}">
          <div class="emo">🧾</div>
          <div class="mid">
            <div class="nome">${v.itens.map(i => `${i.qtd}× ${esc(i.nome)}`).join(', ')}</div>
            <div class="sub">${dataCurta(v.data)} · ${hora(v.ts)}</div>
          </div>
          <div class="val"><b>${brl(v.total)}</b><small>lucro ${brl(v.total - (v.custo || 0))}</small></div>
        </button>`).join('')
    : `<div class="empty">Nenhuma venda ainda.<br>Toque em <b>Vender</b> para começar.</div>`;

  $$('#ultimas [data-venda]').forEach(b =>
    b.addEventListener('click', () => sheetVenda(b.dataset.venda)));
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- VENDER ---------------- */

let carrinho = {}; // id -> qtd

function renderVender() {
  const g = $('#grid-produtos');
  if (!S.produtos.length) {
    g.innerHTML = `<div class="empty" style="grid-column:1/-1">Cadastre seus produtos primeiro na aba <b>Produtos</b>.</div>`;
  } else {
    g.innerHTML = S.produtos.map(p => {
      const q = carrinho[p.id] || 0;
      return `
      <button class="tile ${q ? 'sel' : ''} ${p.estoque <= 0 ? 'zero' : ''}" data-add="${p.id}">
        ${q ? `<span class="badge">${q}</span>` : ''}
        <div>
          <div class="t-emo">${p.emoji || '🥤'}</div>
          <div class="t-nome">${esc(p.nome)}</div>
        </div>
        <div>
          <div class="t-preco">${brl(p.preco)}</div>
          <div class="t-est">${p.estoque} un. em estoque</div>
        </div>
        ${q ? `<span class="minus" data-sub="${p.id}">−</span>` : ''}
      </button>`;
    }).join('');
  }

  $$('#grid-produtos [data-add]').forEach(el => el.addEventListener('click', e => {
    const sub = e.target.closest('[data-sub]');
    if (sub) { e.stopPropagation(); mudarCarrinho(sub.dataset.sub, -1); return; }
    mudarCarrinho(el.dataset.add, +1);
  }));

  atualizarCarrinho();
}

function mudarCarrinho(id, delta) {
  const p = prodPorId(id);
  if (!p) return;
  const atual = carrinho[id] || 0;
  const novo = atual + delta;
  if (novo > p.estoque) { toast(`Só tem ${p.estoque} un. de ${p.nome}`); vibra(30); return; }
  if (novo <= 0) delete carrinho[id]; else carrinho[id] = novo;
  vibra();
  renderVender();
}

function totalCarrinho() {
  return Object.entries(carrinho).reduce((s, [id, q]) => {
    const p = prodPorId(id); return s + (p ? p.preco * q : 0);
  }, 0);
}

function atualizarCarrinho() {
  const qtd = Object.values(carrinho).reduce((a, b) => a + b, 0);
  const c = $('#cart');
  c.hidden = qtd === 0;
  $('#cart-qtd').textContent = qtd === 1 ? '1 item' : `${qtd} itens`;
  $('#cart-total').textContent = brl(totalCarrinho());
}

$('#btn-limpar-carrinho').addEventListener('click', () => {
  carrinho = {}; renderVender(); toast('Carrinho limpo');
});

$('#btn-confirmar').addEventListener('click', () => {
  const itens = Object.entries(carrinho).map(([id, qtd]) => {
    const p = prodPorId(id);
    return { produtoId: id, nome: p.nome, qtd, preco: p.preco, custo: p.custo };
  });
  if (!itens.length) return;

  const total = itens.reduce((s, i) => s + i.preco * i.qtd, 0);
  const custo = itens.reduce((s, i) => s + i.custo * i.qtd, 0);

  S.vendas.push({ id: uid(), ts: Date.now(), data: hojeISO(), itens, total, custo });
  itens.forEach(i => { const p = prodPorId(i.produtoId); if (p) p.estoque = Math.max(0, p.estoque - i.qtd); });
  salvar();

  carrinho = {};
  vibra(24);
  toast(`Venda de ${brl(total)} registrada ✅`);
  irPara('inicio');
});

/* ---------------- PRODUTOS ---------------- */

function renderProdutos() {
  const l = $('#lista-produtos');
  if (!S.produtos.length) {
    l.innerHTML = `<div class="empty">Nenhum produto.<br>Toque no <b>+</b> para adicionar.</div>`;
    return;
  }
  l.innerHTML = S.produtos.map(p => {
    const margem = p.preco - p.custo;
    return `
    <button class="row" data-prod="${p.id}">
      <div class="emo">${p.emoji || '🥤'}</div>
      <div class="mid">
        <div class="nome">${esc(p.nome)}</div>
        <div class="sub">Custo ${brl(p.custo)} · Lucro ${brl(margem)}/un.</div>
      </div>
      <div class="val">
        <b>${brl(p.preco)}</b>
        <small><span class="pill ${p.estoque <= 3 ? 'low' : 'ok'}">${p.estoque} un.</span></small>
      </div>
    </button>`;
  }).join('');
  $$('#lista-produtos [data-prod]').forEach(b =>
    b.addEventListener('click', () => sheetProduto(b.dataset.prod)));
}

const EMOJIS = ['🥤', '💧', '⚡', '🧃', '🍺', '☕', '🧊', '🍫', '🍪', '🥨', '🍬', '🧀'];

function sheetProduto(id) {
  const p = id ? prodPorId(id) : null;
  const novo = !p;
  const e = p ? p.emoji : '🥤';
  abrirSheet(`
    <h2>${novo ? 'Novo produto' : 'Editar produto'}</h2>
    <p class="sub">${novo ? 'Preencha os dados da bebida.' : 'Altere o que precisar e salve.'}</p>

    <div class="field">
      <label>Nome</label>
      <input id="f-nome" type="text" placeholder="Ex: Coca-Cola lata" value="${p ? esc(p.nome) : ''}">
    </div>

    <div class="field">
      <label>Ícone</label>
      <div class="emo-pick" id="f-emo">
        ${EMOJIS.map(x => `<button type="button" data-e="${x}" class="${x === e ? 'sel' : ''}">${x}</button>`).join('')}
      </div>
    </div>

    <div class="row2">
      <div class="field">
        <label>Custo por unidade</label>
        <input id="f-custo" type="text" inputmode="decimal" placeholder="0,00" value="${p ? String(p.custo).replace('.', ',') : ''}">
      </div>
      <div class="field">
        <label>Preço de venda</label>
        <input id="f-preco" type="text" inputmode="decimal" placeholder="0,00" value="${p ? String(p.preco).replace('.', ',') : ''}">
      </div>
    </div>

    <div class="field">
      <label>Estoque atual (unidades)</label>
      <input id="f-estoque" type="text" inputmode="numeric" placeholder="0" value="${p ? p.estoque : ''}">
    </div>
    <p class="mini">Dica: para repor estoque e lançar o custo do dia, use <b>Registrar compra</b>.</p>

    <div class="sheet-actions">
      <button class="btn-primary full" id="f-salvar">Salvar</button>
      ${novo ? '' : `<button class="btn-ghost" id="f-comprar">Registrar compra deste produto</button>
                     <button class="btn-danger" id="f-excluir">Excluir produto</button>`}
    </div>
  `);

  let emo = e;
  $$('#f-emo button').forEach(b => b.addEventListener('click', () => {
    emo = b.dataset.e;
    $$('#f-emo button').forEach(x => x.classList.toggle('sel', x === b));
  }));

  $('#f-salvar').addEventListener('click', () => {
    const nome = $('#f-nome').value.trim();
    if (!nome) { toast('Dê um nome ao produto'); return; }
    const custo = num($('#f-custo').value);
    const preco = num($('#f-preco').value);
    const estoque = Math.max(0, Math.round(num($('#f-estoque').value)));
    if (novo) S.produtos.push({ id: uid(), nome, emoji: emo, custo, preco, estoque });
    else Object.assign(p, { nome, emoji: emo, custo, preco, estoque });
    salvar(); fecharSheet(); render();
    toast(novo ? 'Produto adicionado' : 'Produto atualizado');
  });

  if (!novo) {
    $('#f-comprar').addEventListener('click', () => sheetCompra(p.id));
    $('#f-excluir').addEventListener('click', () => {
      if (!confirm(`Excluir "${p.nome}"? O histórico de vendas é mantido.`)) return;
      S.produtos = S.produtos.filter(x => x.id !== p.id);
      delete carrinho[p.id];
      salvar(); fecharSheet(); render();
      toast('Produto excluído');
    });
  }
}

$('#btn-add-produto').addEventListener('click', () => sheetProduto(null));

/* ---------------- COMPRA (custo + entrada de estoque) ---------------- */

function sheetCompra(produtoId) {
  if (!S.produtos.length) { toast('Cadastre um produto primeiro'); irPara('produtos'); return; }
  const sel = produtoId || S.produtos[0].id;
  abrirSheet(`
    <h2>Registrar compra</h2>
    <p class="sub">Entra no estoque e conta como custo do dia.</p>

    <div class="field">
      <label>Produto</label>
      <select id="c-prod">
        ${S.produtos.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
      </select>
    </div>

    <div class="row2">
      <div class="field">
        <label>Quantidade (un.)</label>
        <input id="c-qtd" type="text" inputmode="numeric" placeholder="12">
      </div>
      <div class="field">
        <label>Custo por unidade</label>
        <input id="c-custo" type="text" inputmode="decimal" placeholder="0,00">
      </div>
    </div>

    <div class="field">
      <label>Data da compra</label>
      <input id="c-data" type="date" value="${hojeISO()}">
    </div>

    <div class="card stat-card" style="margin-top:4px">
      <div class="stat total"><span>Total da compra</span><b id="c-total">R$ 0,00</b></div>
    </div>

    <div class="sheet-actions">
      <button class="btn-primary full" id="c-salvar">Registrar compra</button>
      <button class="btn-ghost" id="c-cancel">Cancelar</button>
    </div>
  `);

  const preencheCusto = () => {
    const p = prodPorId($('#c-prod').value);
    if (p && !$('#c-custo').value) $('#c-custo').value = String(p.custo).replace('.', ',');
    calc();
  };
  const calc = () => {
    const t = Math.max(0, Math.round(num($('#c-qtd').value))) * num($('#c-custo').value);
    $('#c-total').textContent = brl(t);
  };

  $('#c-prod').addEventListener('change', () => { $('#c-custo').value = ''; preencheCusto(); });
  $('#c-qtd').addEventListener('input', calc);
  $('#c-custo').addEventListener('input', calc);
  preencheCusto();

  $('#c-cancel').addEventListener('click', fecharSheet);
  $('#c-salvar').addEventListener('click', () => {
    const p = prodPorId($('#c-prod').value);
    const qtd = Math.max(0, Math.round(num($('#c-qtd').value)));
    const custo = num($('#c-custo').value);
    const data = $('#c-data').value || hojeISO();
    if (!p || qtd <= 0) { toast('Informe a quantidade'); return; }

    S.compras.push({
      id: uid(), ts: Date.now(), data,
      produtoId: p.id, nome: p.nome, qtd, custoUnit: custo, total: qtd * custo,
    });
    p.estoque += qtd;
    if (custo > 0) p.custo = custo; // mantém o custo mais recente
    salvar(); fecharSheet(); render();
    vibra(24);
    toast(`+${qtd} un. de ${p.nome} · ${brl(qtd * custo)}`);
  });
}

$('#q-compra').addEventListener('click', () => sheetCompra(null));

/* ---------------- AGENDA / CALENDÁRIO ---------------- */

let calRef = new Date();

function renderAgenda() {
  const ano = calRef.getFullYear(), mes = calRef.getMonth();
  $('#mes-nome').textContent = cap(calRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));

  const m = resumoMes(ano, mes);
  $('#cal-vendas').textContent = brl(m.vendas);
  $('#cal-custos').textContent = brl(m.compras);
  $('#cal-lucro').textContent  = brl(m.lucro);

  const primeiro = new Date(ano, mes, 1).getDay();
  const dias = new Date(ano, mes + 1, 0).getDate();
  const iso0 = hojeISO();
  let html = '';
  for (let i = 0; i < primeiro; i++) html += `<div class="day out"></div>`;
  for (let d = 1; d <= dias; d++) {
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const r = resumoDia(iso);
    const tem = r.vendas > 0 || r.compras > 0;
    html += `
      <button class="day ${tem ? 'tem' : ''} ${iso === iso0 ? 'hoje' : ''}" data-dia="${iso}">
        <span>${d}</span>
        <span class="dots">
          ${r.vendas > 0 ? '<i class="dot sale"></i>' : ''}
          ${r.compras > 0 ? '<i class="dot cost"></i>' : ''}
        </span>
      </button>`;
  }
  $('#cal-grid').innerHTML = html;
  $$('#cal-grid [data-dia]').forEach(b => b.addEventListener('click', () => sheetDia(b.dataset.dia)));
}

$('#mes-prev').addEventListener('click', () => { calRef = new Date(calRef.getFullYear(), calRef.getMonth() - 1, 1); renderAgenda(); });
$('#mes-next').addEventListener('click', () => { calRef = new Date(calRef.getFullYear(), calRef.getMonth() + 1, 1); renderAgenda(); });

function sheetDia(iso) {
  const r = resumoDia(iso);
  const vs = vendasDoDia(iso).sort((a, b) => b.ts - a.ts);
  const cs = comprasDoDia(iso).sort((a, b) => b.ts - a.ts);

  abrirSheet(`
    <h2>${dataLonga(iso)}</h2>
    <p class="sub">${vs.length} venda(s) · ${cs.length} compra(s)</p>

    <div class="card stat-card">
      <div class="stat"><span>Vendas</span><b>${brl(r.vendas)}</b></div>
      <div class="stat"><span>Compras</span><b class="neg">${brl(r.compras)}</b></div>
      <div class="stat"><span>Lucro das vendas</span><b>${brl(r.lucro)}</b></div>
      <div class="stat total"><span>Caixa do dia</span><b class="${r.caixa < 0 ? 'neg' : ''}">${brl(r.caixa)}</b></div>
    </div>

    <div class="section-title" style="margin-left:0">Vendas</div>
    <div class="card" style="padding:4px 16px">
      ${vs.length ? vs.map(v => `
        <div class="linha-item">
          <div class="li-mid">
            <div>${v.itens.map(i => `${i.qtd}× ${esc(i.nome)}`).join(', ')}</div>
            <div class="li-sub">${hora(v.ts)} · lucro ${brl(v.total - (v.custo || 0))}</div>
          </div>
          <b>${brl(v.total)}</b>
          <button class="x" data-del-venda="${v.id}">excluir</button>
        </div>`).join('') : `<div class="empty" style="padding:16px">Sem vendas.</div>`}
    </div>

    <div class="section-title" style="margin-left:0">Compras</div>
    <div class="card" style="padding:4px 16px">
      ${cs.length ? cs.map(c => `
        <div class="linha-item">
          <div class="li-mid">
            <div>${c.qtd}× ${esc(c.nome)}</div>
            <div class="li-sub">${brl(c.custoUnit)} por unidade</div>
          </div>
          <b class="neg">${brl(c.total)}</b>
          <button class="x" data-del-compra="${c.id}">excluir</button>
        </div>`).join('') : `<div class="empty" style="padding:16px">Sem compras.</div>`}
    </div>

    <div class="sheet-actions">
      <button class="btn-ghost" id="d-fechar">Fechar</button>
    </div>
  `);

  $('#d-fechar').addEventListener('click', fecharSheet);

  $$('[data-del-venda]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Excluir esta venda? O estoque será devolvido.')) return;
    const v = S.vendas.find(x => x.id === b.dataset.delVenda);
    if (v) v.itens.forEach(i => { const p = prodPorId(i.produtoId); if (p) p.estoque += i.qtd; });
    S.vendas = S.vendas.filter(x => x.id !== b.dataset.delVenda);
    salvar(); render(); sheetDia(iso); toast('Venda excluída');
  }));

  $$('[data-del-compra]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Excluir esta compra? O estoque será reduzido.')) return;
    const c = S.compras.find(x => x.id === b.dataset.delCompra);
    if (c) { const p = prodPorId(c.produtoId); if (p) p.estoque = Math.max(0, p.estoque - c.qtd); }
    S.compras = S.compras.filter(x => x.id !== b.dataset.delCompra);
    salvar(); render(); sheetDia(iso); toast('Compra excluída');
  }));
}

function sheetVenda(id) {
  const v = S.vendas.find(x => x.id === id);
  if (!v) return;
  abrirSheet(`
    <h2>Venda</h2>
    <p class="sub">${dataLonga(v.data)} · ${hora(v.ts)}</p>
    <div class="card" style="padding:4px 16px">
      ${v.itens.map(i => `
        <div class="linha-item">
          <div class="li-mid"><div>${i.qtd}× ${esc(i.nome)}</div><div class="li-sub">${brl(i.preco)} cada</div></div>
          <b>${brl(i.preco * i.qtd)}</b>
        </div>`).join('')}
    </div>
    <div class="card stat-card" style="margin-top:12px">
      <div class="stat"><span>Custo</span><b class="neg">${brl(v.custo || 0)}</b></div>
      <div class="stat"><span>Lucro</span><b>${brl(v.total - (v.custo || 0))}</b></div>
      <div class="stat total"><span>Total</span><b>${brl(v.total)}</b></div>
    </div>
    <div class="sheet-actions">
      <button class="btn-danger" id="v-del">Excluir venda</button>
      <button class="btn-ghost" id="v-fechar">Fechar</button>
    </div>
  `);
  $('#v-fechar').addEventListener('click', fecharSheet);
  $('#v-del').addEventListener('click', () => {
    if (!confirm('Excluir esta venda? O estoque será devolvido.')) return;
    v.itens.forEach(i => { const p = prodPorId(i.produtoId); if (p) p.estoque += i.qtd; });
    S.vendas = S.vendas.filter(x => x.id !== v.id);
    salvar(); fecharSheet(); render(); toast('Venda excluída');
  });
}

/* ---------------- AJUSTES / BACKUP ---------------- */

$('#btn-ajustes').addEventListener('click', () => {
  abrirSheet(`
    <h2>Ajustes</h2>
    <p class="sub">Seus dados ficam salvos só neste iPhone.</p>
    <div class="card stat-card">
      <div class="stat"><span>Produtos</span><b>${S.produtos.length}</b></div>
      <div class="stat"><span>Vendas registradas</span><b>${S.vendas.length}</b></div>
      <div class="stat"><span>Compras registradas</span><b>${S.compras.length}</b></div>
    </div>
    <div class="sheet-actions">
      <button class="btn-primary full" id="a-export">Exportar backup (arquivo)</button>
      <button class="btn-ghost" id="a-import">Importar backup</button>
      <button class="btn-danger" id="a-zerar">Apagar todos os dados</button>
      <button class="btn-ghost" id="a-fechar">Fechar</button>
    </div>
    <input type="file" id="a-file" accept="application/json,.json" hidden>
  `);

  $('#a-fechar').addEventListener('click', fecharSheet);

  $('#a-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hangar-backup-${hojeISO()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Backup gerado');
  });

  $('#a-import').addEventListener('click', () => $('#a-file').click());
  $('#a-file').addEventListener('change', ev => {
    const f = ev.target.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        if (!d || !Array.isArray(d.produtos)) throw new Error('inválido');
        S = { produtos: d.produtos, vendas: d.vendas || [], compras: d.compras || [], criadoEm: d.criadoEm || Date.now() };
        salvar(); fecharSheet(); render(); toast('Backup restaurado ✅');
      } catch (e) { toast('Arquivo inválido'); }
    };
    fr.readAsText(f);
  });

  $('#a-zerar').addEventListener('click', () => {
    if (!confirm('Apagar TODOS os produtos, vendas e compras? Não dá para desfazer.')) return;
    S = { produtos: [], vendas: [], compras: [], criadoEm: Date.now() };
    salvar(); fecharSheet(); render(); toast('Tudo apagado');
  });
});

/* ---------------- render geral ---------------- */

function render() {
  if (abaAtual === 'inicio')   renderInicio();
  if (abaAtual === 'vender')   renderVender();
  if (abaAtual === 'produtos') renderProdutos();
  if (abaAtual === 'agenda')   renderAgenda();
}

irPara('inicio');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
