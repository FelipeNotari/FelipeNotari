<?php
/**
 * poll.php — Fallback de polling (usado quando o SSE falha)
 * e também a chamada usada pela tela de entrada para validar a senha.
 *
 * GET: ?sala=...&senha=...&desde={ts_do_ultimo_sinal}
 * Saída: {ok:true, ts, sinais:[...]}
 */

require __DIR__ . '/lib.php';

header('Cache-Control: no-cache, no-store, must-revalidate');

$sala  = isset($_GET['sala'])  ? (string) $_GET['sala']  : '';
$senha = isset($_GET['senha']) ? (string) $_GET['senha'] : '';
$desde = isset($_GET['desde']) ? (int) $_GET['desde'] : 0;

// Valida a senha (e cria a sala se for a primeira entrada).
$r = abrir_sala($sala, $senha);
if (!$r['ok']) {
    responder_json(array('ok' => false, 'erro' => $r['erro']), 403);
}

$dados  = $r['dados'];
$sinais = isset($dados['sinais']) ? $dados['sinais'] : array();

if ($desde <= 0) {
    // Primeira carga: manda só os 6 últimos, que é o que a tela mostra.
    $novos = array_slice($sinais, -6);
} else {
    $novos = sinais_desde($sinais, $desde);
}

responder_json(array(
    'ok'     => true,
    'ts'     => agora_ms(),
    'sinais' => array_values($novos),
));
