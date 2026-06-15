<?php
require_once __DIR__ . '/config.php';

function cors_headers(string $method = 'GET'): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (in_array($origin, ALLOWED_ORIGINS, true)) {
        header("Access-Control-Allow-Origin: $origin");
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 86400');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        http_response_code(405);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }
}

function db_connect(): PDO {
    $charset = defined('DB_CHARSET') ? DB_CHARSET : 'utf8mb4';
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, $charset);
    return new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}
