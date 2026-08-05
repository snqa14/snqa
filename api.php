<?php
/**
 * File-based API for shared VPS hosting.
 *
 * Deploy this file together with index.html, script.js, style.css, and data.json.
 * It avoids a long-running Python process while preserving the same JSON shape.
 */

declare(strict_types=1);

const TARGET = 240000;
$dataFile = __DIR__ . DIRECTORY_SEPARATOR . 'data.json';
$defaultData = [
    'money' => 0,
    'images' => [],
    'daily' => new stdClass(),
];

function sendJson(array|stdClass $payload, int $statusCode = 200): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
    exit;
}

function normalizeData(mixed $data): array
{
    if (!is_array($data)) {
        return ['money' => 0, 'images' => [], 'daily' => new stdClass()];
    }

    $daily = $data['daily'] ?? new stdClass();
    if (is_array($daily) && $daily === []) {
        $daily = new stdClass();
    } elseif (!is_array($daily) && !$daily instanceof stdClass) {
        $daily = new stdClass();
    }

    return [
        'money' => max((int)($data['money'] ?? 0), 0),
        'images' => is_array($data['images'] ?? null) ? $data['images'] : [],
        'daily' => $daily,
    ];
}

function readData(string $dataFile, array $defaultData): array
{
    if (!is_file($dataFile)) {
        return $defaultData;
    }

    $raw = file_get_contents($dataFile);
    if ($raw === false) {
        return $defaultData;
    }

    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return $defaultData;
    }

    return normalizeData($decoded);
}

function writeData(string $dataFile, array $data): void
{
    $tempFile = tempnam(dirname($dataFile), 'snqa-');
    if ($tempFile === false) {
        sendJson(['ok' => false, 'error' => 'Không tạo được file tạm.'], 500);
    }

    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . PHP_EOL;
    if (file_put_contents($tempFile, $json, LOCK_EX) === false || !rename($tempFile, $dataFile)) {
        @unlink($tempFile);
        sendJson(['ok' => false, 'error' => 'Không ghi được data.json.'], 500);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    sendJson(new stdClass(), 204);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    sendJson(readData($dataFile, $defaultData));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $payload = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendJson(['ok' => false, 'error' => 'JSON không hợp lệ.'], 400);
    }

    $cleaned = normalizeData($payload);
    writeData($dataFile, $cleaned);
    sendJson(['ok' => true, 'data' => $cleaned]);
}

sendJson(['ok' => false, 'error' => 'Method không được hỗ trợ.'], 405);
