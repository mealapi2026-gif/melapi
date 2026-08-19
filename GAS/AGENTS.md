# Google Apps Script source

Folder `GAS/` berisi source code yang dijalankan di **Google Apps Script (GAS)**. Folder ini bukan bagian dari runtime, build, atau routing aplikasi Next.js.

## Struktur

- `Basline/`: source Web App GAS untuk modul Baseline.
- `SAGGD/`: source Web App GAS untuk modul SAGGD.
- `code.gs`: kode server-side GAS yang akan disalin atau dideploy ke Apps Script.
- `index.html`: template HTML client-side yang akan disalin atau dideploy ke Apps Script.

## Aturan perubahan

- Edit kode di sini hanya ketika perubahan memang diperlukan pada Web App GAS.
- Pertahankan nama folder yang ada, termasuk `Basline`, karena mengikuti proyek GAS yang sudah digunakan.
- Gunakan API dan sintaks yang kompatibel dengan Google Apps Script V8. Jangan menambahkan import Node.js, Next.js, Firebase client SDK, atau dependensi npm.
- Pertahankan fungsi entry point dan kontrak API yang telah digunakan frontend, seperti `doGet`, `doPost`, parameter request, serta bentuk respons JSON, kecuali perubahan tersebut juga diterapkan pada aplikasi Next.js.
- Setelah mengubah file dalam folder ini, beri tahu pengguna file mana yang perlu disalin atau dideploy ulang ke proyek Google Apps Script terkait.
- Jangan memindahkan kode GAS ke `src/` dan jangan menganggap file di folder ini ikut ter-bundle oleh Next.js.
