'use strict';
/* Contaí — contas, gastos e lista de compras. Os dados ficam só neste aparelho (localStorage). */

const CHAVE = 'contai.v1';
const CORES = ['#D9468A', '#E86AA6', '#B06CE0', '#8E6CF0', '#F28C8C', '#E8A13A', '#2EAD7A', '#3BA7C9', '#C2185B', '#7A4E8C'];
const EMOJIS = ['🛒','💊','🎮','🍔','☕','🍕','🏠','💡','💧','📱','🚗','⛽','🚌','✈️','🏥','🎓','📚','👗','👠','💄','💅','💇‍♀️','🛍️','🎁',
  '🐶','🐱','👶','💪','🧘‍♀️','🏖️','🍷','🎬','🎵','🌸','🌷','💐','🧁','🍰','🧸','🎀','💳','🧾','💰','🏦','📦','❤️','⭐','✨'];

const PADRAO = () => ({
  versao: 1, nome: '', cor: CORES[0], tema: 'claro', iniciado: false, ultimoBackup: null,
  categorias: [
    { id: 'c1', nome: 'Mercado', emoji: '🛒', cor: '#2EAD7A' },
    { id: 'c2', nome: 'Saúde', emoji: '💊', cor: '#E5484D' },
    { id: 'c3', nome: 'Lazer', emoji: '🎮', cor: '#E8A13A' },
    { id: 'c4', nome: 'Beleza', emoji: '💅', cor: '#D9468A' }
  ],
  contas: [],     // {id, nome, valor, dia, inicio:'AAAA-MM', fim:'AAAA-MM'|null, parcelas:n|0}
  pagos: {},      // {contaId: {'AAAA-MM': true}}
  valoresMes: {}, // {contaId: {'AAAA-MM': centavos}}  valor diferente só naquele mês
  gastos: [],     // {id, cat, valor, data:'AAAA-MM-DD', desc}
  compras: []     // {id, texto, feito}
});

/* ---------- Estado ---------- */
let D = carregar();
let tela = 'inicio';
let mesVisto = mesAtual();
let filtro = 'todas';
let catSel = D.categorias[0]?.id || '';

function carregar() {
  try { const t = localStorage.getItem(CHAVE); if (t) return Object.assign(PADRAO(), JSON.parse(t)); } catch (e) {}
  return PADRAO();
}
function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(D)); } catch (e) { avisar('⚠️ Não foi possível salvar'); } }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- Utilidades ---------- */
const $ = s => document.querySelector(s);
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function p2(n) { return String(n).padStart(2, '0'); }
function iso(d) { return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
function hoje() { return iso(new Date()); }
function mesAtual() { return hoje().slice(0, 7); }
function somaMes(m, n) { let [a, b] = m.split('-').map(Number); b += n; while (b > 12) { b -= 12; a++; } while (b < 1) { b += 12; a--; } return `${a}-${p2(b)}`; }
function difMeses(a, b) { const [x, y] = a.split('-').map(Number), [z, w] = b.split('-').map(Number); return (z - x) * 12 + (w - y); }
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function nomeMes(m) { const [a, b] = m.split('-').map(Number); const n = MESES[b - 1]; return n[0].toUpperCase() + n.slice(1) + ' de ' + a; }
function mesCurto(m) { const [a, b] = m.split('-').map(Number); return MESES[b - 1].slice(0, 3) + '/' + String(a).slice(2); }
function dataLonga(d) { const [, b, c] = d.split('-').map(Number); return `${c} de ${MESES[b - 1]}`; }
const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const din = c => fmt.format((c || 0) / 100).replace(/ /g, ' ');
function lerValor(txt) {
  let t = String(txt || '').trim().replace(/[^\d.,]/g, '');
  if (!t) return 0;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
  const n = Math.round(parseFloat(t) * 100);
  return isFinite(n) && n > 0 ? n : 0;
}
const valorTxt = c => c ? (c / 100).toFixed(2).replace('.', ',') : '';
const cat = id => D.categorias.find(c => c.id === id) || { nome: 'Sem categoria', emoji: '❔', cor: '#9A7C92' };
let tAviso;
function avisar(t) { const a = $('#aviso'); a.textContent = t; a.hidden = false; clearTimeout(tAviso); tAviso = setTimeout(() => a.hidden = true, 2200); }

/* ---------- Regras das contas ---------- */
const contaNoMes = (c, m) => m >= c.inicio && (!c.fim || m <= c.fim);
const contasDoMes = m => D.contas.filter(c => contaNoMes(c, m)).sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome));
const valorConta = (c, m) => D.valoresMes[c.id]?.[m] ?? c.valor;
const paga = (c, m) => !!D.pagos[c.id]?.[m];
function vencimento(c, m) { const [a, b] = m.split('-').map(Number); return `${m}-${p2(Math.min(c.dia, new Date(a, b, 0).getDate()))}`; }
function diasAte(d) { const [a, b, c] = d.split('-').map(Number); const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((new Date(a, b - 1, c) - h) / 864e5); }
function status(c, m) {
  if (paga(c, m)) return { k: 'paga', t: 'Paga', cor: 'var(--verde)' };
  const d = diasAte(vencimento(c, m));
  if (d < 0) return { k: 'vencendo', t: 'Atrasada', cor: 'var(--vermelho)' };
  if (d <= 7) return { k: 'vencendo', t: d === 0 ? 'Vence hoje' : 'Vencendo', cor: 'var(--vermelho)' };
  return { k: 'pendente', t: 'Pendente', cor: 'var(--amarelo)' };
}
function parcelaTxt(c, m) { return c.parcelas ? ` · ${difMeses(c.inicio, m) + 1}/${c.parcelas}` : ''; }
function resumo(m) {
  let prev = 0, pago = 0, n = 0, np = 0;
  for (const c of contasDoMes(m)) { const v = valorConta(c, m); prev += v; n++; if (paga(c, m)) { pago += v; np++; } }
  const gastos = D.gastos.filter(g => g.data.startsWith(m)).reduce((s, g) => s + g.valor, 0);
  return { prev, pago, pend: prev - pago, n, np, gastos, total: prev + gastos };
}

/* ---------- Tema ---------- */
function aplicarTema() {
  const r = document.documentElement;
  r.style.setProperty('--cor', D.cor);
  const escuro = D.tema === 'escuro' || (D.tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  r.dataset.tema = escuro ? 'escuro' : 'claro';
  if (!escuro) r.style.setProperty('--cor-suave', D.cor + '22'); else r.style.removeProperty('--cor-suave');
  document.querySelector('meta[name=theme-color]').content = escuro ? '#1C1220' : '#FFF5F8';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());

/* ---------- Telas ---------- */
function render() {
  aplicarTema();
  document.querySelectorAll('.abas button').forEach(b => b.classList.toggle('ativa', b.dataset.tela === tela));
  $('#fab').hidden = tela === 'ajustes' || tela === 'relatorio';
  $('#main').innerHTML = { inicio: telaInicio, contas: telaContas, gastos: telaGastos, relatorio: telaRelatorio, ajustes: telaAjustes }[tela]();
}
const seletorMes = () => `<div class="mes"><button data-a="mes" data-n="-1">‹</button><div class="nome">${nomeMes(mesVisto)}</div><button data-a="mes" data-n="1">›</button></div>`;

function linhaConta(c, m) {
  const s = status(c, m), p = s.k === 'paga';
  return `<div class="conta ${p ? 'paga' : ''}">
    <button class="check ${p ? 'on' : ''}" data-a="pagar" data-id="${c.id}" data-m="${m}" aria-label="Marcar como paga">${p ? '✓' : ''}</button>
    <div class="meio" data-a="editar-conta" data-id="${c.id}" data-m="${m}">
      <div class="nome">${esc(c.nome)}</div>
      <div class="st"><i style="background:${s.cor}"></i>${s.t} · vence dia ${c.dia}${parcelaTxt(c, m)}</div>
    </div>
    <div class="valor" data-a="editar-conta" data-id="${c.id}" data-m="${m}" style="font-weight:700">${din(valorConta(c, m))}</div>
  </div>`;
}

function telaInicio() {
  const r = resumo(mesVisto);
  const pct = r.n ? Math.round(r.np / r.n * 100) : 0;
  let h = `<div class="marca">Contaí <small>🌸</small></div>${D.nome ? `<div class="ola">Oi, ${esc(D.nome)}! 💕</div>` : ''}${seletorMes()}`;
  h += `<div class="card"><h4>Resumo do mês</h4>
    <div class="resumo"><div><span class="sub">Previsto</span><b>${din(r.prev)}</b></div><div><span class="sub">Pago</span><b class="pos">${din(r.pago)}</b></div><div><span class="sub">Pendente</span><b class="neg">${din(r.pend)}</b></div></div>
    <div class="barra"><i style="width:${r.prev ? r.pago / r.prev * 100 : 0}%"></i></div>
    <div class="sub">${pct}% das contas do mês quitadas</div>
    <div class="totais"><div><span class="sub">Gastos variáveis</span><b>${din(r.gastos)}</b></div><div style="text-align:right"><span class="sub">Total do mês</span><b class="grande">${din(r.total)}</b></div></div>
  </div>`;

  if (!D.contas.length && !D.gastos.length) h += `<div class="dica">✨ Toque no <b>+</b> para cadastrar suas contas do mês (aluguel, luz, cartão…). Os gastos do dia a dia ficam na aba <b>Gastos</b>.</div>`;
  else if (D.ultimoBackup ? Date.now() - D.ultimoBackup > 30 * 864e5 : D.gastos.length + D.contas.length >= 15) h += `<div class="dica" data-a="backup">💾 Faz tempo que você não guarda uma cópia dos dados. <b>Toque aqui para salvar.</b></div>`;

  // Lista de compras
  h += `<div class="card"><h4>Lista de compras</h4>
    <div class="add"><input class="inp" id="compra-txt" placeholder="Adicionar item…" enterkeyhint="done"><button class="ok" data-a="compra-add" aria-label="Adicionar">✓</button></div>`;
  if (!D.compras.length) h += `<div class="sub" style="margin-top:10px">Nenhum item na lista. Anote o que precisa comprar 🛒</div>`;
  else {
    h += `<div style="margin-top:8px">` + D.compras.map(c => `<div class="compra ${c.feito ? 'feito' : ''}"><button class="check ${c.feito ? 'on' : ''}" style="width:26px;height:26px;font-size:14px" data-a="compra-ok" data-id="${c.id}">${c.feito ? '✓' : ''}</button><div class="t" data-a="compra-ok" data-id="${c.id}">${esc(c.texto)}</div><button class="x" data-a="compra-del" data-id="${c.id}">×</button></div>`).join('') + `</div>`;
    if (D.compras.some(c => c.feito)) h += `<button class="botao sec" data-a="compra-limpar">Limpar comprados</button>`;
  }
  h += `</div>`;

  // Gastos por categoria
  const porCat = {};
  D.gastos.filter(g => g.data.startsWith(mesVisto)).forEach(g => porCat[g.cat] = (porCat[g.cat] || 0) + g.valor);
  const lista = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  h += `<div class="card"><h4>Gastos por categoria</h4>`;
  if (!lista.length) h += `<div class="vazio">Nenhum gasto variável neste mês.</div>`;
  else h += lista.map(([id, v]) => { const c = cat(id); return `<div class="item" data-a="ver-cat" data-id="${id}"><div class="bola" style="background:${c.cor}22">${c.emoji}</div><div class="meio"><div class="nome">${esc(c.nome)}</div><div class="barra" style="margin:6px 0 0;height:6px"><i style="width:${v / lista[0][1] * 100}%;background:${c.cor}"></i></div></div><div class="valor">${din(v)}</div></div>`; }).join('');
  h += `</div>`;

  // Próximos vencimentos (7 dias)
  const prox = [];
  const mA = mesAtual();
  for (const m of [somaMes(mA, -1), mA, somaMes(mA, 1)]) for (const c of contasDoMes(m)) {
    if (paga(c, m)) continue;
    const v = vencimento(c, m), d = diasAte(v);
    if (d <= 7 && (d >= 0 || m >= mA)) prox.push({ c, m, v, d });
  }
  prox.sort((a, b) => a.v.localeCompare(b.v));
  h += `<div class="card"><h4>Próximos vencimentos (7 dias)</h4>`;
  if (!prox.length) h += `<div class="vazio">Nada vencendo nos próximos dias 🎉</div>`;
  else h += prox.map(({ c, m, v, d }) => `<div class="item"><button class="check" style="width:28px;height:28px;border-color:var(--vermelho)" data-a="pagar" data-id="${c.id}" data-m="${m}"></button><div class="meio" data-a="editar-conta" data-id="${c.id}" data-m="${m}"><div class="nome">${esc(c.nome)}</div><div class="sub" ${d < 0 ? 'style="color:var(--vermelho)"' : ''}>${dataLonga(v)}${d < 0 ? ' · atrasada' : d === 0 ? ' · hoje' : ''}</div></div><div class="valor">${din(valorConta(c, m))}</div></div>`).join('');
  return h + `</div>`;
}

function telaContas() {
  const todas = contasDoMes(mesVisto);
  const ls = filtro === 'todas' ? todas : todas.filter(c => status(c, mesVisto).k === filtro);
  let h = seletorMes();
  h += `<div class="chips">${[['todas', 'Todas'], ['paga', 'Pagas'], ['pendente', 'Pendentes'], ['vencendo', 'Vencendo']].map(([k, t]) => `<button class="chip ${filtro === k ? 'sel' : ''}" data-a="filtro" data-k="${k}">${t}</button>`).join('')}</div>`;
  if (!ls.length) return h + `<div class="vazio centro"><b>🧾</b>${todas.length ? 'Nenhuma conta neste filtro.' : 'Nenhuma conta neste mês.<br>Toque no + para adicionar.'}</div>`;
  return h + ls.map(c => linhaConta(c, mesVisto)).join('');
}

function telaGastos() {
  if (!D.categorias.some(c => c.id === catSel)) catSel = D.categorias[0]?.id || '';
  let h = `<div class="cats">${D.categorias.map(c => `<button class="${c.id === catSel ? 'sel' : ''}" data-a="cat-sel" data-id="${c.id}" ${c.id === catSel ? `style="color:${c.cor};border-bottom-color:${c.cor}"` : ''}><b>${c.emoji}</b>${esc(c.nome)}</button>`).join('')}<button class="mais" data-a="cat-nova">+</button></div>`;
  if (!catSel) return h + `<div class="vazio centro"><b>👛</b>Crie uma categoria no + acima.</div>`;
  const c = cat(catSel);
  const ls = D.gastos.filter(g => g.cat === catSel && g.data.startsWith(mesVisto)).sort((a, b) => b.data.localeCompare(a.data));
  h += seletorMes();
  h += `<div class="topo-cat"><div><div class="sub">Total do mês</div><b>${din(ls.reduce((s, g) => s + g.valor, 0))}</b></div><div class="icones"><button data-a="cat-editar" aria-label="Editar categoria">✏️</button><button data-a="cat-excluir" aria-label="Excluir categoria">🗑️</button></div></div>`;
  h += `<button class="btn-largo" data-a="novo-gasto" style="background:${c.cor}">＋ Adicionar gasto</button>`;
  if (!ls.length) return h + `<div class="vazio centro"><b>${c.emoji}</b>Nenhum lançamento neste mês.</div>`;
  return h + `<div class="card">${ls.map(g => `<div class="item" data-a="editar-gasto" data-id="${g.id}"><div class="bola" style="background:${c.cor}22">${c.emoji}</div><div class="meio"><div class="nome">${esc(g.desc || c.nome)}</div><div class="sub">${dataLonga(g.data)}</div></div><div class="valor">${din(g.valor)}</div></div>`).join('')}</div>`;
}

function telaRelatorio() {
  const fim = mesAtual();
  const meses = [5, 4, 3, 2, 1, 0].map(n => somaMes(fim, -n));
  const dados = meses.map(m => ({ m, ...resumo(m) }));
  const max = Math.max(1, ...dados.map(d => d.total));
  const com = dados.filter(d => d.total > 0), comG = dados.filter(d => d.gastos > 0);
  const media = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  let h = `<div class="tit">Relatório</div>`;
  h += `<div class="card"><h4>Gastos dos últimos meses</h4><div class="grafico">${dados.map(d => `<div class="col ${d.total ? '' : 'vazia'}"><div class="v">${d.total ? din(d.total).replace(/,\d\d$/, '') : '–'}</div><div class="b" style="height:${d.total / max * 75}%"></div><div class="m">${mesCurto(d.m)}</div></div>`).join('')}</div></div>`;
  const maior = com.reduce((a, b) => (!a || b.total > a.total ? b : a), null);
  const menor = com.reduce((a, b) => (!a || b.total < a.total ? b : a), null);
  h += `<div class="card"><h4>Médias e destaques</h4>
    <div class="linha"><span>Média mensal (total)</span><b>${din(media(com.map(d => d.total)))}</b></div>
    <div class="linha"><span>Média de contas fixas</span><b>${din(media(dados.filter(d => d.prev).map(d => d.prev)))}</b></div>
    <div class="linha"><span>Média de gastos variáveis</span><b>${din(media(comG.map(d => d.gastos)))}</b></div>
    <div class="linha"><span>Mês de maior gasto</span><b>${maior ? `${mesCurto(maior.m)} · ${din(maior.total)}` : '—'}</b></div>
    <div class="linha"><span>Mês de menor gasto</span><b>${menor ? `${mesCurto(menor.m)} · ${din(menor.total)}` : '—'}</b></div></div>`;
  const porCat = {};
  D.gastos.filter(g => g.data.slice(0, 7) >= meses[0] && g.data.slice(0, 7) <= fim).forEach(g => {
    const p = porCat[g.cat] || (porCat[g.cat] = { t: 0, ms: new Set() }); p.t += g.valor; p.ms.add(g.data.slice(0, 7));
  });
  const lc = Object.entries(porCat).sort((a, b) => b[1].t / b[1].ms.size - a[1].t / a[1].ms.size);
  h += `<div class="card"><h4 style="margin-bottom:2px">Média por categoria</h4><div class="sub" style="margin-bottom:8px">Considerando só os meses com gasto (últimos 6 meses)</div>`;
  h += lc.length ? lc.map(([id, p]) => { const c = cat(id); return `<div class="item"><div class="ponto" style="background:${c.cor}"></div><div class="meio"><div class="nome">${c.emoji} ${esc(c.nome)}</div><div class="sub">Total: ${din(p.t)}</div></div><div style="text-align:right"><div class="valor">${din(p.t / p.ms.size)}</div><div class="sub">por mês</div></div></div>`; }).join('') : `<div class="vazio">Ainda sem gastos variáveis.</div>`;
  return h + `</div>`;
}

function telaAjustes() {
  const op = (a, ic, t, s) => `<button class="opcao" data-a="${a}"><div class="bola">${ic}</div><div class="meio"><div style="font-weight:700">${t}</div>${s ? `<div class="sub">${s}</div>` : ''}</div><span class="seta">›</span></button>`;
  return `<div class="tit">Ajustes</div>
  <div class="card">
    ${op('perfil', '🙂', 'Seu nome', esc(D.nome || 'Sem nome'))}
    ${op('aparencia', '🎨', 'Cor e tema', { claro: 'Claro', escuro: 'Escuro', auto: 'Automático' }[D.tema])}
    ${op('categorias', '🏷️', 'Categorias de gastos', `${D.categorias.length} categorias`)}
  </div>
  <div class="card">
    ${op('backup', '💾', 'Salvar backup', D.ultimoBackup ? 'Último: ' + new Date(D.ultimoBackup).toLocaleDateString('pt-BR') : 'Guarde uma cópia no WhatsApp, e-mail ou Arquivos')}
    ${op('restaurar', '📂', 'Restaurar backup', 'Abrir um arquivo de backup')}
    ${op('csv', '📊', 'Exportar planilha', 'Contas e gastos em CSV')}
    ${op('apagar', '🗑️', 'Apagar tudo', 'Começar do zero')}
  </div>
  <p class="sub" style="text-align:center;margin-top:18px">Contaí 🌸 · seus dados ficam só neste celular, ninguém mais vê 🔒</p>`;
}

/* ---------- Folha (janela de baixo) ---------- */
function abrir(html) { const f = $('#folha'); f.innerHTML = `<div class="pegador"></div>` + html; f.hidden = false; $('#fundo').hidden = false; f.scrollTop = 0; }
function fechar() { $('#folha').hidden = true; $('#fundo').hidden = true; $('#folha').innerHTML = ''; }
$('#fundo').onclick = fechar;
const pronto = msg => { salvar(); fechar(); render(); if (msg) avisar(msg); };

/* Conta (boleto) */
let edConta = null;
function formConta(c, m) {
  edConta = { c, m, rep: c ? (c.parcelas ? 'parc' : c.fim === c.inicio ? 'unica' : 'mensal') : 'mensal' };
  const so = c && D.valoresMes[c.id]?.[m] != null;
  abrir(`<h2>${c ? 'Editar conta' : 'Nova conta'}</h2>
    <label class="rot">Nome</label><input class="inp" id="c-nome" placeholder="Ex.: Conta de luz" value="${esc(c?.nome)}">
    <div class="dupla">
      <div><label class="rot">Valor (R$)</label><input class="inp" id="c-valor" inputmode="decimal" placeholder="0,00" value="${valorTxt(c ? valorConta(c, m) : 0)}"></div>
      <div><label class="rot">Vence dia</label><input class="inp" id="c-dia" inputmode="numeric" placeholder="10" value="${c?.dia ?? ''}"></div>
    </div>
    ${c ? `<label class="rot">Mudar valor</label><div class="seg" id="c-alc"><button data-a="seg" class="${so ? '' : 'sel'}" data-v="todos">Todos os meses</button><button data-a="seg" class="${so ? 'sel' : ''}" data-v="mes">Só em ${MESES[+m.slice(5) - 1]}</button></div>` : `
    <label class="rot">Repete?</label><div class="seg" id="c-rep"><button data-a="seg" class="sel" data-v="mensal">Todo mês</button><button data-a="seg" data-v="unica">Só este mês</button><button data-a="seg" data-v="parc">Parcelada</button></div>
    <div id="c-parc-box" hidden><label class="rot">Quantas parcelas faltam (contando esta)?</label><input class="inp" id="c-parc" inputmode="numeric" placeholder="Ex.: 10"></div>`}
    <button class="botao" data-a="conta-salvar">Salvar</button>
    ${c ? `<button class="botao sec" data-a="pagar" data-id="${c.id}" data-m="${m}">${paga(c, m) ? 'Desmarcar como paga' : '✓ Marcar como paga'}</button>
      <button class="botao perigo" data-a="conta-excluir">Excluir conta</button>` : ''}`);
  if (!c) setTimeout(() => $('#c-nome')?.focus(), 250);
}
function segValor(id) { return $(`#${id} .sel`)?.dataset.v; }

/* Gasto */
let edGasto = null;
function formGasto(g) {
  edGasto = g;
  const catAtual = g ? g.cat : catSel;
  const hj = hoje(), dataPad = mesVisto === mesAtual() ? hj : `${mesVisto}-01`;
  abrir(`<h2>${g ? 'Editar gasto' : 'Novo gasto'}</h2>
    <label class="rot">Valor (R$)</label><input class="inp valor-g" id="g-valor" inputmode="decimal" placeholder="0,00" value="${valorTxt(g?.valor)}">
    <label class="rot">Categoria</label><div class="chips" style="flex-wrap:wrap" id="g-cat">${D.categorias.map(c => `<button class="chip ${c.id === catAtual ? 'sel' : ''}" data-a="seg" data-v="${c.id}">${c.emoji} ${esc(c.nome)}</button>`).join('')}</div>
    <label class="rot">Descrição (opcional)</label><input class="inp" id="g-desc" placeholder="Ex.: feira da semana" value="${esc(g?.desc)}">
    <label class="rot">Data</label><input class="inp" id="g-data" type="date" value="${g?.data || dataPad}">
    <button class="botao" data-a="gasto-salvar">Salvar</button>
    ${g ? `<button class="botao perigo" data-a="gasto-excluir">Excluir gasto</button>` : ''}`);
  if (!g) setTimeout(() => $('#g-valor')?.focus(), 250);
}

/* Categoria */
let edCat = null;
function formCat(c) {
  edCat = c ? { ...c } : { nome: '', emoji: '🌸', cor: CORES[0] };
  edCat.orig = c;
  abrir(`<h2>${c ? 'Editar categoria' : 'Nova categoria'}</h2>
    <label class="rot">Nome</label><input class="inp" id="k-nome" placeholder="Ex.: Pets" value="${esc(edCat.nome)}">
    <label class="rot">Cor</label><div class="cores">${CORES.concat(['#E5484D', '#2EAD7A', '#E8A13A']).filter((x, i, a) => a.indexOf(x) === i).map(x => `<button class="cor ${edCat.cor === x ? 'sel' : ''}" style="background:${x}" data-a="k-cor" data-c="${x}"></button>`).join('')}</div>
    <label class="rot">Ícone</label><div class="emojis">${EMOJIS.map(e => `<button class="${edCat.emoji === e ? 'sel' : ''}" data-a="k-emoji" data-e="${e}">${e}</button>`).join('')}</div>
    <button class="botao" data-a="cat-salvar">Salvar</button>`);
}

/* ---------- Backup ---------- */
async function compartilhar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const arq = new File([blob], nome, { type: tipo });
  if (navigator.canShare && navigator.canShare({ files: [arq] })) {
    try { await navigator.share({ files: [arq], title: nome }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
async function backup() {
  if (await compartilhar(`contai-backup-${hoje()}.json`, JSON.stringify(D), 'application/json')) { D.ultimoBackup = Date.now(); salvar(); render(); avisar('💾 Backup pronto'); }
}
function restaurar() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const n = JSON.parse(rd.result);
        if (!Array.isArray(n.contas) || !Array.isArray(n.gastos)) throw 0;
        if (!confirm('Substituir os dados atuais pelos do backup?')) return;
        D = Object.assign(PADRAO(), n); pronto('✅ Backup restaurado');
      } catch (e) { alert('Esse arquivo não é um backup do Contaí.'); }
    };
    rd.readAsText(f);
  };
  inp.click();
}
function csv() {
  const q = s => `"${String(s).replace(/"/g, '""')}"`, v = c => (c / 100).toFixed(2).replace('.', ',');
  const L = ['Tipo;Mês/Data;Nome;Categoria;Valor;Situação'];
  const meses = new Set([mesAtual()]); D.contas.forEach(c => meses.add(c.inicio)); D.gastos.forEach(g => meses.add(g.data.slice(0, 7)));
  [...meses].sort().forEach(m => contasDoMes(m).forEach(c => L.push(['Conta', m, q(c.nome), '', v(valorConta(c, m)), paga(c, m) ? 'Paga' : 'Pendente'].join(';'))));
  D.gastos.slice().sort((a, b) => a.data.localeCompare(b.data)).forEach(g => L.push(['Gasto', g.data.split('-').reverse().join('/'), q(g.desc), q(cat(g.cat).nome), v(g.valor), ''].join(';')));
  compartilhar(`contai-${hoje()}.csv`, '﻿' + L.join('\n'), 'text/csv');
}

/* ---------- Ações ---------- */
const A = {
  mes: el => { mesVisto = somaMes(mesVisto, +el.dataset.n); render(); },
  filtro: el => { filtro = el.dataset.k; render(); },
  seg: el => el.parentNode.querySelectorAll('button').forEach(b => {
    b.classList.toggle('sel', b === el);
    if (el.parentNode.id === 'c-rep') $('#c-parc-box').hidden = el.dataset.v !== 'parc';
  }),

  pagar: el => {
    const { id, m } = el.dataset, p = D.pagos[id] || (D.pagos[id] = {});
    if (p[m]) delete p[m]; else p[m] = true;
    const ok = !!p[m]; pronto(ok ? '✅ Conta paga!' : 'Marcada como pendente');
  },
  'editar-conta': el => formConta(D.contas.find(c => c.id === el.dataset.id), el.dataset.m),
  'conta-salvar': () => {
    const nome = $('#c-nome').value.trim(), valor = lerValor($('#c-valor').value), dia = parseInt($('#c-dia').value, 10);
    if (!nome) { avisar('Dê um nome para a conta'); return; }
    if (!valor) { avisar('Digite o valor'); return; }
    if (!(dia >= 1 && dia <= 31)) { avisar('Dia de vencimento de 1 a 31'); return; }
    const { c, m } = edConta;
    if (c) {
      c.nome = nome; c.dia = dia;
      if (segValor('c-alc') === 'mes') (D.valoresMes[c.id] || (D.valoresMes[c.id] = {}))[m] = valor;
      else { c.valor = valor; if (D.valoresMes[c.id]) delete D.valoresMes[c.id][m]; }
    } else {
      const rep = segValor('c-rep'), n = { id: novoId(), nome, valor, dia, inicio: mesVisto, fim: null, parcelas: 0 };
      if (rep === 'unica') n.fim = mesVisto;
      if (rep === 'parc') {
        const p = parseInt($('#c-parc').value, 10);
        if (!(p >= 1 && p <= 120)) { avisar('Quantas parcelas?'); return; }
        n.parcelas = p; n.fim = somaMes(mesVisto, p - 1);
      }
      D.contas.push(n);
    }
    pronto('✅ Salvo');
  },
  'conta-excluir': () => {
    const { c, m } = edConta;
    abrir(`<h2>Excluir “${esc(c.nome)}”</h2>
      ${m > c.inicio ? `<button class="botao" data-a="conta-encerrar">Parar a partir de ${MESES[+m.slice(5) - 1]}<br><small style="font-weight:500">Os meses anteriores continuam salvos</small></button>` : ''}
      <button class="botao ${m > c.inicio ? 'sec' : ''}" style="${m > c.inicio ? 'color:var(--vermelho)' : 'background:var(--vermelho)'}" data-a="conta-apagar">Apagar de todos os meses</button>
      <button class="botao perigo" style="color:var(--suave)" data-a="fechar">Cancelar</button>`);
  },
  'conta-encerrar': () => { const { c, m } = edConta; c.fim = somaMes(m, -1); pronto('🗑️ Conta encerrada'); },
  'conta-apagar': () => { const { c } = edConta; D.contas = D.contas.filter(x => x !== c); delete D.pagos[c.id]; delete D.valoresMes[c.id]; pronto('🗑️ Conta apagada'); },

  'cat-sel': el => { catSel = el.dataset.id; render(); },
  'ver-cat': el => { catSel = el.dataset.id; tela = 'gastos'; render(); },
  'novo-gasto': () => formGasto(null),
  'editar-gasto': el => formGasto(D.gastos.find(g => g.id === el.dataset.id)),
  'gasto-salvar': () => {
    const valor = lerValor($('#g-valor').value), c = segValor('g-cat');
    if (!valor) { avisar('Digite o valor'); return; }
    if (!c) { avisar('Escolha uma categoria'); return; }
    const dados = { cat: c, valor, desc: $('#g-desc').value.trim(), data: $('#g-data').value || hoje() };
    if (edGasto) Object.assign(edGasto, dados); else D.gastos.push({ id: novoId(), ...dados });
    catSel = c; mesVisto = dados.data.slice(0, 7); pronto('✅ Gasto salvo');
  },
  'gasto-excluir': () => { if (!confirm('Excluir este gasto?')) return; D.gastos = D.gastos.filter(g => g !== edGasto); pronto('🗑️ Excluído'); },

  'cat-nova': () => formCat(null),
  'cat-editar': () => formCat(D.categorias.find(c => c.id === catSel)),
  'cat-excluir': () => {
    const c = D.categorias.find(x => x.id === catSel); if (!c) return;
    const n = D.gastos.filter(g => g.cat === c.id).length;
    if (!confirm(n ? `Excluir “${c.nome}” e os ${n} gasto(s) dela?` : `Excluir a categoria “${c.nome}”?`)) return;
    D.categorias = D.categorias.filter(x => x !== c); D.gastos = D.gastos.filter(g => g.cat !== c.id);
    catSel = D.categorias[0]?.id || ''; pronto('🗑️ Categoria excluída');
  },
  'k-cor': el => { edCat.cor = el.dataset.c; document.querySelectorAll('.cor').forEach(b => b.classList.toggle('sel', b === el)); },
  'k-emoji': el => { edCat.emoji = el.dataset.e; document.querySelectorAll('.emojis button').forEach(b => b.classList.toggle('sel', b === el)); },
  'cat-salvar': () => {
    const nome = $('#k-nome').value.trim(); if (!nome) { avisar('Dê um nome'); return; }
    const { orig, emoji, cor } = edCat;
    if (orig) Object.assign(orig, { nome, emoji, cor }); else { const id = novoId(); D.categorias.push({ id, nome, emoji, cor }); catSel = id; }
    pronto('✅ Salvo');
  },
  categorias: () => abrir(`<h2>Categorias de gastos</h2><div class="card">${D.categorias.map(c => `<div class="item" data-a="cat-ed" data-id="${c.id}"><div class="bola" style="background:${c.cor}22">${c.emoji}</div><div class="meio"><div class="nome">${esc(c.nome)}</div></div><span class="sub">›</span></div>`).join('') || '<div class="vazio">Nenhuma categoria.</div>'}</div><button class="botao" data-a="cat-nova">＋ Nova categoria</button>`),
  'cat-ed': el => formCat(D.categorias.find(c => c.id === el.dataset.id)),

  'compra-add': () => {
    const i = $('#compra-txt'), t = i.value.trim(); if (!t) { i.focus(); return; }
    D.compras.push({ id: novoId(), texto: t, feito: false }); salvar(); render(); $('#compra-txt').focus();
  },
  'compra-ok': el => { const c = D.compras.find(x => x.id === el.dataset.id); c.feito = !c.feito; salvar(); render(); },
  'compra-del': el => { D.compras = D.compras.filter(x => x.id !== el.dataset.id); salvar(); render(); },
  'compra-limpar': () => { D.compras = D.compras.filter(x => !x.feito); salvar(); render(); },

  perfil: () => abrir(`<h2>Seu nome</h2><label class="rot">Como quer ser chamada?</label><input class="inp" id="p-nome" value="${esc(D.nome)}" placeholder="Seu nome"><button class="botao" data-a="p-salvar">Salvar</button>`),
  'p-salvar': () => { D.nome = $('#p-nome').value.trim(); pronto('✅ Salvo'); },
  aparencia: () => abrir(`<h2>Cor e tema</h2>
    <label class="rot">Cor principal</label><div class="cores">${CORES.map(c => `<button class="cor ${D.cor === c ? 'sel' : ''}" style="background:${c}" data-a="ap-cor" data-c="${c}"></button>`).join('')}</div>
    <label class="rot">Tema</label><div class="seg">${[['claro', '☀️ Claro'], ['escuro', '🌙 Escuro'], ['auto', '🌗 Auto']].map(([k, t]) => `<button class="${D.tema === k ? 'sel' : ''}" data-a="ap-tema" data-t="${k}">${t}</button>`).join('')}</div>
    <button class="botao" data-a="fechar">Pronto</button>`),
  'ap-cor': el => { D.cor = el.dataset.c; salvar(); render(); A.aparencia(); },
  'ap-tema': el => { D.tema = el.dataset.t; salvar(); render(); A.aparencia(); },
  backup: () => backup(),
  restaurar: () => restaurar(),
  csv: () => csv(),
  apagar: () => {
    if (!confirm('Apagar TODOS os dados? Isso não pode ser desfeito.')) return;
    if (prompt('Para confirmar, digite APAGAR') !== 'APAGAR') return;
    D = PADRAO(); D.iniciado = true; catSel = D.categorias[0].id; mesVisto = mesAtual(); pronto('Tudo apagado');
  },
  fechar: () => fechar(),
  'bv-cor': el => { D.cor = el.dataset.c; aplicarTema(); document.querySelectorAll('.cor').forEach(b => b.classList.toggle('sel', b === el)); },
  'boas-vindas': () => { D.nome = $('#bv-nome').value.trim(); D.iniciado = true; pronto(); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (el && A[el.dataset.a]) { e.preventDefault(); A[el.dataset.a](el); return; }
  const aba = e.target.closest('.abas button');
  if (aba) { tela = aba.dataset.tela; window.scrollTo(0, 0); render(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'compra-txt') A['compra-add'](); });
$('#fab').onclick = () => tela === 'gastos' ? formGasto(null) : formConta(null, mesVisto);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

/* ---------- Início ---------- */
render();
if (!D.iniciado) {
  abrir(`<div style="text-align:center;font-size:56px">🌸</div>
    <h2 style="text-align:center">Bem-vinda ao Contaí!</h2>
    <p class="sub" style="text-align:center;font-size:15px;margin-top:-4px">Suas contas, gastos e lista de compras num só lugar. Tudo fica salvo só no seu celular — ninguém mais vê.</p>
    <label class="rot">Como quer ser chamada?</label><input class="inp" id="bv-nome" placeholder="Seu nome">
    <label class="rot">Escolha sua cor</label><div class="cores">${CORES.map(c => `<button class="cor ${D.cor === c ? 'sel' : ''}" style="background:${c}" data-a="bv-cor" data-c="${c}"></button>`).join('')}</div>
    <button class="botao" data-a="boas-vindas">Começar 💕</button>`);
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
