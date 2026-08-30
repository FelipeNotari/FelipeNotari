/* =========================================================================
   Sinais da Banda — toda a lógica do cliente.
   JavaScript puro, sem biblioteca, sem CDN.
   ========================================================================= */

(function () {
  'use strict';

  var CHAVE_CFG   = 'sinaisbanda.cfg'; // onde a entrada fica salva no localStorage
  var MAX_LISTA   = 5;                 // quantos sinais anteriores a lista mostra
  var MS_VELHO    = 20000;             // acima disso o sinal fica esmaecido
  var MS_POLL     = 400;               // intervalo do fallback de polling
  var MS_WATCHDOG = 14000;             // sem nenhum evento do SSE por esse tempo = canal morto

  // -----------------------------------------------------------------------
  // Estado
  // -----------------------------------------------------------------------

  var cfg       = null;   // {sala, senha, nome, instrumento}
  var sinais    = [];     // sinais conhecidos, do mais antigo para o mais novo
  var ultimoTs  = 0;      // ts do sinal mais recente já recebido
  var fonte     = null;   // EventSource ativo
  var errosSse  = 0;      // erros seguidos do EventSource (2 = cai para polling)
  var canal     = 'sse';  // canal em uso: 'sse' ou 'poll'
  var timerPoll = null;
  var timerWatchdog = null;
  var pollEmVoo = false;
  var fila      = [];     // fila offline de envios que falharam
  var wakeLock  = null;

  // -----------------------------------------------------------------------
  // Atalhos de DOM
  // -----------------------------------------------------------------------

  function $(sel) { return document.querySelector(sel); }

  var telaEntrada  = $('#tela-entrada');
  var telaPrincipal = $('#tela-principal');
  var formEntrada  = $('#form-entrada');
  var erroEntrada  = $('#erro-entrada');
  var btnEntrar    = $('#btn-entrar');
  var elStatus     = $('#status');
  var elStatusTxt  = $('#status-txt');
  var elDestaque   = $('#destaque');
  var elAnteriores = $('#anteriores');
  var elRotuloSala = $('#rotulo-sala');
  var elRotuloEu   = $('#rotulo-eu');
  var elEnvio      = $('#envio');
  var elAbas       = $('#abas');

  // -----------------------------------------------------------------------
  // Configuração salva
  // -----------------------------------------------------------------------

  function lerCfg() {
    try {
      var bruto = localStorage.getItem(CHAVE_CFG);
      if (!bruto) { return null; }
      var c = JSON.parse(bruto);
      if (c && c.sala && c.senha && c.nome && c.instrumento) { return c; }
    } catch (e) { /* localStorage bloqueado: segue sem salvar */ }
    return null;
  }

  function gravarCfg(c) {
    try { localStorage.setItem(CHAVE_CFG, JSON.stringify(c)); } catch (e) {}
  }

  function apagarCfg() {
    try { localStorage.removeItem(CHAVE_CFG); } catch (e) {}
  }

  // -----------------------------------------------------------------------
  // Indicador de conexão (verde = tempo real, amarelo = fallback, vermelho = offline)
  // -----------------------------------------------------------------------

  function setStatus(cor) {
    elStatus.className = cor === 'ok' ? 'status-ok' : (cor === 'poll' ? 'status-poll' : 'status-off');
    elStatusTxt.textContent = cor === 'ok' ? 'ao vivo' : (cor === 'poll' ? 'lento' : 'sem sinal');
  }

  // -----------------------------------------------------------------------
  // Renderização dos sinais recebidos
  // -----------------------------------------------------------------------

  function textoQuando(ts) {
    var s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) { return 'há ' + s + 's'; }
    var m = Math.floor(s / 60);
    return 'há ' + m + 'min';
  }

  function render(animar) {
    var ultimo = sinais.length ? sinais[sinais.length - 1] : null;

    if (!ultimo) {
      elDestaque.className = 'vazio';
      elDestaque.querySelector('.d-rotulo').textContent = 'Aguardando sinais';
      elDestaque.querySelector('.d-quem').textContent = '';
      elDestaque.querySelector('.d-quando').textContent = '';
    } else {
      elDestaque.className = 'tipo-' + ultimo.tipo;
      if (animar) {
        void elDestaque.offsetWidth;   // força reflow para a animação rodar de novo
        elDestaque.classList.add('novo');
      }
      elDestaque.querySelector('.d-rotulo').textContent = ultimo.rotulo;
      elDestaque.querySelector('.d-quem').textContent = ultimo.nome + ' · ' + ultimo.instrumento;
      elDestaque.querySelector('.d-quando').textContent = textoQuando(ultimo.ts);
    }

    // Os 5 anteriores, do mais recente para o mais antigo.
    var anteriores = sinais.slice(0, -1).slice(-MAX_LISTA).reverse();
    var html = '';
    for (var i = 0; i < anteriores.length; i++) {
      var s = anteriores[i];
      html += '<li class="tipo-' + s.tipo + '" data-ts="' + s.ts + '">' +
              '<span class="a-rotulo">' + escapar(s.rotulo) + '</span>' +
              '<span class="a-quem">' + escapar(s.nome) + ' · ' + escapar(s.instrumento) + '</span>' +
              '<span class="a-quando">' + textoQuando(s.ts) + '</span>' +
              '</li>';
    }
    elAnteriores.innerHTML = html;

    atualizarIdades();
  }

  function escapar(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Atualiza o "há Xs" e esmaece o que passou de 20 segundos. */
  function atualizarIdades() {
    var ultimo = sinais.length ? sinais[sinais.length - 1] : null;
    if (ultimo) {
      elDestaque.querySelector('.d-quando').textContent = textoQuando(ultimo.ts);
      elDestaque.classList.toggle('velho', (Date.now() - ultimo.ts) > MS_VELHO);
    }
    var itens = elAnteriores.children;
    for (var i = 0; i < itens.length; i++) {
      var ts = parseInt(itens[i].getAttribute('data-ts'), 10);
      itens[i].querySelector('.a-quando').textContent = textoQuando(ts);
      itens[i].classList.toggle('velho', (Date.now() - ts) > MS_VELHO);
    }
  }

  /* Entrada de sinais vindos do servidor (SSE ou polling). */
  function receber(novos, animar) {
    if (!novos || !novos.length) { return; }
    var houveNovo = false;
    for (var i = 0; i < novos.length; i++) {
      var s = novos[i];
      if (!s || typeof s.ts !== 'number' || s.ts <= ultimoTs) { continue; }
      sinais.push(s);
      ultimoTs = s.ts;
      houveNovo = true;
    }
    if (!houveNovo) { return; }
    if (sinais.length > 30) { sinais = sinais.slice(-30); }
    render(animar);
    if (animar && navigator.vibrate) {
      try { navigator.vibrate(60); } catch (e) {}
    }
  }

  // -----------------------------------------------------------------------
  // Tempo real: SSE
  // -----------------------------------------------------------------------

  function urlCanal(arquivo) {
    return 'api/' + arquivo +
           '?sala='  + encodeURIComponent(cfg.sala) +
           '&senha=' + encodeURIComponent(cfg.senha) +
           '&desde=' + ultimoTs;
  }

  function abrirSse() {
    fecharSse();
    if (typeof EventSource === 'undefined') { irParaPolling(); return; }

    try {
      fonte = new EventSource(urlCanal('stream.php'));
    } catch (e) {
      irParaPolling();
      return;
    }

    fonte.onopen = function () {
      errosSse = 0;
      setStatus('ok');
      armarWatchdog();
    };

    fonte.addEventListener('sinais', function (ev) {
      armarWatchdog();
      try {
        var d = JSON.parse(ev.data);
        receber(d.sinais, true);
      } catch (e) {}
    });

    fonte.addEventListener('ping', function () { armarWatchdog(); });

    // Fim normal do ciclo de 30s: o EventSource reconecta sozinho.
    fonte.addEventListener('fim', function () { armarWatchdog(); });

    fonte.onerror = function () {
      errosSse++;
      if (errosSse >= 2 || (fonte && fonte.readyState === 2)) {
        // Dois erros seguidos (ou conexão fechada de vez): cai para polling.
        irParaPolling();
      } else {
        setStatus('off');
      }
    };
  }

  function fecharSse() {
    if (fonte) {
      try { fonte.close(); } catch (e) {}
      fonte = null;
    }
    if (timerWatchdog) { clearTimeout(timerWatchdog); timerWatchdog = null; }
  }

  /* Se o SSE parar de dar sinal de vida, tratamos como erro. */
  function armarWatchdog() {
    if (timerWatchdog) { clearTimeout(timerWatchdog); }
    timerWatchdog = setTimeout(function () {
      errosSse++;
      if (errosSse >= 2) { irParaPolling(); } else { abrirSse(); }
    }, MS_WATCHDOG);
  }

  // -----------------------------------------------------------------------
  // Fallback: polling a cada 400 ms
  // -----------------------------------------------------------------------

  function irParaPolling() {
    if (canal === 'poll') { return; }
    canal = 'poll';
    fecharSse();
    setStatus('poll');
    if (timerPoll) { clearInterval(timerPoll); }
    timerPoll = setInterval(puxar, MS_POLL);
    puxar();
  }

  function puxar() {
    if (pollEmVoo) { return; }
    pollEmVoo = true;
    fetch(urlCanal('poll.php'), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        pollEmVoo = false;
        setStatus('poll');
        receber(d.sinais, true);
        descarregarFila();
      })
      .catch(function () {
        pollEmVoo = false;
        setStatus('off');
      });
  }

  // -----------------------------------------------------------------------
  // Envio de sinais (otimista: pinta o botão e manda em paralelo)
  // -----------------------------------------------------------------------

  function enviar(tipo, rotulo) {
    var carga = {
      sala:        cfg.sala,
      senha:       cfg.senha,
      nome:        cfg.nome,
      instrumento: cfg.instrumento,
      tipo:        tipo,
      rotulo:      rotulo,
      ts:          Date.now()
    };
    despachar(carga);
  }

  function despachar(carga) {
    fetch('api/send.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(carga),
      cache: 'no-store',
      keepalive: true
    })
      .then(function (r) {
        if (!r.ok) { throw new Error('falhou'); }
        descarregarFila();
      })
      .catch(function () {
        // Fila offline: guarda em memória e reenvia quando a conexão voltar.
        fila.push(carga);
        if (fila.length > 30) { fila = fila.slice(-30); }
      });
  }

  function descarregarFila() {
    if (!fila.length) { return; }
    var pendentes = fila;
    fila = [];
    for (var i = 0; i < pendentes.length; i++) {
      despachar(pendentes[i]);
    }
  }

  // -----------------------------------------------------------------------
  // Interação: 1 toque = 1 sinal (pointerdown, sem os 300ms do click)
  // -----------------------------------------------------------------------

  function pintar(bt) {
    bt.classList.add('ativo');
    setTimeout(function () { bt.classList.remove('ativo'); }, 150);
  }

  elEnvio.addEventListener('pointerdown', function (ev) {
    var bt = ev.target.closest('.bt');
    if (bt) {
      ev.preventDefault();
      pintar(bt);                                        // feedback imediato
      enviar(bt.getAttribute('data-tipo'), bt.getAttribute('data-rotulo'));
      return;
    }
    var aba = ev.target.closest('.aba');
    if (aba) {
      ev.preventDefault();
      trocarAba(aba.getAttribute('data-aba'));
    }
  }, { passive: false });

  // Evita o clique fantasma depois do pointerdown.
  elEnvio.addEventListener('click', function (ev) {
    if (ev.target.closest('.bt') || ev.target.closest('.aba')) { ev.preventDefault(); }
  });

  function trocarAba(nome) {
    var abas = elAbas.querySelectorAll('.aba');
    for (var i = 0; i < abas.length; i++) {
      abas[i].classList.toggle('ativa', abas[i].getAttribute('data-aba') === nome);
    }
    var paineis = elEnvio.querySelectorAll('.painel');
    for (var j = 0; j < paineis.length; j++) {
      paineis[j].classList.toggle('ativo', paineis[j].id === 'painel-' + nome);
    }
  }

  // -----------------------------------------------------------------------
  // Tela ligada durante o culto
  // -----------------------------------------------------------------------

  function pedirWakeLock() {
    if (!('wakeLock' in navigator)) { return; }
    navigator.wakeLock.request('screen')
      .then(function (w) {
        wakeLock = w;
        w.addEventListener('release', function () { wakeLock = null; });
      })
      .catch(function () {});
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') { return; }
    // Ao voltar do background: refaz o wakeLock e reconecta o canal.
    if (!wakeLock) { pedirWakeLock(); }
    if (canal === 'poll') { puxar(); }
    else { errosSse = 0; abrirSse(); }
  });

  window.addEventListener('online', function () {
    descarregarFila();
    if (canal === 'poll') { puxar(); } else { errosSse = 0; abrirSse(); }
  });

  // -----------------------------------------------------------------------
  // Entrada na sala
  // -----------------------------------------------------------------------

  function entrar(c, vindoDoForm) {
    cfg = c;
    return fetch('api/poll.php' +
                 '?sala='  + encodeURIComponent(c.sala) +
                 '&senha=' + encodeURIComponent(c.senha) +
                 '&desde=0', { cache: 'no-store' })
      .then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, d: d }; });
      })
      .then(function (res) {
        if (!res.ok || !res.d.ok) { throw new Error(res.d && res.d.erro ? res.d.erro : 'Não foi possível entrar.'); }
        gravarCfg(c);
        abrirTelaPrincipal(res.d.sinais || []);
      })
      .catch(function (e) {
        cfg = null;
        if (vindoDoForm) {
          erroEntrada.textContent = e.message || 'Não foi possível entrar.';
          btnEntrar.disabled = false;
        } else {
          // Falha ao reentrar automaticamente: volta para o formulário preenchido.
          mostrarFormulario(c);
          erroEntrada.textContent = e.message || 'Não foi possível entrar.';
        }
      });
  }

  function abrirTelaPrincipal(iniciais) {
    telaEntrada.classList.add('oculto');
    telaPrincipal.classList.remove('oculto');

    elRotuloSala.textContent = cfg.sala;
    elRotuloEu.textContent = cfg.nome + ' · ' + cfg.instrumento;

    sinais = [];
    ultimoTs = 0;
    canal = 'sse';
    receber(iniciais, false);
    render(false);

    setStatus('off');
    abrirSse();
    pedirWakeLock();
  }

  function mostrarFormulario(c) {
    telaPrincipal.classList.add('oculto');
    telaEntrada.classList.remove('oculto');
    btnEntrar.disabled = false;
    if (c) {
      $('#in-sala').value  = c.sala || '';
      $('#in-nome').value  = c.nome || '';
      $('#in-instrumento').value = c.instrumento || 'Voz';
    }
  }

  formEntrada.addEventListener('submit', function (ev) {
    ev.preventDefault();
    erroEntrada.textContent = '';
    btnEntrar.disabled = true;
    entrar({
      sala:        $('#in-sala').value.trim(),
      senha:       $('#in-senha').value,
      nome:        $('#in-nome').value.trim(),
      instrumento: $('#in-instrumento').value
    }, true);
  });

  $('#btn-trocar').addEventListener('click', function () {
    apagarCfg();
    fecharSse();
    if (timerPoll) { clearInterval(timerPoll); timerPoll = null; }
    canal = 'sse';
    location.reload();
  });

  // Relógio do "há Xs" e do esmaecimento.
  setInterval(atualizarIdades, 1000);

  // Reenvio periódico da fila offline.
  setInterval(descarregarFila, 3000);

  // Início: se já entrou antes, entra direto sem redigitar nada.
  var salvo = lerCfg();
  if (salvo) { entrar(salvo, false); } else { mostrarFormulario(null); }

})();
