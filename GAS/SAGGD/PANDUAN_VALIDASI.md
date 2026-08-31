# Cara Menggunakan Validation Utilities untuk SAGGD

## File yang sudah dibuat:
- `kobo.gs` — Main sync script (sudah diperbaiki)
- `VALIDATION_UTILITIES.gs` — Fungsi validasi data
- `CLEANUP_HEADERS.gs` — Fungsi bersih duplikat header

## Langkah-langkah Validasi SAGGD

### 1. Lihat duplikat header (AMAN, tidak mengubah data)
```javascript
lihatDuplikatHeader()
```
**Output:** List semua duplikat header jika ada

### 2. Validasi & bersihkan SAGGD (AMAN jika tidak ada masalah)
```javascript
validasiDanBersihkanSAGGD()
```
**Output:**
- Deteksi duplikat header
- Otomatis hapus duplikat
- Cek struktur data
- Report data integrity

### 3. Hapus baris dengan _id kosong
```javascript
hapusBarisDenganIdKosong()
```
**Output:** Hapus baris yang _id-nya kosong

### 4. Laporan data summary
```javascript
laporanDataSAGGD()
```
**Output:** Summary data per kegiatan, fill rate, dll

---

## Workflow Rekomendasi:

**SEBELUM sync pertama kali:**
1. Jalankan `lihatDuplikatHeader()` → lihat ada duplikat apa
2. Jalankan `validasiDanBersihkanSAGGD()` → bersihkan
3. Jalankan `laporanDataSAGGD()` → confirm struktur OK

**SEBELUM tarikDataKoboOtomatis():**
4. Fungsi `tarikDataKoboOtomatis()` sudah include validasi otomatis (sudah ditambahkan ke kobo.gs)

**SETELAH sync:**
5. Jalankan `laporanDataSAGGD()` → lihat data baru

---

## Fitur yang sudah ditambahkan:

✅ **Duplikat header detection & cleanup**
- Cek header yang sama (case-insensitive)
- Otomatis hapus yang redundan

✅ **Data integrity check**
- Verifikasi kolom _id ada
- Count baris dengan _id kosong
- Calculate data fill rate (%)

✅ **Auto-validation di tarikDataKoboOtomatis**
- Validasi otomatis saat sync
- Clean duplikat sebelum proses
- Report data quality

---

## Testing dengan 10 data:

Karena `tarikDataKoboOtomatis()` sudah set `MAX_DATA_PER_RUN = 10`:

```javascript
tarikDataKoboOtomatis()  // Ambil & validasi 10 data pertama
```

Log output akan menunjukkan:
- Validasi struktur
- Duplikat yang dihapus (jika ada)
- Data yang diproses
- File yang didownload
- Error (jika ada)

---

## Cara pakai di Google Apps Script:

1. Buka sheet SAGGD → Extensions > Apps Script
2. Copy file VALIDATION_UTILITIES.gs ke project
3. Update kobo.gs dengan perubahan validasi
4. Jalankan fungsi sesuai workflow di atas

---

Catatan: Semua fungsi sudah aman dan tidak akan menghapus data penting jika tidak ada duplikat/error.
