<?php
/**
 * stream.php — Tempo real via SSE (Server-Sent Events).
 *
 * GET: ?sala=...&senha=...&desde={ts_do_ultimo_sinal}
 *
 * O loop dura no máximo 30 segundos e checa o filemtime() do arquivo da sala
 * a cada 200 ms. Ao final do loop a conexão é encerrada e o EventSource do
 * navegador reconecta sozinho.
 */

require __DIR__ . '/lib.php';

// Desliga qualquer buffer/compressão que atrase o envio dos eventos.
@ini_set('zlib.output_compression', '0');
@ini_set('output_buffering', 'off');
@ini_set('implicit_flush', '1');
if (function_exists('apache_setenv')) {
    @apache_setenv('no-gzip', '1');
    @apache_setenv('dont-vary', '1');
}
@set_time_limit(0);
ignore_user_abort(false);

$sala  = isset($_GET['sala'])  ? (string) $_GET['sala']  : '';
$senha = isset($_GET['senha']) ? (string) $_GET['senha'] : '';
$desde = isset($_GET['desde']) ? (int) $_GET['desde'] : 0;

// Autentica antes de abrir o stream.
$r = abrir_sala($sala, $senha);
if (!$r['ok']) {
    responder_json(array('ok' => false, 'erro' => $r['erro']), 403);
}

$caminho = $r['caminho'];

header('Content-Type: text/event-stream; charset=utf-8');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no'); // impede buffer de proxy (nginx na frente do Apache)

while (ob_get_level() > 0) {
    @ob_end_flush();
}
ob_implicit_flush(true);

// Enchimento inicial: alguns buffers do Apache só liberam depois de ~1-2 KB.
echo ':' . str_repeat(' ', 2048) . "\n\n";
echo "retry: 1000\n\n";
flush();

$inicio       = microtime(true);
$mtime        = -1;
$tamanho      = -1;
$ultimaLeitura = 0.0;
$ultimoPing    = microtime(true);

while ((microtime(true) - $inicio) < 30) {
    if (connection_aborted()) {
        break;
    }

    $agora = microtime(true);
    clearstatcache(true, $caminho);
    $m = @filemtime($caminho);
    $t = @filesize($caminho);

    // Relê quando o arquivo mudou (mtime ou tamanho). A releitura forçada a
    // cada 1 s é uma rede de segurança, porque filemtime() só tem precisão de
    // 1 segundo e dois sinais podem cair no mesmo segundo.
    if ($m !== $mtime || $t !== $tamanho || ($agora - $ultimaLeitura) >= 1.0) {
        $mtime         = $m;
        $tamanho       = $t;
        $ultimaLeitura = $agora;

        $dados = ler_sala($caminho);
        if (is_array($dados) && isset($dados['sinais'])) {
            $novos = sinais_desde($dados['sinais'], $desde);
            if (count($novos) > 0) {
                $ultimo = end($novos);
                $desde  = (int) $ultimo['ts'];
                echo "event: sinais\n";
                echo 'data: ' . json_encode(array('sinais' => array_values($novos)), JSON_UNESCAPED_UNICODE) . "\n\n";
                flush();
                $ultimoPing = $agora;
            }
        }
    }

    // Ping periódico: mantém a conexão viva e permite ao cliente perceber
    // rapidamente que o canal morreu.
    if (($agora - $ultimoPing) >= 3.0) {
        $ultimoPing = $agora;
        echo "event: ping\n";
        echo "data: {}\n\n";
        flush();
    }

    usleep(200000); // 200 ms
}

// Fim normal do ciclo: o EventSource reconecta sozinho.
echo "event: fim\n";
echo "data: {}\n\n";
flush();
