<?php
require_once __DIR__ . '/cors.php';
cors_headers('GET');
header('Content-Type: application/json');

$limit = min((int)($_GET['limit'] ?? 10), 100);

try {
    $pdo  = db_connect();
    $stmt = $pdo->prepare(
        'SELECT id, player_name AS playerName, instagram, score,
                UNIX_TIMESTAMP(created_at) * 1000 AS createdAt
         FROM scores
         ORDER BY score DESC, created_at ASC
         LIMIT :lim'
    );
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['id']        = (int)$row['id'];
        $row['score']     = (int)$row['score'];
        $row['createdAt'] = (int)$row['createdAt'];
    }

    echo json_encode($rows);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error']);
    error_log('leaderboard: ' . $e->getMessage());
}
