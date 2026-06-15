<?php
session_start();
require_once __DIR__ . '/../api/config.php';

// ── Auth ────────────────────────────────────────────────────────────────────

$error = '';

if (isset($_POST['action']) && $_POST['action'] === 'login') {
    $u = trim((string)($_POST['username'] ?? ''));
    $p = (string)($_POST['password'] ?? '');
    if ($u === ADMIN_USER && password_verify($p, ADMIN_PASS_HASH)) {
        $_SESSION['admin'] = true;
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit;
    }
    $error = 'Username atau password salah.';
}

if (isset($_POST['action']) && $_POST['action'] === 'logout') {
    session_destroy();
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
}

$authed = !empty($_SESSION['admin']);

// ── Database actions (only when authed) ────────────────────────────────────

$db_error = '';
$pdo = null;

if ($authed) {
    try {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET);
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $e) {
        $db_error = 'Gagal koneksi database: ' . htmlspecialchars($e->getMessage());
    }

    if ($pdo && isset($_POST['action']) && $_POST['action'] === 'delete') {
        $id = (int)($_POST['id'] ?? 0);
        if ($id > 0) {
            $pdo->prepare('DELETE FROM scores WHERE id = :id')->execute([':id' => $id]);
        }
        header('Location: ' . $_SERVER['PHP_SELF'] . '?' . http_build_query(['page' => $_GET['page'] ?? 1, 'search' => $_GET['search'] ?? '']));
        exit;
    }

    if ($pdo && isset($_GET['export']) && $_GET['export'] === 'csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="leaderboard_' . date('Ymd_His') . '.csv"');
        echo "\xEF\xBB\xBF"; // UTF-8 BOM for Excel
        $out = fopen('php://output', 'w');
        fputcsv($out, ['ID', 'Nama', 'Instagram', 'Skor', 'Tanggal']);
        $rows = $pdo->query('SELECT id, player_name, instagram, score, created_at FROM scores ORDER BY score DESC, created_at ASC')->fetchAll();
        foreach ($rows as $r) {
            fputcsv($out, [$r['id'], $r['player_name'], '@' . $r['instagram'], $r['score'], $r['created_at']]);
        }
        fclose($out);
        exit;
    }
}

// ── Pagination & search ────────────────────────────────────────────────────

$page    = max(1, (int)($_GET['page']   ?? 1));
$search  = trim((string)($_GET['search'] ?? ''));
$perPage = 25;

$rows  = [];
$total = 0;
$pages = 1;

if ($authed && $pdo) {
    $where  = $search ? 'WHERE player_name LIKE :q OR instagram LIKE :q' : '';
    $params = $search ? [':q' => '%' . $search . '%'] : [];

    $total = (int)$pdo->prepare("SELECT COUNT(*) FROM scores $where")->execute($params) ? 0 : 0;
    $stmt  = $pdo->prepare("SELECT COUNT(*) AS cnt FROM scores $where");
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();
    $pages = max(1, (int)ceil($total / $perPage));
    $page  = min($page, $pages);

    $stmt = $pdo->prepare("SELECT id, player_name, instagram, score, created_at FROM scores $where ORDER BY score DESC, created_at ASC LIMIT :lim OFFSET :off");
    $stmt->bindValue(':lim',  $perPage, PDO::PARAM_INT);
    $stmt->bindValue(':off',  ($page - 1) * $perPage, PDO::PARAM_INT);
    foreach ($params as $k => $v) $stmt->bindValue($k, $v);
    $stmt->execute();
    $rows = $stmt->fetchAll();
}

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
function qs(array $extra = []): string {
    global $search, $page;
    return http_build_query(array_filter(array_merge(['page' => $page, 'search' => $search], $extra)));
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Admin — Cari Cabe Ijo Leaderboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a120b;
    --card: #111e12;
    --border: rgba(103,255,71,.18);
    --green: #70ff70;
    --green2: #caff72;
    --text: #e8ffe8;
    --muted: rgba(232,255,232,.55);
    --red: #ff6b6b;
    --danger: #c0392b;
    --radius: 12px;
  }
  body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
  a { color: var(--green2); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* ── LOGIN ── */
  .login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
  .login-card {
    width: 100%; max-width: 360px; padding: 36px 28px 28px;
    background: var(--card); border: 1px solid var(--border); border-radius: 20px;
    box-shadow: 0 24px 64px rgba(0,0,0,.5);
  }
  .login-card h1 { font-size: 22px; margin-bottom: 6px; color: var(--green); }
  .login-card p  { font-size: 13px; color: var(--muted); margin-bottom: 24px; }
  .form-group { margin-bottom: 14px; }
  .form-group label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 6px; }
  .form-control {
    width: 100%; padding: 10px 14px; border-radius: 8px;
    background: rgba(255,255,255,.06); border: 1px solid var(--border);
    color: var(--text); font-size: 14px; outline: none;
  }
  .form-control:focus { border-color: var(--green2); box-shadow: 0 0 0 3px rgba(202,255,114,.12); }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 10px 20px; border-radius: 8px; border: none; font-size: 14px;
    font-weight: 700; cursor: pointer; transition: opacity .15s, transform .1s;
  }
  .btn:active { transform: scale(.96); }
  .btn-primary { background: linear-gradient(135deg, #d6ff7a, #3dd95b); color: #09210d; width: 100%; margin-top: 4px; }
  .btn-sm { padding: 5px 12px; font-size: 12px; }
  .btn-danger { background: var(--danger); color: #fff; }
  .btn-outline { background: transparent; color: var(--green2); border: 1px solid var(--border); }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  .error-msg { background: rgba(255,107,107,.12); border: 1px solid rgba(255,107,107,.3); border-radius: 8px; padding: 10px 14px; color: var(--red); font-size: 13px; margin-bottom: 16px; }

  /* ── ADMIN LAYOUT ── */
  .admin-wrap { max-width: 1100px; margin: 0 auto; padding: 24px 16px; }
  .admin-header {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 16px 20px; border-radius: var(--radius);
    background: var(--card); border: 1px solid var(--border); margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .admin-header h1 { font-size: 18px; color: var(--green); }
  .admin-header .meta { font-size: 12px; color: var(--muted); }

  .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
  .search-form { display: flex; gap: 8px; flex: 1; min-width: 0; }
  .search-form .form-control { flex: 1; min-width: 0; }

  .stats-row {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap: 12px; margin-bottom: 20px;
  }
  .stat-card {
    padding: 16px 18px; border-radius: var(--radius);
    background: var(--card); border: 1px solid var(--border);
  }
  .stat-card .stat-label { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
  .stat-card .stat-value { font-size: 28px; font-weight: 900; color: var(--green); line-height: 1.1; margin-top: 4px; }

  .table-wrap { border-radius: var(--radius); background: var(--card); border: 1px solid var(--border); overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .8px; border-bottom: 1px solid var(--border); background: rgba(0,0,0,.2); }
  tbody tr { border-bottom: 1px solid rgba(103,255,71,.07); transition: background .12s; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:hover { background: rgba(103,255,71,.04); }
  td { padding: 11px 14px; vertical-align: middle; }
  td.rank { color: var(--green2); font-weight: 900; font-size: 15px; }
  td.score { color: var(--green); font-weight: 900; font-size: 16px; }
  td.ig { color: var(--green2); }
  td.date { color: var(--muted); font-size: 12px; }

  .badge-top { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .badge-1 { background: #ffd700; color: #3a2c00; }
  .badge-2 { background: #c0c0c0; color: #1a1a1a; }
  .badge-3 { background: #cd7f32; color: #1a0800; }

  .pagination { display: flex; gap: 6px; align-items: center; justify-content: center; padding: 16px; flex-wrap: wrap; }
  .page-link {
    padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;
    background: rgba(255,255,255,.06); border: 1px solid var(--border); color: var(--text);
    cursor: pointer; text-decoration: none;
  }
  .page-link.active { background: var(--green); color: #09210d; border-color: var(--green); }
  .page-link.disabled { opacity: .35; pointer-events: none; }

  .empty { padding: 48px 24px; text-align: center; color: var(--muted); font-size: 15px; }

  .db-error { background: rgba(255,107,107,.1); border: 1px solid rgba(255,107,107,.3); border-radius: var(--radius); padding: 16px 20px; color: var(--red); margin-bottom: 20px; }

  @media (max-width: 600px) {
    .hide-sm { display: none; }
    td, th { padding: 9px 10px; }
    .admin-header { flex-direction: column; align-items: flex-start; }
  }
</style>
</head>
<body>

<?php if (!$authed): ?>
<!-- ── LOGIN SCREEN ────────────────────────────────────────────────────── -->
<div class="login-wrap">
  <div class="login-card">
    <h1>🌶 Admin Panel</h1>
    <p>Cari Cabe Ijo — Leaderboard</p>
    <?php if ($error): ?>
      <div class="error-msg"><?= h($error) ?></div>
    <?php endif; ?>
    <form method="POST">
      <input type="hidden" name="action" value="login" />
      <div class="form-group">
        <label for="username">Username</label>
        <input id="username" class="form-control" type="text" name="username" required autocomplete="username" />
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input id="password" class="form-control" type="password" name="password" required autocomplete="current-password" />
      </div>
      <button class="btn btn-primary" type="submit">Masuk</button>
    </form>
  </div>
</div>

<?php else: ?>
<!-- ── ADMIN PANEL ─────────────────────────────────────────────────────── -->
<div class="admin-wrap">

  <div class="admin-header">
    <div>
      <h1>🌶 Leaderboard — Cari Cabe Ijo</h1>
      <div class="meta">Admin Panel &middot; <?= date('d M Y, H:i') ?></div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <a href="?<?= qs(['export' => 'csv']) ?>" class="btn btn-sm btn-outline">⬇ Export CSV</a>
      <form method="POST" style="margin:0;">
        <input type="hidden" name="action" value="logout" />
        <button class="btn btn-sm btn-outline" type="submit">Keluar</button>
      </form>
    </div>
  </div>

  <?php if ($db_error): ?>
    <div class="db-error"><?= h($db_error) ?></div>
  <?php elseif ($pdo): ?>

    <?php
      $stats = $pdo->query('SELECT COUNT(*) AS cnt, MAX(score) AS max_s, ROUND(AVG(score),1) AS avg_s FROM scores')->fetch();
    ?>
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Pemain</div>
        <div class="stat-value"><?= number_format((int)$stats['cnt']) ?></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Skor Tertinggi</div>
        <div class="stat-value"><?= (int)$stats['max_s'] ?></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Rata-rata Skor</div>
        <div class="stat-value"><?= $stats['avg_s'] ?? '—' ?></div>
      </div>
    </div>

    <div class="toolbar">
      <form class="search-form" method="GET">
        <input class="form-control" type="search" name="search" placeholder="Cari nama atau instagram..." value="<?= h($search) ?>" />
        <button class="btn btn-outline btn-sm" type="submit">Cari</button>
        <?php if ($search): ?>
          <a href="?" class="btn btn-sm btn-outline">✕ Reset</a>
        <?php endif; ?>
      </form>
    </div>

    <div class="table-wrap">
      <?php if (empty($rows)): ?>
        <div class="empty">Tidak ada data<?= $search ? ' yang cocok dengan pencarian.' : '.' ?></div>
      <?php else: ?>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Nama</th>
            <th>Instagram</th>
            <th>Skor</th>
            <th class="hide-sm">Tanggal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($rows as $i => $row):
            $rank = ($page - 1) * $perPage + $i + 1;
          ?>
          <tr>
            <td class="rank">
              <?php if ($rank === 1 && !$search): ?>
                <span class="badge-top badge-1">🥇 1</span>
              <?php elseif ($rank === 2 && !$search): ?>
                <span class="badge-top badge-2">🥈 2</span>
              <?php elseif ($rank === 3 && !$search): ?>
                <span class="badge-top badge-3">🥉 3</span>
              <?php else: ?>
                <?= $rank ?>
              <?php endif; ?>
            </td>
            <td><?= h($row['player_name']) ?></td>
            <td class="ig"><?= $row['instagram'] ? '@' . h($row['instagram']) : '<span style="color:var(--muted)">—</span>' ?></td>
            <td class="score"><?= (int)$row['score'] ?></td>
            <td class="date hide-sm"><?= h(date('d M Y H:i', strtotime($row['created_at']))) ?></td>
            <td>
              <form method="POST" onsubmit="return confirm('Hapus entri ini?');" style="display:inline;">
                <input type="hidden" name="action" value="delete" />
                <input type="hidden" name="id" value="<?= (int)$row['id'] ?>" />
                <button class="btn btn-sm btn-danger" type="submit">Hapus</button>
              </form>
            </td>
          </tr>
          <?php endforeach; ?>
        </tbody>
      </table>

      <?php if ($pages > 1): ?>
      <div class="pagination">
        <a class="page-link <?= $page <= 1 ? 'disabled' : '' ?>" href="?<?= qs(['page' => $page - 1]) ?>">‹ Prev</a>
        <?php for ($p = max(1, $page - 2); $p <= min($pages, $page + 2); $p++): ?>
          <a class="page-link <?= $p === $page ? 'active' : '' ?>" href="?<?= qs(['page' => $p]) ?>"><?= $p ?></a>
        <?php endfor; ?>
        <a class="page-link <?= $page >= $pages ? 'disabled' : '' ?>" href="?<?= qs(['page' => $page + 1]) ?>">Next ›</a>
        <span style="font-size:12px;color:var(--muted);margin-left:4px;"><?= $total ?> entri, halaman <?= $page ?>/<?= $pages ?></span>
      </div>
      <?php endif; ?>

      <?php endif; ?>
    </div>

  <?php endif; ?>
</div>
<?php endif; ?>

</body>
</html>
