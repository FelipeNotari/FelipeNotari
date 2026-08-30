<?php
/**
 * lib.php — Funções compartilhadas de leitura/escrita das salas.
 *
 * Armazenamento: um arquivo JSON por sala em data/salas/{sha1_do_nome}.json
 * Toda escrita usa flock(LOCK_EX) e toda leitura usa flock(LOCK_SH).
 * Não há banco de dados, nem dependência externa.
 */

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

define('DIR_DADOS', dirname(__DIR__) . '/data');
define('DIR_SALAS', DIR_DADOS . '/salas');

define('MAX_SINAIS', 30);        // guarda no máximo os 30 últimos sinais da sala
define('VALIDADE_SEGUNDOS', 600); // descarta sinais com mais de 10 minutos

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Timestamp atual em milissegundos (inteiro). */
function agora_ms()
{
    return (int) round(microtime(true) * 1000);
}

/** Minúsculas com suporte a acento, caindo para strtolower se não houver mbstring. */
function minusculas($texto)
{
    if (function_exists('mb_strtolower')) {
        return mb_strtolower($texto, 'UTF-8');
    }
    return strtolower($texto);
}

/** Contagem de caracteres com suporte a acento. */
function tamanho_texto($texto)
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($texto, 'UTF-8');
    }
    return strlen($texto);
}

/** Corta um texto no limite de caracteres informado. */
function cortar_texto($texto, $limite)
{
    $texto = trim(preg_replace('/\s+/u', ' ', (string) $texto));
    if (function_exists('mb_substr')) {
        return mb_substr($texto, 0, $limite, 'UTF-8');
    }
    return substr($texto, 0, $limite);
}

/** Devolve uma resposta JSON e encerra a execução. */
function responder_json($dados, $codigo = 200)
{
    http_response_code($codigo);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Normaliza o nome da sala para que "Culto Domingo" e "culto  domingo" sejam a mesma sala. */
function nome_sala_normalizado($sala)
{
    return trim(preg_replace('/\s+/u', ' ', minusculas((string) $sala)));
}

/** Caminho do arquivo JSON da sala. */
function caminho_sala($sala)
{
    return DIR_SALAS . '/' . sha1(nome_sala_normalizado($sala)) . '.json';
}

/** Cria data/ e data/salas/ se ainda não existirem. Retorna true se puder escrever. */
function garantir_pastas()
{
    if (!is_dir(DIR_SALAS)) {
        @mkdir(DIR_SALAS, 0775, true);
    }
    return is_dir(DIR_SALAS) && is_writable(DIR_SALAS);
}

// ---------------------------------------------------------------------------
// Senha da sala
//
// A segurança aqui é básica de propósito (uso interno da igreja).
// Usamos SHA-256 com um "salt" aleatório por sala em vez de bcrypt porque o
// fallback de polling revalida a senha a cada 400 ms — bcrypt derrubaria a CPU
// de uma hospedagem compartilhada. A comparação é feita com hash_equals().
// ---------------------------------------------------------------------------

/** Gera o hash da senha a partir do salt da sala. */
function hash_senha($senha, $salt)
{
    return hash('sha256', $salt . '|' . $senha);
}

/** Gera um salt aleatório em hexadecimal. */
function novo_salt()
{
    if (function_exists('random_bytes')) {
        return bin2hex(random_bytes(16));
    }
    return bin2hex(pack('N*', mt_rand(), mt_rand(), mt_rand(), mt_rand()));
}

// ---------------------------------------------------------------------------
// Sinais
// ---------------------------------------------------------------------------

/**
 * Aplica a política de retenção:
 * descarta sinais com mais de 10 minutos e mantém apenas os 30 mais recentes.
 */
function limpar_sinais($sinais)
{
    if (!is_array($sinais)) {
        return array();
    }
    $limite = agora_ms() - (VALIDADE_SEGUNDOS * 1000);
    $vivos = array();
    foreach ($sinais as $s) {
        if (is_array($s) && isset($s['ts']) && (int) $s['ts'] >= $limite) {
            $vivos[] = $s;
        }
    }
    if (count($vivos) > MAX_SINAIS) {
        $vivos = array_slice($vivos, -MAX_SINAIS);
    }
    return array_values($vivos);
}

/** Filtra apenas os sinais mais novos que o timestamp informado. */
function sinais_desde($sinais, $desde)
{
    $desde = (int) $desde;
    $novos = array();
    if (!is_array($sinais)) {
        return $novos;
    }
    foreach ($sinais as $s) {
        if (isset($s['ts']) && (int) $s['ts'] > $desde) {
            $novos[] = $s;
        }
    }
    return $novos;
}

// ---------------------------------------------------------------------------
// Leitura / escrita do arquivo da sala
// ---------------------------------------------------------------------------

/** Lê o JSON da sala usando LOCK_SH. Retorna array ou null. */
function ler_sala($caminho)
{
    if (!is_file($caminho)) {
        return null;
    }
    $fp = @fopen($caminho, 'rb');
    if (!$fp) {
        return null;
    }
    if (!flock($fp, LOCK_SH)) {
        fclose($fp);
        return null;
    }
    $bruto = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    $dados = json_decode((string) $bruto, true);
    return is_array($dados) ? $dados : null;
}

/**
 * Abre a sala validando a senha. Se a sala não existir, ela é criada
 * na primeira entrada usando a senha informada.
 *
 * Retorna array('ok' => bool, 'erro' => string, 'caminho' => string, 'dados' => array)
 */
function abrir_sala($sala, $senha)
{
    $sala  = trim((string) $sala);
    $senha = (string) $senha;

    if ($sala === '' || tamanho_texto($sala) > 40) {
        return array('ok' => false, 'erro' => 'Nome de sala inválido.');
    }
    if ($senha === '' || strlen($senha) > 64) {
        return array('ok' => false, 'erro' => 'Senha inválida.');
    }
    if (!garantir_pastas()) {
        return array('ok' => false, 'erro' => 'A pasta data/salas não existe ou não tem permissão de escrita.');
    }

    $caminho = caminho_sala($sala);

    // 'c+' abre para leitura/escrita e cria o arquivo se não existir, sem truncar.
    $fp = @fopen($caminho, 'c+b');
    if (!$fp) {
        return array('ok' => false, 'erro' => 'Não foi possível abrir o arquivo da sala.');
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return array('ok' => false, 'erro' => 'Não foi possível travar o arquivo da sala.');
    }

    $bruto = stream_get_contents($fp);
    $dados = json_decode((string) $bruto, true);

    if (!is_array($dados) || !isset($dados['hash']) || !isset($dados['salt'])) {
        // Sala nova: criada na primeira entrada com a senha informada.
        $salt  = novo_salt();
        $dados = array(
            'nome'   => cortar_texto($sala, 40),
            'salt'   => $salt,
            'hash'   => hash_senha($senha, $salt),
            'criada' => agora_ms(),
            'sinais' => array(),
        );
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($dados, JSON_UNESCAPED_UNICODE));
        fflush($fp);
    } elseif (!hash_equals($dados['hash'], hash_senha($senha, $dados['salt']))) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return array('ok' => false, 'erro' => 'Senha incorreta.');
    }

    flock($fp, LOCK_UN);
    fclose($fp);

    if (!isset($dados['sinais']) || !is_array($dados['sinais'])) {
        $dados['sinais'] = array();
    }

    return array('ok' => true, 'erro' => '', 'caminho' => $caminho, 'dados' => $dados);
}

/**
 * Grava um sinal na sala (LOCK_EX), revalidando a senha dentro do lock.
 * Retorna array('ok' => bool, 'erro' => string, 'ts' => int)
 */
function anexar_sinal($sala, $senha, $sinal)
{
    $sala  = trim((string) $sala);
    $senha = (string) $senha;

    if ($sala === '' || $senha === '') {
        return array('ok' => false, 'erro' => 'Dados de sala incompletos.');
    }
    if (!garantir_pastas()) {
        return array('ok' => false, 'erro' => 'A pasta data/salas não existe ou não tem permissão de escrita.');
    }

    $caminho = caminho_sala($sala);
    $fp = @fopen($caminho, 'c+b');
    if (!$fp) {
        return array('ok' => false, 'erro' => 'Não foi possível abrir o arquivo da sala.');
    }
    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return array('ok' => false, 'erro' => 'Não foi possível travar o arquivo da sala.');
    }

    $bruto = stream_get_contents($fp);
    $dados = json_decode((string) $bruto, true);

    if (!is_array($dados) || !isset($dados['hash']) || !isset($dados['salt'])) {
        // Sala ainda não existe: cria com esta senha (mesma regra da entrada).
        $salt  = novo_salt();
        $dados = array(
            'nome'   => cortar_texto($sala, 40),
            'salt'   => $salt,
            'hash'   => hash_senha($senha, $salt),
            'criada' => agora_ms(),
            'sinais' => array(),
        );
    } elseif (!hash_equals($dados['hash'], hash_senha($senha, $dados['salt']))) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return array('ok' => false, 'erro' => 'Senha incorreta.');
    }

    if (!isset($dados['sinais']) || !is_array($dados['sinais'])) {
        $dados['sinais'] = array();
    }

    // O ts é a chave de ordenação usada pelo SSE e pelo polling (?desde=).
    // Forçamos que seja sempre estritamente crescente para não perder sinais
    // enviados dentro do mesmo milissegundo.
    $ts = agora_ms();
    $ultimo = end($dados['sinais']);
    if (is_array($ultimo) && isset($ultimo['ts']) && $ts <= (int) $ultimo['ts']) {
        $ts = (int) $ultimo['ts'] + 1;
    }
    $sinal['ts'] = $ts;

    $dados['sinais'][] = $sinal;
    $dados['sinais']   = limpar_sinais($dados['sinais']);

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($dados, JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    // Garante que o filemtime mude para o stream.php perceber na hora.
    @touch($caminho);
    clearstatcache(true, $caminho);

    return array('ok' => true, 'erro' => '', 'ts' => $ts);
}
