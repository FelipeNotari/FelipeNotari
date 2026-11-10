'use strict';
/* Comtai — finanças pessoais. Dados salvos só no aparelho (localStorage). */

const CHAVE = 'comtai.v1';
const CORES = ['#5B4BDB', '#0A84FF', '#12A150', '#E5484D', '#FF8A00', '#E0368C', '#8E44AD', '#0B7A8C', '#C9A227', '#1C1B29'];
const EMOJIS = ['🛒','🍔','🍕','☕','🏠','💡','💧','📱','🚗','⛽','🚌','✈️','💊','🏥','🎓','📚','👕','💄','🎮','🎬','🎁','🐶','👶','💪',
  '🏖️','🍺','💳','🧾','🔧','🧹','💰','💼','📈','🏦','💵','🪙','🎯','❤️','⭐','📦','🛍️','🍰','🧸','🌱','🙏','💻','🎵','📌'];

const PADRAO = () => ({
  versao: 1, nome: '', moeda: 'R$', cor: '#5B4BDB', tema: 'auto', esconder: false, iniciado: false, ultimoBackup: null,
  categorias: [
    { id: 'c1', nome: 'Mercado', emoji: '🛒', cor: '#12A150', tipo: 'd', limite: 0 },
    { id: 'c2', nome: 'Comida', emoji: '🍔', cor: '#FF8A00', tipo: 'd', limite: 0 },
    { id: 'c3', nome: 'Casa', emoji: '🏠', cor: '#0A84FF', tipo: 'd', limite: 0 },
    { id: 'c4', nome: 'Contas', emoji: '💡', cor: '#C9A227', tipo: 'd', limite: 0 },
    { id: 'c5', nome: 'Transporte', emoji: '🚗', cor: '#0B7A8C', tipo: 'd', limite: 0 },
    { id: 'c6', nome: 'Saúde', emoji: '💊', cor: '#E5484D', tipo: 'd', limite: 0 },
    { id: 'c7', nome: 'Lazer', emoji: '🎬', cor: '#8E44AD', tipo: 'd', limite: 0 },
    { id: 'c8', nome: 'Compras', emoji: '🛍️', cor: '#E0368C', tipo: 'd', limite: 0 },
    { id: 'c9', nome: 'Outros', emoji: '📦', cor: '#6E6C85', tipo: 'd', limite: 0 },
    { id: 'r1', nome: 'Salário', emoji: '💼', cor: '#12A150', tipo: 'r', limite: 0 },
    { id: 'r2', nome: 'Extra', emoji: '💰', cor: '#0A84FF', tipo: 'r', limite: 0 },
    { id: 'r3', nome: 'Outros', emoji: '🪙', cor: '#6E6C85', tipo: 'r', limite: 0 }
  ],
  contas: [
    { id: 'k1', nome: 'Carteira', emoji: '💵', saldoInicial: 0 },
    { id: 'k2', nome: 'Banco', emoji: '🏦', saldoInicial: 0 }
  ],
  lancs: [],   // {id, tipo:'d'|'r', valor(centavos), cat, conta, data:'AAAA-MM-DD', desc, fixo}
  fixos: [],   // {id, tipo, valor, cat, conta, dia, desc, inicio:'AAAA-MM', ultimo:'AAAA-MM'}
  metas: []    // {id, nome, emoji, cor, alvo, guardado}
});

/* ---------- Estado e armazenamento ---------- */
let D = carregar();
let tela = 'inicio';
let mesVisto = mesAtual();
let filtroCat = '';
let busca = '';

function carregar() {
  try {
    const t = localStorage.getItem(CHAVE);
    if (t) return Object.assign(PADRAO(), JSON.parse(t));
  } catch (e) { /* segue com o padrão */ }
  return PADRAO();
}
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(D)); }
  catch (e) { avisar('⚠️ Não foi possível salvar'); }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- Utilidades ---------- */
const $ = s => document.querySelector(s);
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function hoje() { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
function mesAtual() { return hoje().slice(0, 7); }
function p2(n) { return String(n).padStart(2, '0'); }
function somaMes(m, n) { let [a, b] = m.split('-').map(Number); b += n; while (b > 12) { b -= 12; a++; } while (b < 1) { b += 12; a--; } return `${a}-${p2(b)}`; }
function nomeMes(m) { const [a, b] = m.split('-').map(Number); return new Date(a, b - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }
function nomeDia(d) {
  if (d === hoje()) return 'Hoje';
  const o = new Date(); o.setDate(o.getDate() - 1);
  if (d === `${o.getFullYear()}-${p2(o.getMonth() + 1)}-${p2(o.getDate())}`) return 'Ontem';
  const [a, b, c] = d.split('-').map(Number);
  return new Date(a, b - 1, c).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
}
const fmtN = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function din(c, sinal) {
  const s = (sinal && c > 0 ? '+ ' : '') + (c < 0 ? '- ' : '') + D.moeda + ' ' + fmtN.format(Math.abs(c) / 100);
  return `<span class="din">${s}</span>`;
}
function lerValor(txt) {
  let t = String(txt || '').trim().replace(/[^\d.,]/g, '');
  if (!t) return 0;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
  const n = Math.round(parseFloat(t) * 100);
  return isFinite(n) && n > 0 ? n : 0;
}
const valorTxt = c => c ? fmtN.format(c / 100) : '';
const cat = i => D.categorias.find(c => c.id === i) || { nome: 'Sem categoria', emoji: '❔', cor: '#6E6C85' };
const conta = i => D.contas.find(c => c.id === i) || { nome: '—', emoji: '💳' };
let tAviso;
function avisar(t) { const a = $('#aviso'); a.textContent = t; a.hidden = false; clearTimeout(tAviso); tAviso = setTimeout(() => a.hidden = true, 2200); }

/* ---------- Lançamentos fixos (repetem todo mês) ---------- */
function gerarFixos() {
  const h = hoje(), mAt = mesAtual();
  let mudou = false;
  for (const f of D.fixos) {
    let m = f.ultimo ? somaMes(f.ultimo, 1) : f.inicio;
    while (m <= mAt) {
      const [a, b] = m.split('-').map(Number);
      const ult = new Date(a, b, 0).getDate();
      const data = `${m}-${p2(Math.min(f.dia, ult))}`;
      if (data > h) break;
      D.lancs.push({ id: id(), tipo: f.tipo, valor: f.valor, cat: f.cat, conta: f.conta, data, desc: f.desc, fixo: f.id });
      f.ultimo = m; mudou = true;
      m = somaMes(m, 1);
    }
  }
  if (mudou) salvar();
}

/* ---------- Tema ---------- */
function aplicarTema() {
  const r = document.documentElement;
  r.style.setProperty('--cor', D.cor);
  const escuro = D.tema === 'escuro' || (D.tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  r.dataset.tema = escuro ? 'escuro' : 'claro';
  document.querySelector('meta[name=theme-color]').content = D.cor;
  document.body.classList.toggle('escondido', !!D.esconder);
  $('#btn-olho').textContent = D.esconder ? '🙈' : '👁';
  const hr = new Date().getHours();
  const sauda = hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite';
  $('#ola').textContent = D.nome ? `${sauda}, ${D.nome}!` : `${sauda}!`;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', aplicarTema);

/* ---------- Cálculos ---------- */
const doMes = m => D.lancs.filter(l => l.data.startsWith(m));
function totais(ls) {
  let r = 0, d = 0;
  for (const l of ls) l.tipo === 'r' ? r += l.valor : d += l.valor;
  return { r, d, s: r - d };
}
function saldoConta(k) {
  const h = hoje();
  return D.lancs.reduce((s, l) => l.conta === k.id && l.data <= h ? s + (l.tipo === 'r' ? l.valor : -l.valor) : s, k.saldoInicial || 0);
}
const saldoTotal = () => D.contas.reduce((s, k) => s + saldoConta(k), 0);

/* ---------- Telas ---------- */
const TITULOS = { inicio: 'Início', extrato: 'Extrato', metas: 'Metas', ajustes: 'Ajustes' };
function render() {
  aplicarTema();
  $('#titulo').textContent = TITULOS[tela];
  document.querySelectorAll('.abas button').forEach(b => b.classList.toggle('ativa', b.dataset.tela === tela));
  $('#fab').hidden = tela === 'ajustes';
  $('#main').innerHTML = ({ inicio: telaInicio, extrato: telaExtrato, metas: telaMetas, ajustes: telaAjustes })[tela]();
}

function seletorMes() {
  return `<div class="mes"><button data-a="mes" data-n="-1">‹</button><div class="nome">${nomeMes(mesVisto)}</div><button data-a="mes" data-n="1">›</button></div>`;
}

function itemLanc(l) {
  const c = cat(l.cat);
  return `<div class="item" data-a="editar" data-id="${l.id}">
    <div class="bola" style="background:${c.cor}22">${c.emoji}</div>
    <div class="meio"><div class="nome">${esc(l.desc || c.nome)}</div><div class="sub">${esc(c.nome)} · ${esc(conta(l.conta).nome)}${l.fixo ? ' · 🔁' : ''}</div></div>
    <div class="valor ${l.tipo === 'r' ? 'pos' : 'neg'}">${din(l.tipo === 'r' ? l.valor : -l.valor)}</div>
  </div>`;
}

function telaInicio() {
  const ls = doMes(mesVisto), t = totais(ls);
  let h = seletorMes();
  h += `<div class="card hero">
    <div class="lbl">Saldo de ${nomeMes(mesVisto).split(' ')[0]}</div>
    <div class="grande">${din(t.s)}</div>
    <div class="linha2"><div class="mini">⬆ Entrou<b>${din(t.r)}</b></div><div class="mini">⬇ Saiu<b>${din(t.d)}</b></div></div>
  </div>`;

  if (!D.lancs.length) h += `<div class="dica">👋 Toque no <b>+</b> para lançar seu primeiro gasto ou ganho. Em <b>Ajustes</b> você muda cores, categorias, contas e tudo mais.</div>`;
  else if (D.ultimoBackup ? Date.now() - D.ultimoBackup > 30 * 864e5 : D.lancs.length >= 15) h += `<div class="dica" data-a="backup">💾 Faz tempo que você não guarda uma cópia dos dados. <b>Toque aqui para salvar um backup.</b></div>`;

  // Contas
  h += `<h3>Minhas contas · ${din(saldoTotal())}</h3><div class="card">`;
  h += D.contas.map(k => `<div class="item" data-a="conta" data-id="${k.id}"><div class="bola" style="background:var(--linha)">${k.emoji}</div><div class="meio"><div class="nome">${esc(k.nome)}</div></div><div class="valor">${din(saldoConta(k))}</div></div>`).join('') || '<div class="vazio">Nenhuma conta</div>';
  h += `</div>`;

  // Gastos por categoria
  const porCat = {};
  ls.filter(l => l.tipo === 'd').forEach(l => porCat[l.cat] = (porCat[l.cat] || 0) + l.valor);
  const lista = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  if (lista.length) {
    const max = lista[0][1];
    h += `<h3>Para onde foi o dinheiro</h3><div class="card">`;
    h += lista.map(([ci, v]) => {
      const c = cat(ci), lim = c.limite || 0;
      const pct = lim ? Math.min(100, v / lim * 100) : v / max * 100;
      const cor = lim && v > lim ? 'var(--vermelho)' : c.cor;
      return `<div class="item" style="display:block" data-a="filtrar" data-id="${ci}">
        <div style="display:flex;align-items:center;gap:10px"><div class="bola" style="background:${c.cor}22;width:32px;height:32px;font-size:16px">${c.emoji}</div>
        <div class="meio" style="flex:1"><div class="nome">${esc(c.nome)}</div></div>
        <div style="text-align:right"><div class="valor">${din(v)}</div>${lim ? `<div class="sub ${v > lim ? 'neg' : ''}">de ${din(lim)}</div>` : `<div class="sub">${Math.round(v / t.d * 100)}%</div>`}</div></div>
        <div class="barra"><i style="width:${pct}%;background:${cor}"></i></div></div>`;
    }).join('');
    h += `</div>`;
  }

  // Últimos
  const ult = ls.slice().sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id)).slice(0, 5);
  if (ult.length) h += `<h3>Últimos lançamentos</h3><div class="card">${ult.map(itemLanc).join('')}</div>`;
  return h;
}

function telaExtrato() {
  let ls = doMes(mesVisto);
  if (filtroCat) ls = ls.filter(l => l.cat === filtroCat);
  if (busca) { const b = busca.toLowerCase(); ls = ls.filter(l => (l.desc + ' ' + cat(l.cat).nome).toLowerCase().includes(b)); }
  ls.sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  const t = totais(ls);
  let h = seletorMes();
  h += `<input class="busca" id="busca" type="search" placeholder="🔎 Buscar" value="${esc(busca)}">`;
  const usadas = [...new Set(doMes(mesVisto).map(l => l.cat))];
  h += `<div class="chips"><button class="chip ${!filtroCat ? 'sel' : ''}" data-a="filtrar" data-id="">Todas</button>${usadas.map(ci => `<button class="chip ${filtroCat === ci ? 'sel' : ''}" data-a="filtrar" data-id="${ci}">${cat(ci).emoji} ${esc(cat(ci).nome)}</button>`).join('')}</div>`;
  h += `<div class="card" style="display:flex;justify-content:space-around;text-align:center;font-size:13px"><div>Entrou<br><b class="pos">${din(t.r)}</b></div><div>Saiu<br><b class="neg">${din(t.d)}</b></div><div>Saldo<br><b>${din(t.s)}</b></div></div>`;
  if (!ls.length) return h + `<div class="vazio">Nada por aqui neste mês.</div>`;
  let dia = '';
  let bloco = '';
  for (const l of ls) {
    if (l.data !== dia) { if (bloco) h += bloco + '</div>'; dia = l.data; h += `<div class="dia">${nomeDia(dia)}</div>`; bloco = '<div class="card" style="padding:4px 14px">'; }
    bloco += itemLanc(l);
  }
  return h + bloco + '</div>';
}

function telaMetas() {
  let h = `<h3>Objetivos (guardar dinheiro)</h3>`;
  if (!D.metas.length) h += `<div class="card vazio">Crie um objetivo, como “Viagem” ou “Reserva de emergência”, e acompanhe quanto já guardou.</div>`;
  h += D.metas.map(m => {
    const pct = m.alvo ? Math.min(100, m.guardado / m.alvo * 100) : 0;
    return `<div class="card" data-a="meta" data-id="${m.id}">
      <div style="display:flex;align-items:center;gap:12px"><div class="bola" style="background:${m.cor}22">${m.emoji}</div>
      <div style="flex:1"><div style="font-weight:700">${esc(m.nome)}</div><div class="sub" style="color:var(--suave);font-size:13px">${din(m.guardado)} de ${din(m.alvo)}</div></div>
      <div style="font-weight:800;color:${m.cor}">${Math.round(pct)}%</div></div>
      <div class="barra" style="height:10px"><i style="width:${pct}%;background:${m.cor}"></i></div></div>`;
  }).join('');
  h += `<button class="botao sec" data-a="meta" data-id="">＋ Novo objetivo</button>`;

  h += `<h3>Limite de gastos por mês</h3><div class="card">`;
  const gastos = {};
  doMes(mesAtual()).filter(l => l.tipo === 'd').forEach(l => gastos[l.cat] = (gastos[l.cat] || 0) + l.valor);
  h += D.categorias.filter(c => c.tipo === 'd').map(c => {
    const g = gastos[c.id] || 0, lim = c.limite || 0;
    return `<div class="item" style="display:block" data-a="limite" data-id="${c.id}">
      <div style="display:flex;align-items:center;gap:10px"><div class="bola" style="background:${c.cor}22;width:32px;height:32px;font-size:16px">${c.emoji}</div>
      <div style="flex:1;font-weight:600">${esc(c.nome)}</div>
      <div style="text-align:right;font-size:14px">${lim ? `${din(g)} <span style="color:var(--suave)">/ ${din(lim)}</span>` : `<span style="color:var(--suave)">Definir ›</span>`}</div></div>
      ${lim ? `<div class="barra"><i style="width:${Math.min(100, g / lim * 100)}%;background:${g > lim ? 'var(--vermelho)' : c.cor}"></i></div>` : ''}</div>`;
  }).join('');
  return h + `</div>`;
}

function telaAjustes() {
  const op = (a, ic, t, s) => `<button class="opcao" data-a="${a}"><div class="bola" style="background:var(--linha)">${ic}</div><div class="meio"><div style="font-weight:600">${t}</div>${s ? `<div style="font-size:13px;color:var(--suave)">${s}</div>` : ''}</div><span class="seta">›</span></button>`;
  const temas = { auto: 'Automático', claro: 'Claro', escuro: 'Escuro' };
  return `
  <h3>Personalizar</h3><div class="card">
    ${op('perfil', '🙂', 'Seu nome e moeda', `${esc(D.nome || 'Sem nome')} · ${esc(D.moeda)}`)}
    ${op('aparencia', '🎨', 'Cor e tema', temas[D.tema])}
    ${op('categorias', '🏷️', 'Categorias', `${D.categorias.length} categorias`)}
    ${op('contas', '🏦', 'Contas e carteiras', `${D.contas.length} contas`)}
    ${op('fixos', '🔁', 'Lançamentos fixos', D.fixos.length ? `${D.fixos.length} todo mês` : 'Contas que repetem todo mês')}
  </div>
  <h3>Seus dados</h3><div class="card">
    ${op('backup', '💾', 'Salvar backup', D.ultimoBackup ? 'Último: ' + new Date(D.ultimoBackup).toLocaleDateString('pt-BR') : 'Guarde uma cópia no WhatsApp, e-mail ou Arquivos')}
    ${op('restaurar', '📂', 'Restaurar backup', 'Abrir um arquivo de backup')}
    ${op('csv', '📊', 'Exportar planilha', 'Arquivo CSV para Excel/Numbers')}
    ${op('apagar', '🗑️', 'Apagar tudo', 'Começar do zero')}
  </div>
  <p style="text-align:center;color:var(--suave);font-size:13px;margin-top:20px">Comtai · seus dados ficam só neste aparelho 🔒</p>`;
}

/* ---------- Folha (modal) ---------- */
function abrir(html) {
  const f = $('#folha');
  f.innerHTML = `<div class="pegador"></div>` + html;
  f.hidden = false; $('#fundo').hidden = false;
  f.scrollTop = 0;
}
function fechar() { $('#folha').hidden = true; $('#fundo').hidden = true; $('#folha').innerHTML = ''; }
$('#fundo').onclick = fechar;

let rascunho = null;

function formLanc(l) {
  rascunho = l ? { ...l, eFixo: false } : { id: '', tipo: 'd', valor: 0, cat: '', conta: D.contas[0]?.id || '', data: hoje(), desc: '', eFixo: false };
  desenharForm();
  if (!l) setTimeout(() => $('#f-valor')?.focus(), 250);
}
function desenharForm() {
  const r = rascunho;
  const cats = D.categorias.filter(c => c.tipo === r.tipo);
  if (!cats.some(c => c.id === r.cat)) r.cat = cats[0]?.id || '';
  abrir(`
    <h2>${r.id ? 'Editar lançamento' : 'Novo lançamento'}</h2>
    <div class="tipo"><button class="d ${r.tipo === 'd' ? 'sel' : ''}" data-a="f-tipo" data-t="d">⬇ Gasto</button><button class="r ${r.tipo === 'r' ? 'sel' : ''}" data-a="f-tipo" data-t="r">⬆ Ganho</button></div>
    <div class="campo-valor"><span>${esc(D.moeda)}</span><input id="f-valor" inputmode="decimal" placeholder="0,00" value="${valorTxt(r.valor)}" autocomplete="off"></div>
    <label class="rot">Categoria</label>
    <div class="grade">${cats.map(c => `<button class="cat ${r.cat === c.id ? 'sel' : ''}" data-a="f-cat" data-id="${c.id}"><b>${c.emoji}</b>${esc(c.nome)}</button>`).join('')}
      <button class="cat" data-a="nova-cat-form"><b>＋</b>Nova</button></div>
    <label class="rot">Descrição (opcional)</label>
    <input class="inp" id="f-desc" placeholder="Ex.: almoço com a família" value="${esc(r.desc)}">
    <div class="dupla">
      <div><label class="rot">Data</label><input class="inp" id="f-data" type="date" value="${r.data}"></div>
      <div><label class="rot">Conta</label><select class="inp" id="f-conta">${D.contas.map(k => `<option value="${k.id}" ${k.id === r.conta ? 'selected' : ''}>${k.emoji} ${esc(k.nome)}</option>`).join('')}</select></div>
    </div>
    ${r.id ? '' : `<div class="card" style="display:flex;align-items:center;gap:12px;margin-top:14px"><div style="flex:1"><b>Repetir todo mês</b><div style="font-size:13px;color:var(--suave)">Para aluguel, salário, assinaturas…</div></div><label class="troca"><input type="checkbox" id="f-fixo" ${r.eFixo ? 'checked' : ''}><i></i></label></div>`}
    <button class="botao" data-a="f-salvar">Salvar</button>
    ${r.id ? `<button class="botao sec" data-a="f-duplicar">Duplicar</button><button class="botao perigo" data-a="f-excluir">Excluir</button>` : ''}
  `);
}
function lerForm() {
  const r = rascunho;
  r.valor = lerValor($('#f-valor').value);
  r.desc = $('#f-desc').value.trim();
  r.data = $('#f-data').value || hoje();
  r.conta = $('#f-conta').value;
  if ($('#f-fixo')) r.eFixo = $('#f-fixo').checked;
}

/* Formulário genérico de item (categoria/conta/meta) */
function formItem(cfg) {
  formItem.depois = null;
  const v = cfg.valores;
  abrir(`
    <h2>${cfg.titulo}</h2>
    <label class="rot">Nome</label><input class="inp" id="i-nome" value="${esc(v.nome)}" placeholder="${cfg.ph || ''}">
    ${cfg.tipo ? `<label class="rot">Tipo</label><div class="tipo"><button class="d ${v.tipo === 'd' ? 'sel' : ''}" data-a="i-tipo" data-t="d">Gasto</button><button class="r ${v.tipo === 'r' ? 'sel' : ''}" data-a="i-tipo" data-t="r">Ganho</button></div>` : ''}
    ${(cfg.campos || []).map(c => `<label class="rot">${c.rot}</label><input class="inp" id="i-${c.id}" inputmode="decimal" placeholder="0,00" value="${valorTxt(v[c.id])}">`).join('')}
    ${cfg.cor ? `<label class="rot">Cor</label><div class="cores">${CORES.map(c => `<button class="cor ${v.cor === c ? 'sel' : ''}" style="background:${c}" data-a="i-cor" data-c="${c}"></button>`).join('')}</div>` : ''}
    <label class="rot">Ícone</label><div class="emojis">${EMOJIS.map(e => `<button class="${v.emoji === e ? 'sel' : ''}" data-a="i-emoji" data-e="${e}">${e}</button>`).join('')}</div>
    <button class="botao" data-a="i-salvar">Salvar</button>
    ${cfg.excluir ? `<button class="botao perigo" data-a="i-excluir">Excluir</button>` : ''}
  `);
  formItem.cfg = cfg;
}

function formCategoria(c, tipo) {
  formItem({
    titulo: c ? 'Editar categoria' : 'Nova categoria', ph: 'Ex.: Academia', tipo: true, cor: true,
    valores: c ? { ...c } : { nome: '', emoji: '📌', cor: CORES[0], tipo: tipo || 'd', limite: 0 },
    campos: [{ id: 'limite', rot: 'Limite por mês (opcional)' }],
    excluir: !!c,
    salvar(v) {
      if (c) Object.assign(c, v); else D.categorias.push({ id: id(), ...v });
      return true;
    },
    remover() {
      if (D.lancs.some(l => l.cat === c.id) && !confirm('Há lançamentos nesta categoria. Eles ficarão “Sem categoria”. Excluir mesmo assim?')) return false;
      D.categorias = D.categorias.filter(x => x !== c); return true;
    }
  });
}
function formConta(k) {
  formItem({
    titulo: k ? 'Editar conta' : 'Nova conta', ph: 'Ex.: Nubank',
    valores: k ? { ...k } : { nome: '', emoji: '🏦', saldoInicial: 0 },
    campos: [{ id: 'saldoInicial', rot: 'Saldo que já tinha antes de usar o app' }],
    excluir: !!k,
    salvar(v) { if (k) Object.assign(k, v); else D.contas.push({ id: id(), ...v }); return true; },
    remover() {
      if (D.contas.length === 1) { avisar('Precisa ter pelo menos uma conta'); return false; }
      if (D.lancs.some(l => l.conta === k.id) && !confirm('Há lançamentos nesta conta. Excluir mesmo assim?')) return false;
      D.contas = D.contas.filter(x => x !== k); return true;
    }
  });
}
function formMeta(m) {
  formItem({
    titulo: m ? 'Editar objetivo' : 'Novo objetivo', ph: 'Ex.: Viagem', cor: true,
    valores: m ? { ...m } : { nome: '', emoji: '🎯', cor: CORES[0], alvo: 0, guardado: 0 },
    campos: [{ id: 'alvo', rot: 'Quanto quer juntar' }, { id: 'guardado', rot: 'Quanto já guardou' }],
    excluir: !!m,
    salvar(v) { if (m) Object.assign(m, v); else D.metas.push({ id: id(), ...v }); return true; },
    remover() { D.metas = D.metas.filter(x => x !== m); return true; }
  });
}

function folhaMeta(m) {
  abrir(`<h2>${m.emoji} ${esc(m.nome)}</h2>
    <div class="card" style="text-align:center">Guardado<div style="font-size:30px;font-weight:800">${din(m.guardado)}</div><div style="color:var(--suave)">faltam ${din(Math.max(0, m.alvo - m.guardado))}</div></div>
    <label class="rot">Valor</label><input class="inp" id="m-valor" inputmode="decimal" placeholder="0,00">
    <div class="dupla"><button class="botao" data-a="m-mov" data-n="1">＋ Guardar</button><button class="botao sec" style="margin-top:16px" data-a="m-mov" data-n="-1">－ Retirar</button></div>
    <button class="botao sec" data-a="m-editar" data-id="${m.id}">Editar objetivo</button>`);
  folhaMeta.m = m;
}

function folhaLista(titulo, itens, add) {
  abrir(`<h2>${titulo}</h2><div class="card">${itens || '<div class="vazio">Nada aqui ainda.</div>'}</div>${add ? `<button class="botao" data-a="${add.a}" ${add.t ? `data-t="${add.t}"` : ''}>${add.txt}</button>` : ''}`);
}
function listaCategorias() {
  const linha = c => `<div class="item" data-a="cat-edit" data-id="${c.id}"><div class="bola" style="background:${c.cor}22">${c.emoji}</div><div class="meio"><div class="nome">${esc(c.nome)}</div>${c.limite ? `<div class="sub">Limite ${din(c.limite)}/mês</div>` : ''}</div><span class="seta" style="color:var(--suave)">›</span></div>`;
  abrir(`<h2>Categorias</h2>
    <h3>De gastos</h3><div class="card">${D.categorias.filter(c => c.tipo === 'd').map(linha).join('')}</div>
    <button class="botao sec" data-a="cat-nova" data-t="d">＋ Categoria de gasto</button>
    <h3>De ganhos</h3><div class="card">${D.categorias.filter(c => c.tipo === 'r').map(linha).join('')}</div>
    <button class="botao sec" data-a="cat-nova" data-t="r">＋ Categoria de ganho</button>`);
}
function listaContas() {
  folhaLista('Contas e carteiras', D.contas.map(k => `<div class="item" data-a="conta" data-id="${k.id}"><div class="bola" style="background:var(--linha)">${k.emoji}</div><div class="meio"><div class="nome">${esc(k.nome)}</div></div><div class="valor">${din(saldoConta(k))}</div></div>`).join(''), { a: 'conta-nova', txt: '＋ Nova conta' });
}
function listaFixos() {
  abrir(`<h2>Lançamentos fixos</h2>
    <div class="dica">Eles entram sozinhos todo mês, no dia escolhido. Para criar um, marque “Repetir todo mês” ao lançar.</div>
    <div class="card">${D.fixos.map(f => { const c = cat(f.cat); return `<div class="item"><div class="bola" style="background:${c.cor}22">${c.emoji}</div><div class="meio"><div class="nome">${esc(f.desc || c.nome)}</div><div class="sub">Todo dia ${f.dia} · ${din(f.valor)}</div></div><button class="chip" data-a="fixo-parar" data-id="${f.id}">Parar</button></div>`; }).join('') || '<div class="vazio">Nenhum lançamento fixo.</div>'}</div>`);
}

/* ---------- Backup ---------- */
async function compartilharArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const arq = new File([blob], nome, { type: tipo });
  if (navigator.canShare && navigator.canShare({ files: [arq] })) {
    try { await navigator.share({ files: [arq], title: nome }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
async function fazerBackup() {
  const ok = await compartilharArquivo(`comtai-backup-${hoje()}.json`, JSON.stringify(D), 'application/json');
  if (ok) { D.ultimoBackup = Date.now(); salvar(); render(); avisar('💾 Backup pronto'); }
}
function restaurar() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const novo = JSON.parse(rd.result);
        if (!Array.isArray(novo.lancs) || !Array.isArray(novo.categorias)) throw 0;
        if (!confirm('Substituir os dados atuais pelos do backup?')) return;
        D = Object.assign(PADRAO(), novo); salvar(); fechar(); render(); avisar('✅ Backup restaurado');
      } catch (e) { alert('Esse arquivo não é um backup do Comtai.'); }
    };
    rd.readAsText(f);
  };
  inp.click();
}
function exportarCsv() {
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const linhas = [['Data', 'Tipo', 'Categoria', 'Conta', 'Descrição', 'Valor'].join(';')];
  D.lancs.slice().sort((a, b) => a.data.localeCompare(b.data)).forEach(l => linhas.push([
    l.data.split('-').reverse().join('/'), l.tipo === 'r' ? 'Ganho' : 'Gasto', q(cat(l.cat).nome), q(conta(l.conta).nome), q(l.desc),
    (l.tipo === 'r' ? '' : '-') + (l.valor / 100).toFixed(2).replace('.', ',')
  ].join(';')));
  compartilharArquivo(`comtai-${hoje()}.csv`, '﻿' + linhas.join('\n'), 'text/csv');
}

/* ---------- Ações (cliques) ---------- */
const ACOES = {
  mes: el => { mesVisto = somaMes(mesVisto, +el.dataset.n); render(); },
  filtrar: el => { filtroCat = el.dataset.id; tela = 'extrato'; render(); },
  editar: el => formLanc(D.lancs.find(l => l.id === el.dataset.id)),
  conta: el => formConta(D.contas.find(k => k.id === el.dataset.id)),
  'conta-nova': () => formConta(null),

  'f-tipo': el => { lerForm(); rascunho.tipo = el.dataset.t; desenharForm(); },
  'f-cat': el => { document.querySelectorAll('.cat').forEach(b => b.classList.toggle('sel', b === el)); rascunho.cat = el.dataset.id; },
  'nova-cat-form': () => { lerForm(); const r = rascunho; formCategoria(null, r.tipo); formItem.depois = () => { rascunho = r; r.cat = D.categorias[D.categorias.length - 1].id; desenharForm(); }; },
  'f-salvar': () => {
    lerForm(); const r = rascunho;
    if (!r.valor) { avisar('Digite um valor'); $('#f-valor').focus(); return; }
    if (!r.cat) { avisar('Escolha uma categoria'); return; }
    const { eFixo, ...l } = r;
    if (l.id) { Object.assign(D.lancs.find(x => x.id === l.id), l); }
    else if (eFixo) {
      D.fixos.push({ id: id(), tipo: l.tipo, valor: l.valor, cat: l.cat, conta: l.conta, dia: +l.data.slice(8), desc: l.desc, inicio: l.data.slice(0, 7), ultimo: null });
      gerarFixos();
    } else D.lancs.push({ ...l, id: id(), fixo: null });
    salvar(); fechar(); mesVisto = l.data.slice(0, 7); render(); avisar('✅ Salvo');
  },
  'f-duplicar': () => { lerForm(); const { eFixo, ...l } = rascunho; D.lancs.push({ ...l, id: id(), data: hoje(), fixo: null }); salvar(); fechar(); render(); avisar('✅ Duplicado para hoje'); },
  'f-excluir': () => { if (!confirm('Excluir este lançamento?')) return; D.lancs = D.lancs.filter(l => l.id !== rascunho.id); salvar(); fechar(); render(); avisar('🗑️ Excluído'); },

  'i-tipo': el => { formItem.cfg.valores.tipo = el.dataset.t; el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b === el)); },
  'i-cor': el => { formItem.cfg.valores.cor = el.dataset.c; document.querySelectorAll('.cor').forEach(b => b.classList.toggle('sel', b === el)); },
  'i-emoji': el => { formItem.cfg.valores.emoji = el.dataset.e; document.querySelectorAll('.emojis button').forEach(b => b.classList.toggle('sel', b === el)); },
  'i-salvar': () => {
    const cfg = formItem.cfg, v = cfg.valores;
    v.nome = $('#i-nome').value.trim();
    if (!v.nome) { avisar('Dê um nome'); $('#i-nome').focus(); return; }
    (cfg.campos || []).forEach(c => v[c.id] = lerValor($('#i-' + c.id).value));
    if (cfg.salvar(v)) { salvar(); fechar(); render(); avisar('✅ Salvo'); if (formItem.depois) { const d = formItem.depois; formItem.depois = null; d(); } }
  },
  'i-excluir': () => { if (!formItem.cfg.excluir || !confirm('Excluir?')) return; formItem.depois = null; if (formItem.cfg.remover()) { salvar(); fechar(); render(); avisar('🗑️ Excluído'); } },

  meta: el => { const m = D.metas.find(x => x.id === el.dataset.id); m ? folhaMeta(m) : formMeta(null); },
  'm-editar': el => formMeta(D.metas.find(x => x.id === el.dataset.id)),
  'm-mov': el => {
    const v = lerValor($('#m-valor').value); if (!v) { avisar('Digite um valor'); return; }
    const m = folhaMeta.m; m.guardado = Math.max(0, m.guardado + v * +el.dataset.n);
    salvar(); fechar(); render(); avisar(m.alvo && m.guardado >= m.alvo ? '🎉 Objetivo alcançado!' : '✅ Atualizado');
  },
  limite: el => formCategoria(D.categorias.find(c => c.id === el.dataset.id)),

  perfil: () => abrir(`<h2>Seu nome e moeda</h2>
    <label class="rot">Como quer ser chamada(o)?</label><input class="inp" id="p-nome" value="${esc(D.nome)}" placeholder="Seu nome">
    <label class="rot">Símbolo da moeda</label><input class="inp" id="p-moeda" value="${esc(D.moeda)}" maxlength="4">
    <button class="botao" data-a="p-salvar">Salvar</button>`),
  'p-salvar': () => { D.nome = $('#p-nome').value.trim(); D.moeda = $('#p-moeda').value.trim() || 'R$'; salvar(); fechar(); render(); avisar('✅ Salvo'); },
  aparencia: () => abrir(`<h2>Cor e tema</h2>
    <label class="rot">Cor principal</label><div class="cores">${CORES.map(c => `<button class="cor ${D.cor === c ? 'sel' : ''}" style="background:${c}" data-a="ap-cor" data-c="${c}"></button>`).join('')}</div>
    <label class="rot">Tema</label><div class="chips">${[['auto', '🌗 Automático'], ['claro', '☀️ Claro'], ['escuro', '🌙 Escuro']].map(([k, t]) => `<button class="chip ${D.tema === k ? 'sel' : ''}" data-a="ap-tema" data-t="${k}">${t}</button>`).join('')}</div>
    <button class="botao" data-a="fechar">Pronto</button>`),
  'ap-cor': el => { D.cor = el.dataset.c; salvar(); render(); ACOES.aparencia(); },
  'ap-tema': el => { D.tema = el.dataset.t; salvar(); render(); ACOES.aparencia(); },
  categorias: () => listaCategorias(),
  'cat-edit': el => formCategoria(D.categorias.find(c => c.id === el.dataset.id)),
  'cat-nova': el => formCategoria(null, el.dataset.t),
  contas: () => listaContas(),
  fixos: () => listaFixos(),
  'fixo-parar': el => {
    if (!confirm('Parar de lançar todo mês? (Os lançamentos já feitos continuam.)')) return;
    D.fixos = D.fixos.filter(f => f.id !== el.dataset.id); D.lancs.forEach(l => { if (l.fixo === el.dataset.id) l.fixo = null; });
    salvar(); render(); listaFixos();
  },
  backup: () => fazerBackup(),
  restaurar: () => restaurar(),
  csv: () => exportarCsv(),
  apagar: () => {
    if (!confirm('Apagar TODOS os dados? Isso não pode ser desfeito.')) return;
    if (prompt('Para confirmar, digite APAGAR') !== 'APAGAR') return;
    D = PADRAO(); D.iniciado = true; salvar(); mesVisto = mesAtual(); render(); avisar('Tudo apagado');
  },
  fechar: () => fechar(),
  'boas-vindas': () => {
    D.nome = $('#bv-nome').value.trim(); D.iniciado = true; salvar(); fechar(); render();
  },
  'bv-cor': el => { D.cor = el.dataset.c; aplicarTema(); document.querySelectorAll('.cor').forEach(b => b.classList.toggle('sel', b === el)); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (el && ACOES[el.dataset.a]) { e.preventDefault(); ACOES[el.dataset.a](el); return; }
  const aba = e.target.closest('.abas button');
  if (aba) { tela = aba.dataset.tela; if (tela !== 'extrato') filtroCat = ''; window.scrollTo(0, 0); render(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'busca') {
    busca = e.target.value; const pos = e.target.selectionStart;
    render(); const b = $('#busca'); b.focus(); b.setSelectionRange(pos, pos);
  }
});
$('#fab').onclick = () => formLanc(null);
$('#btn-olho').onclick = () => { D.esconder = !D.esconder; salvar(); aplicarTema(); };
document.addEventListener('visibilitychange', () => { if (!document.hidden) { gerarFixos(); render(); } });

/* ---------- Início ---------- */
gerarFixos();
render();
if (!D.iniciado) {
  abrir(`<div style="text-align:center;font-size:54px">👋</div>
    <h2 style="text-align:center">Bem-vinda(o) ao Comtai!</h2>
    <p style="text-align:center;color:var(--suave);margin-top:-6px">Anote seus gastos e ganhos de um jeito fácil. Tudo fica salvo só no seu celular.</p>
    <label class="rot">Como quer ser chamada(o)?</label><input class="inp" id="bv-nome" placeholder="Seu nome">
    <label class="rot">Escolha sua cor</label><div class="cores">${CORES.map(c => `<button class="cor ${D.cor === c ? 'sel' : ''}" style="background:${c}" data-a="bv-cor" data-c="${c}"></button>`).join('')}</div>
    <button class="botao" data-a="boas-vindas">Começar</button>`);
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
