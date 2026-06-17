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
    $pdo = db_connect();

    if ($instagram !== '') {
        $checkStmt = $pdo->prepare('SELECT id, score FROM scores WHERE instagram = :ig LIMIT 1');
        $checkStmt->execute([':ig' => $instagram]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            $score = (int)$existing['score'] + $score;
            $pdo->prepare('UPDATE scores SET player_name = :name, score = :score WHERE instagram = :ig')
                ->execute([':name' => $playerName, ':score' => $score, ':ig' => $instagram]);
        } else {
            $pdo->prepare('INSERT INTO scores (player_name, instagram, score) VALUES (:name, :ig, :score)')
                ->execute([':name' => $playerName, ':ig' => $instagram, ':score' => $score]);
        }
    } else {
        $pdo->prepare('INSERT INTO scores (player_name, instagram, score) VALUES (:name, :ig, :score)')
            ->execute([':name' => $playerName, ':ig' => $instagram, ':score' => $score]);
    }

    $rankStmt = $pdo->prepare('SELECT COUNT(*) FROM scores WHERE score > :score');
    $rankStmt->execute([':score' => $score]);
    $rank = (int)$rankStmt->fetchColumn() + 1;
    echo json_encode(['ok' => true, 'rank' => $rank]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
    error_log('submit_score: ' . $e->getMessage());
}
