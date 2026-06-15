<?php
// Salin file ini menjadi config.php dan isi dengan data koneksi database kamu.
// JANGAN commit config.php ke GitHub — sudah dimasukkan ke .gitignore.

define('DB_HOST', 'localhost');
define('DB_NAME', 'chili_game');   // nama database di MySQL
define('DB_USER', 'root');         // username MySQL
define('DB_PASS', '');             // password MySQL
define('DB_CHARSET', 'utf8mb4');

// Daftar origin yang diizinkan CORS (tambahkan URL GitHub Pages kamu)
define('ALLOWED_ORIGINS', [
    'https://ramptechid.github.io',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
]);

// Kredensial admin panel
define('ADMIN_USER', 'admin');
define('ADMIN_PASS_HASH', password_hash('ganti_password_ini', PASSWORD_BCRYPT));
