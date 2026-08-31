# 🔧 Perbaikan Google Apps Script SAGGD - Kobo Data Sync

## Masalah yang Diperbaiki

### 1. ❌ Batasan Data 10 Rows
- **Masalah**: Hanya memproses 10 data baru per run, data selebihnya tertinggal
- **Perbaikan**: Menghilangkan batasan, SEMUA data baru diproses tanpa batasan

### 2. ❌ Pagination API Tidak Lengkap
- **Masalah**: API Kobo hanya mengambil halaman pertama (~30-100 data), data selanjutnya hilang
- **Perbaikan**: Implementasi pagination lengkap dengan loop hingga semua data terkumpul
  ```javascript
  // Sekarang menggunakan:
  // /api/v2/assets/{uid}/data.json?limit=100&offset=0 ← halaman 1
  // /api/v2/assets/{uid}/data.json?limit=100&offset=100 ← halaman 2
  // ... dan seterusnya sampai semua data habis
  ```

### 3. ❌ Retry Logic Tidak Ada
- **Masalah**: Jika file download gagal, tidak ada retry, file hilang selamanya
- **Perbaikan**: Menambahkan automatic retry dengan exponential backoff (3x coba)
  - Attempt 1: segera retry
  - Attempt 2: tunggu 2 detik, retry
  - Attempt 3: tunggu 4 detik, retry
  - Attempt 4: tunggu 8 detik, retry

### 4. ❌ Error Handling Minim
- **Masalah**: Jika 1 baris error, sisa data mungkin terlewat
- **Perbaikan**: Try-catch di setiap baris dengan detailed logging

### 5. ❌ Tidak Ada Tracking Progress
- **Masalah**: Tidak tahu berapa banyak data yang diproses, keberhasilan/kegagalan
- **Perbaikan**: Logging detail dengan counter success/fail per baris

---

## Cara Menggunakan

### ✅ Jalankan Sync Normal
```
Apps Script > jalankan > tarikDataKoboOtomatis()
```

### 🔍 Check Status (Debugging)
```
1. Tampilkan statistik data:
   cekKoneksiKobo()            ← Cek koneksi ke Kobo API
   tampilkanStatistikData()    ← Lihat jumlah data per bulan
   bandingkanDataKoboVsSheet() ← Bandingkan data Kobo vs Sheet (cari yang tertinggal)

2. Test pagination:
   testPaginasiKobo()          ← Lihat berapa total data di Kobo
```

### 🚨 Reset Data (Jika Diperlukan)
```
resetDataSaggd()  ← HATI-HATI! Hapus semua data (header tetap)
```

---

## Logs & Output

Ketika menjalankan `tarikDataKoboOtomatis()`, Anda akan melihat logs seperti ini:

```
🔄 Mulai pengambilan data dari Kobo (pagination dengan limit 100)...
✓ Halaman 1: 100 submission, Total: 100
✓ Halaman 2: 100 submission, Total: 200
✓ Halaman 3: 50 submission, Total: 250
✅ Total data diambil: 250

📊 Status: 245 existing rows, 250 total in Kobo, 245 existing IDs
🆕 Data baru ditemukan: 5

  ✓ 1 baris diproses...
  ✓ 2 baris diproses...
  ✓ 3 baris diproses...
  ✓ 4 baris diproses...
  ✓ 5 baris diproses...

✅ SELESAI! 5 baris berhasil ditambahkan
```

---

## Data Structure

### Perubahan Struktur

#### Sebelum (Terbatas)
- Hanya ambil 10 data baru per run
- Hanya halaman pertama API
- Retry file download hanya 1x

#### Sesudah (Lengkap)
- Ambil SEMUA data baru, tidak ada batasan
- Pagination loop hingga semua data habis
- Retry file download 3x dengan exponential backoff

---

## Function Reference

### `tarikDataKoboOtomatis()`
Main function - ambil data dari Kobo, download file, masukkan ke Sheet
- Menjalankan pagination lengkap
- Proses SEMUA data baru
- Download file dengan retry

### `ambilSemuaDataKoboDenganPaginasi_(baseUrl, assetUid, token)`
Helper function - ambil data dengan pagination lengkap
- Parameter: base URL, asset UID, token
- Return: array semua submissions

### `downloadFileWithRetry_(downloadUrl, koboToken, maxRetries = 3)`
Helper function - download file dengan retry otomatis
- Retry hingga 3x
- Exponential backoff
- Handle redirect (301, 302, 307)

### `cekKoneksiKobo()`
Debug function - cek status koneksi ke Kobo API

### `tampilkanStatistikData()`
Debug function - tampilkan statistik data yang sudah ada di Sheet

### `bandingkanDataKoboVsSheet()`
Debug function - cari data yang tertinggal (ada di Kobo tapi tidak di Sheet)

### `testPaginasiKobo()`
Debug function - test pagination, lihat total data di Kobo

### `resetDataSaggd()`
⚠️ Danger function - reset semua data (header tetap ada)

---

## Tips Penting

1. **Batching**: Jika ada ribuan data baru, Google Apps Script mungkin timeout (6 menit). Solusi:
   - Jalankan multiple times (akan otomatis skip duplikat)
   - Atau gunakan Cloud Functions dengan timeout lebih lama

2. **Rate Limiting**: Script sudah punya delay:
   - 500ms antar file download
   - 300ms antar pagination request

3. **File Matching**: File dicocokkan berdasarkan nama (case-insensitive, ignore special chars)
   - Jika tidak cocok, file tetap diupload tapi URL tidak terupdate di cell

4. **Duplikat Check**: Menggunakan `_id` dari Kobo, tidak akan ada duplikat

5. **Error Recovery**: Jika 1 baris error, proses berlanjut ke baris berikutnya

---

## Troubleshooting

### 🔴 "Gagal mengambil struktur form Kobo"
- Cek token di `SAGGD_KOBO_CONFIG`
- Cek internet connection
- Run `cekKoneksiKobo()` untuk debug

### 🔴 "File gagal download: ..."
- Server Kobo mungkin down sementara
- Coba lagi (ada automatic retry)
- Check logs untuk detail error

### 🔴 "Tidak ada data baru untuk diproses"
- Semua data sudah ada di Sheet
- Run `bandingkanDataKoboVsSheet()` untuk konfirmasi

### 🔴 Timeout (command berhenti di tengah)
- Google Apps Script memiliki timeout 6 menit
- Run lagi, akan melanjutkan dari data baru yang belum diproses
- Duplikat check akan skip data yang sudah ada

---

## Changelog

**v2.0 (Sekarang)**
- ✅ Hapus batasan 10 data
- ✅ Implementasi pagination lengkap
- ✅ Retry file download 3x
- ✅ Better error handling & logging
- ✅ Add debug/utility functions
- ✅ Add data comparison tools

**v1.0 (Sebelumnya)**
- ❌ Batasan 10 data per run
- ❌ Pagination tidak lengkap
- ❌ No retry logic
- ❌ Minimal error handling

---

**Last Updated**: 2026-08-31
**Status**: Ready for Production
