<?php
require_once __DIR__ . '/cors.php';
cors_headers('POST');
header('Content-Type: application/json');

$body = json_decode(file_get_contents('php://input'), true);

$playerName = trim((string)($body['playerName'] ?? ''));
$instagram  = trim((string)($body['instagram']  ?? ''));
$score      = (int)($body['score'] ?? 0);

$instagram = ltrim($instagram, '@');

if ($playerName === '' || mb_strlen($playerName) > 100) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid playerName']);
    exit;
}
if ($instagram !== '' && !preg_match('/^[a-zA-Z0-9._]{1,30}$/', $instagram)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid instagram username']);
    exit;
}
if ($score < 0 || $score > 9999) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid score']);
    exit;
}

try {
    $pdo  = db_connect();
    $stmt = $pdo->prepare(
        'INSERT INTO scores (player_name, instagram, score) VALUES (:name, :ig, :score)'
    );
    $stmt->execute([
        ':name'  => $playerName,
        ':ig'    => $instagram,
        ':score' => $score,
    ]);
    echo json_encode(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
    error_log('submit_score: ' . $e->getMessage());
}
