<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Catatan AI: Appoli

- Folder `Appoli` saat ini hanya menjadi sumber referensi dan penyalinan tampilan UI ke project Next.js.
- Implementasi Next.js yang terkait berada pada Dashboard Appoli dan form-form Appoli di `src/app/dashboard/appoli/`.
- Jangan menganggap UI Appoli sudah terhubung ke backend atau database yang sama dengan Baseline dan SAGGD.
- Folder `GAS/Appoli/` belum memiliki implementasi backend yang lengkap; file `PendataanPetaniLahan.gs` saat ini kosong.
- Jika memungkinkan, kembangkan Appoli dengan pola backend yang sama seperti Baseline dan SAGGD: Google Apps Script sebagai REST API, endpoint terstruktur, validasi data, serta integrasi aman ke Dashboard Next.js.
- Sebelum membuat backend Appoli, petakan dahulu struktur sheet/form, field, operasi CRUD, upload foto, dan kebutuhan autentikasi agar kontrak REST API jelas.
