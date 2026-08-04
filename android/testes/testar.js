/* Testa os assets do app no mesmo motor (Chromium/WebView), com um mock da
   ponte nativa AndroidStore que espelha o PonteArmazenamento.java. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', 'app', 'src', 'main', 'assets');
const TIPOS = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
                '.woff2': 'font/woff2' };

let ok = 0, falhas = [];
function checa(nome, cond, extra) {
  if (cond) { ok++; console.log('  ok   ' + nome); }
  else { falhas.push(nome + (extra ? ' -> ' + extra : '')); console.log('  FALHA ' + nome + (extra ? ' -> ' + extra : '')); }
}
const igual = (nome, a, b) => checa(nome, a === b, `esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);

/* servidor estatico local, imitando a origem virtual do app */
const servidor = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const arq = path.join(RAIZ, rel);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
    res.writeHead(404); res.end('404'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  res.end(fs.readFileSync(arq));
});

/* mock da interface nativa: mesmos metodos do PonteArmazenamento.java */
const MOCK = `
  (function(){
    var mem = window.localStorage;               // sobrevive ao reload, como o SharedPreferences
    window.__copiado = null;
    window.AndroidStore = {
      get: function(k){ var v = mem.getItem('nativo:' + k); return v === null ? null : v; },
      set: function(k, v){ mem.setItem('nativo:' + k, String(v)); },
      remove: function(k){ mem.removeItem('nativo:' + k); },
      copy: function(t){ window.__copiado = String(t); }
    };
  })();
`;

const espera = (p, ms = 120) => p.waitForTimeout(ms);

async function arrastar(pag, de, para) {
  const a = await de.boundingBox(), b = await para.boundingBox();
  const vp = pag.viewportSize();
  for (const [q, cx] of [['origem', a], ['destino', b]]) {
    if (cx.x < 0 || cx.y < 0 || cx.x + cx.width > vp.width || cx.y + cx.height > vp.height) {
      throw new Error(`o ${q} do arrasto esta fora da tela: ${JSON.stringify(cx)}`);
    }
  }
  await pag.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await pag.mouse.down();
  await pag.mouse.move(a.x + a.width / 2, a.y + a.height / 2 - 30, { steps: 4 });
  await pag.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await espera(pag, 80);
  await pag.mouse.up();
  await espera(pag, 150);
}

(async () => {
  await new Promise(r => servidor.listen(8099, '127.0.0.1', r));
  const nav = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await nav.newContext({
    viewport: { width: 393, height: 830 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    locale: 'pt-BR',
  });
  await ctx.addInitScript(MOCK);

  const erros = [], externos = [];
  const pag = await ctx.newPage();
  pag.on('pageerror', e => erros.push(String(e)));
  pag.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  pag.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:8099')) externos.push(r.url()); });

  const abrir = async () => { await pag.goto('http://127.0.0.1:8099/index.html'); await espera(pag, 350); };
  await abrir();

  console.log('\n== 1. carregamento e estado inicial ==');
  igual('titulo da pagina', await pag.title(), 'Escala do Apoio — Igreja Meta');
  igual('cabecalho', (await pag.locator('h1.titulo').innerText()).replace(/\s+/g, ' ').trim(), 'ESCALA DO APOIO');
  igual('linhas de funcao', await pag.locator('tbody tr').count(), 3);
  igual('colunas de data', await pag.locator('thead .data-topo').count(), 5);
  igual('nomes no dock', await pag.locator('.pin').count(), 15);
  igual('quadros vazios', await pag.locator('.slot.vazio').count(), 15);
  checa('periodo preenchido', /5 cultos ·/.test(await pag.locator('#periodo').innerText()),
        await pag.locator('#periodo').innerText());
  // o CSS deixa os rotulos em maiuscula, entao comparamos o texto real do DOM
  igual('funcoes padrao', await pag.$$eval('.rot-func', e => e.map(x => x.textContent).join('|')),
        'Diretor|Apoio 1|Apoio 2');
  const datasSaoDomingo = await pag.$$eval('.data-mes', els => els.every(e => e.textContent.startsWith('dom')));
  checa('todas as datas caem no domingo', datasSaoDomingo);

  console.log('\n== 2. fontes empacotadas ==');
  const fontes = await pag.evaluate(async () => {
    await document.fonts.ready;
    return {
      archivo: document.fonts.check('800 30px Archivo'),
      inter: document.fonts.check('500 15px Inter'),
      mono: document.fonts.check('700 18px "JetBrains Mono"'),
      carregadas: [...document.fonts].map(f => f.family + ':' + f.status),
    };
  });
  checa('Archivo carregada', fontes.archivo, JSON.stringify(fontes.carregadas));
  checa('Inter carregada', fontes.inter, JSON.stringify(fontes.carregadas));
  checa('JetBrains Mono carregada', fontes.mono, JSON.stringify(fontes.carregadas));
  const fam = await pag.locator('h1.titulo').evaluate(e => getComputedStyle(e).fontFamily);
  checa('titulo usa Archivo', /Archivo/.test(fam), fam);

  console.log('\n== 3. escalar pelo painel ==');
  await pag.locator('.slot.vazio').first().click();
  await espera(pag, 320);
  checa('painel abriu', await pag.locator('#painel.aberto').count() === 1);
  igual('painel lista a equipe', await pag.locator('#painelCorpo .item').count(), 15);
  const primeiroNome = await pag.locator('#painelCorpo .item .item-nome').first().innerText();
  await pag.locator('#painelCorpo .item').first().click();
  await espera(pag, 320);
  checa('painel fechou', await pag.locator('#painel.aberto').count() === 0);
  igual('quadro preenchido', await pag.locator('tbody tr').first().locator('.slot').first().innerText(), primeiroNome);
  igual('vazios agora', await pag.locator('.slot.vazio').count(), 14);
  const contador = await pag.locator('.pin', { hasText: primeiroNome }).first().locator('.n').innerText();
  igual('contador do nome no dock', contador, '1');

  console.log('\n== 4. persistencia no armazenamento local ==');
  const gravado = await pag.evaluate(() => window.AndroidStore.get('escala-apoio-meta-v2'));
  checa('gravou na ponte nativa', !!gravado && gravado.includes('escala'), String(gravado).slice(0, 60));
  await abrir();
  igual('depois de reabrir o app, o nome continua la',
        await pag.locator('tbody tr').first().locator('.slot').first().innerText(), primeiroNome);
  igual('quadros vazios apos reabrir', await pag.locator('.slot.vazio').count(), 14);

  console.log('\n== 5. selecionar nome e tocar no quadro ==');
  const segundo = pag.locator('.pin').nth(1);
  const nome2 = (await segundo.innerText()).replace(/\d+$/, '').trim();
  await segundo.click();
  await espera(pag);
  checa('nome ficou selecionado', await pag.locator('.pin.sel').count() === 1);
  checa('dica mudou', (await pag.locator('#dica').innerText()).includes('Agora toque no quadro'));
  await pag.locator('.slot.vazio').first().click();
  await espera(pag, 200);
  const escalados = await pag.locator('.slot:not(.vazio)').allInnerTexts();
  checa('segundo nome entrou na escala', escalados.includes(nome2), escalados.join(','));
  checa('selecao foi limpa', await pag.locator('.pin.sel').count() === 0);

  console.log('\n== 6. arrastar e soltar ==');
  // 3a linha, 1a coluna: dentro da tela, sem precisar rolar
  const alvo = pag.locator('tbody tr').nth(2).locator('.slot').nth(0);
  const pin3 = pag.locator('.pin').nth(2);
  const nome3 = (await pin3.innerText()).replace(/\d+$/, '').trim();
  await arrastar(pag, pin3, alvo);
  const depoisArrasto = await pag.locator('.slot:not(.vazio)').allInnerTexts();
  checa('arrastar do dock escalou o nome', depoisArrasto.includes(nome3), depoisArrasto.join(','));
  igual('o nome caiu no quadro certo', await alvo.innerText(), nome3);

  const ocupado = alvo;
  const destino = pag.locator('tbody tr').nth(2).locator('.slot').nth(1);
  await arrastar(pag, ocupado, destino);
  igual('o nome chegou no novo quadro', await destino.innerText(), nome3);
  const contagem = await pag.locator('.slot:not(.vazio)').allInnerTexts().then(t => t.filter(x => x === nome3).length);
  igual('mover entre quadros nao duplica o nome', contagem, 1);

  console.log('\n== 7. aviso de nome repetido no mesmo dia ==');
  await pag.evaluate(() => { document.querySelectorAll('.slot').forEach(s => s.classList.remove('x')); });
  const linha0 = pag.locator('tbody tr').nth(0).locator('.slot');
  const linha1 = pag.locator('tbody tr').nth(1).locator('.slot');
  await linha0.nth(1).click(); await espera(pag, 300);
  await pag.locator('#painelCorpo .item').first().click(); await espera(pag, 250);
  const alvoNome = await linha0.nth(1).innerText();
  await linha1.nth(1).click(); await espera(pag, 300);
  await pag.locator('#painelCorpo .item').filter({ hasText: alvoNome }).first().click();
  await espera(pag, 250);
  igual('mesma pessoa duas vezes no dia fica destacada', await pag.locator('.slot.repetido').count(), 2);

  console.log('\n== 8. datas ==');
  const antes = await pag.locator('.data-topo').count();
  await pag.locator('#btnDomingo').click(); await espera(pag, 250);
  igual('adicionar domingo', await pag.locator('.data-topo').count(), antes + 1);
  checa('aviso apareceu', (await pag.locator('#toast').innerText()).includes('adicionado'));
  const novaData = pag.locator('.data-inp').last();
  await novaData.fill('25/12'); await novaData.press('Enter'); await espera(pag, 300);
  const avisoNatal = await pag.locator('#toast').innerText();
  checa('avisa quando a data nao e domingo', /nao e domingo|não é domingo/.test(avisoNatal), avisoNatal);
  const textos = await pag.locator('.data-inp').evaluateAll(els => els.map(e => e.value));
  checa('data 25/12 registrada', textos.includes('25/12'), textos.join(','));
  await pag.locator('.data-topo').last().locator('.tirar-dia').click(); await espera(pag, 320);
  await pag.locator('#painelCorpo .btn-1').click(); await espera(pag, 250);
  igual('remover culto', await pag.locator('.data-topo').count(), antes);

  console.log('\n== 9. pessoas ==');
  await pag.locator('#btnPessoas').click(); await espera(pag, 320);
  await pag.locator('#painelCorpo .campo').fill('Teste Silva');
  await pag.locator('#painelCorpo .add').click(); await espera(pag, 300);
  igual('pessoa adicionada', await pag.locator('.pin').count(), 16);
  const linhaTeste = pag.locator('#painelCorpo .item').filter({ hasText: 'Teste Silva' }).first();
  await linhaTeste.locator('.icone-btn').first().click(); await espera(pag, 320);
  await pag.locator('#painelCorpo .campo').fill('Teste Renomeado');
  await pag.locator('#painelCorpo .btn-1').click(); await espera(pag, 320);
  const nomesDock = await pag.locator('.pin').allInnerTexts();
  checa('pessoa renomeada', nomesDock.some(n => n.includes('Teste Renomeado')), nomesDock.join(','));
  const linhaRen = pag.locator('#painelCorpo .item').filter({ hasText: 'Teste Renomeado' }).first();
  await linhaRen.locator('.icone-btn').nth(1).click(); await espera(pag, 320);
  await pag.locator('#painelCorpo .btn-1').click(); await espera(pag, 320);
  igual('pessoa removida', await pag.locator('.pin').count(), 15);
  await pag.locator('#fundo').click({ position: { x: 12, y: 12 } }); await espera(pag, 300);

  console.log('\n== 10. funcoes ==');
  await pag.locator('.rot-func').first().click(); await espera(pag, 320);
  await pag.locator('#painelCorpo .campo').fill('Lider');
  await pag.locator('#painelCorpo .btn-1').click(); await espera(pag, 320);
  igual('funcao renomeada', await pag.locator('.rot-func').first().textContent(), 'Lider');
  await pag.locator('.rot-func').first().click(); await espera(pag, 320);
  await pag.locator('#painelCorpo .btn-2').first().click(); await espera(pag, 320);
  igual('funcao adicionada', await pag.locator('tbody tr').count(), 4);
  await pag.locator('.rot-func').last().click(); await espera(pag, 320);
  await pag.locator('#painelCorpo .btn-2').last().click(); await espera(pag, 320);
  await pag.locator('#painelCorpo .btn-1').click(); await espera(pag, 320);
  igual('funcao removida', await pag.locator('tbody tr').count(), 3);

  console.log('\n== 11. equilibrio da equipe ==');
  const linhasBal = await pag.locator('.linha-bal').count();
  igual('uma linha por pessoa', linhasBal, 15);
  const somaBal = await pag.$$eval('.cont-bal', els =>
    els.reduce((s, e) => s + parseInt(e.textContent, 10), 0));
  const escaladosAgora = await pag.locator('.slot:not(.vazio)').count();
  igual('soma do equilibrio bate com os quadros preenchidos', somaBal, escaladosAgora);

  console.log('\n== 12. copiar para o WhatsApp ==');
  await pag.locator('#btnCopiar').click(); await espera(pag, 300);
  const copiado = await pag.evaluate(() => window.__copiado);
  checa('foi para a area de transferencia nativa', !!copiado, String(copiado).slice(0, 40));
  checa('texto tem o cabecalho', /\*ESCALA DO APOIO — Igreja Meta\*/.test(copiado || ''));
  checa('texto tem as funcoes', (copiado || '').includes('Lider:'), (copiado || '').split('\n').slice(0, 6).join(' / '));
  checa('aviso de copiado', (await pag.locator('#toast').innerText()).includes('copiada'));

  console.log('\n== 13. limpar e recomecar ==');
  await pag.locator('#btnLimpar').click(); await espera(pag, 320);
  await pag.locator('#painelCorpo .btn-1').click(); await espera(pag, 320);
  igual('escala limpa', await pag.locator('.slot:not(.vazio)').count(), 0);
  checa('datas continuam', await pag.locator('.data-topo').count() === 5);
  await pag.locator('#btnRestaurar').click(); await espera(pag, 320);
  await pag.locator('#painelCorpo .btn-1').click(); await espera(pag, 350);
  igual('recomecou com 3 funcoes', await pag.locator('tbody tr').count(), 3);
  igual('recomecou com 15 nomes', await pag.locator('.pin').count(), 15);
  igual('recomecou com 5 domingos', await pag.locator('.data-topo').count(), 5);
  await abrir();
  igual('recomeco tambem ficou salvo', await pag.locator('.slot.vazio').count(), 15);

  console.log('\n== 14. saude geral ==');
  checa('sem erros de JavaScript', erros.length === 0, erros.join(' | '));
  checa('nenhum acesso a internet', externos.length === 0, externos.join(' | '));
  const larguraOk = await pag.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth + 1);
  checa('sem rolagem horizontal na pagina', larguraOk);
  const dockVisivel = await pag.locator('.dock').isVisible();
  checa('dock de nomes visivel', dockVisivel);

  await pag.screenshot({ path: path.join(__dirname, 'tela.png') });

  await nav.close();
  servidor.close();

  console.log(`\n=== ${ok} verificacoes ok, ${falhas.length} falhas ===`);
  if (falhas.length) { falhas.forEach(f => console.log(' - ' + f)); process.exit(1); }
})().catch(e => { console.error('ERRO NO TESTE:', e); process.exit(2); });
