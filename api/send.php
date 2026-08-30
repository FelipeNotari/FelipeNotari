<?php
/**
 * send.php — Recebe e grava um sinal.
 *
 * Entrada (POST, corpo JSON): {sala, senha, nome, instrumento, tipo, rotulo, ts}
 * Saída: {ok:true, ts} — nada além disso, para a resposta ser leve.
 */

require __DIR__ . '/lib.php';

header('Cache-Control: no-cache, no-store, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    responder_json(array('ok' => false, 'erro' => 'Use POST.'), 405);
}

$corpo = file_get_contents('php://input');
$dados = json_decode((string) $corpo, true);

if (!is_array($dados)) {
    responder_json(array('ok' => false, 'erro' => 'JSON inválido.'), 400);
}

$sala   = isset($dados['sala'])  ? (string) $dados['sala']  : '';
$senha  = isset($dados['senha']) ? (string) $dados['senha'] : '';
$rotulo = isset($dados['rotulo']) ? cortar_texto($dados['rotulo'], 28) : '';
$tipo   = isset($dados['tipo'])   ? (string) $dados['tipo']  : '';

// Só aceitamos as três categorias das abas.
if (!in_array($tipo, array('tom', 'volume', 'dinamica'), true)) {
    $tipo = 'dinamica';
}
if ($rotulo === '') {
    responder_json(array('ok' => false, 'erro' => 'Sinal sem rótulo.'), 400);
}

$sinal = array(
    'nome'        => cortar_texto(isset($dados['nome']) ? $dados['nome'] : '', 20),
    'instrumento' => cortar_texto(isset($dados['instrumento']) ? $dados['instrumento'] : '', 20),
    'tipo'        => $tipo,
    'rotulo'      => $rotulo,
    'ts'          => 0, // definido dentro do lock, em anexar_sinal()
);

$r = anexar_sinal($sala, $senha, $sinal);

if (!$r['ok']) {
    responder_json(array('ok' => false, 'erro' => $r['erro']), 403);
}

responder_json(array('ok' => true, 'ts' => $r['ts']));
