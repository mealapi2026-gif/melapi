# Integrasi Validasi Data untuk Dashboard SAGGD

## Masalah yang Diperbaiki
- ❌ Data dengan _id kosong ditampilkan di dashboard
- ❌ Duplikat data tidak terdeteksi
- ❌ Baris dengan field utama kosong ditampilkan

## Solusi
File baru `code-validation.gs` berisi fungsi validasi yang memastikan hanya data **VALID** yang ditampilkan di dashboard.

---

## Langkah Integrasi (3 Opsi)

### OPSI 1: Ganti getDashboardData() dengan getDashboardDataWithValidation() (REKOMENDASI)

**File:** `code.gs`

Bagian yang diubah di fungsi `doGet()`:

```javascript
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (params.action === "photo") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: getPhotoData(params.fileId)
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // UBAH INI:
    // const resultData = getDashboardData();  ← LAMA
    
    // MENJADI INI:
    const resultData = getDashboardDataWithValidation();  // ← BARU (termasuk validasi)
    
    const jsonResponse = JSON.stringify({
      status: "success",
      data: resultData
    });
    
    return ContentService.createTextOutput(jsonResponse)
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    const errorResponse = JSON.stringify({
      status: "error",
      message: error.message || String(error)
    });
    return ContentService.createTextOutput(errorResponse)
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

**Keuntungan:**
- ✅ Validasi otomatis setiap kali dashboard di-refresh
- ✅ Tidak perlu perubahan di file `code.gs` yang panjang
- ✅ Semua fungsi existing tetap bekerja

---

### OPSI 2: Tambahkan Validasi di Awal getDashboardData()

Jika ingin keep `getDashboardData()` exist, tambahkan di awal:

```javascript
function getDashboardData() {
  // NEW: Validasi data dulu
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SAGGD");
  let data = sheet.getDataRange().getValues();
  
  // Validasi dan filter rows
  const rows = data.slice(1).filter(r => r.join("").trim() !== "");
  const validation = validasiDataDashboard_(rows);
  
  // Reconstructed data dengan rows yang valid
  data = [data[0], ...validation.validRows];
  
  // ... rest of getDashboardData() logic menggunakan data yang sudah divalidasi
}
```

---

### OPSI 3: Validasi + Cleanup Sheet (One-time cleaning)

Jalankan fungsi ini di Apps Script Editor sekali untuk:
1. Hapus baris dengan _id kosong
2. Hapus duplikat _id dari sheet
3. Cleanup header duplikat

```javascript
function cleanupSAGGDData() {
  Logger.log("🧹 Cleanup SAGGD data...");
  
  // Bersihkan duplikat header (dari VALIDATION_UTILITIES.gs)
  if (typeof validasiDanBersihkanSAGGD === 'function') {
    validasiDanBersihkanSAGGD();
  }
  
  // Bersihkan baris kosong (dari VALIDATION_UTILITIES.gs)
  if (typeof hapusBarisDenganIdKosong === 'function') {
    hapusBarisDenganIdKosong();
  }
  
  Logger.log("✅ Cleanup selesai");
}
```

---

## Testing

### 1. Test validasi tanpa perubahan data
```javascript
testValidasiDashboard()
```

**Output yang diharapkan:**
```
=== VALIDASI DATA DASHBOARD ===
Total baris: 150
Baris valid: 148
Baris invalid: 2
Duplikat: 0

📋 Detail baris tidak valid:
  Baris 45: ID kosong
  Baris 102: Duplikat ID: a7vNjseoAicBntat...
```

### 2. Coba getDashboardDataWithValidation()
```javascript
getDashboardDataWithValidation()
```

**Output yang diharapkan:**
- Response JSON dengan `totalKegiatan: 148` (bukan 150)
- Field `_validation` menunjukkan berapa baris yang dihapus
- Dashboard hanya menampilkan data yang valid

### 3. Refresh dashboard dan verifikasi
Di dashboard Next.js:
- Total kegiatan = jumlah yang valid saja
- Tidak ada data dengan _id kosong
- Tidak ada duplikat ditampilkan

---

## File yang Digunakan

```
GAS/SAGGD/
├── code.gs                           ← REST API endpoint (ubah doGet())
├── code-validation.gs                ← NEW: Fungsi validasi
├── VALIDATION_UTILITIES.gs           ← Cleanup & validasi sheet
└── kobo.gs                           ← Sync Kobo (sudah include validasi)
```

---

## Rekomendasi Urutan Implementasi

### **Fase 1: Immediate (Hari ini)**
1. ✅ Copy `code-validation.gs` ke Google Apps Script project
2. ✅ Ubah `doGet()` di `code.gs` untuk pakai `getDashboardDataWithValidation()`
3. ✅ Test dengan `testValidasiDashboard()`
4. ✅ Verify dashboard tidak menampilkan data invalid

### **Fase 2: Optional (Besok)**
5. Jalankan `cleanupSAGGDData()` untuk one-time cleanup
6. Run `laporanDataSAGGD()` dari VALIDATION_UTILITIES.gs untuk verifikasi

### **Fase 3: Automation (Minggu depan)**
7. Add validation call ke `tarikDataKoboOtomatis()` (sudah dilakukan di kobo.gs)

---

## FAQ

**Q: Apakah ini akan menghapus data dari sheet?**
A: Tidak! Opsi 1 & 2 hanya filter tampilan di dashboard. Opsi 3 (one-time cleanup) baru menghapus dari sheet.

**Q: Data yang "invalid" bisa diperbaiki dan di-sync kembali?**
A: Ya! Jika ada _id kosong, bisa di-fill manual atau di-re-sync dari Kobo dengan tarikDataKoboOtomatis().

**Q: Perlu restart Google Apps Script?**
A: Tidak perlu. Cukup save file dan refresh dashboard.

**Q: Bagaimana jika ingin lihat data yang dihapus?**
A: Buka Logs di Apps Script Editor (Ctrl+Enter) setelah jalankan `testValidasiDashboard()`.

---

## Next Steps
1. Implementasikan OPSI 1 (ubah doGet())
2. Test dengan `testValidasiDashboard()`
3. Refresh dashboard dan verifikasi
4. Siap untuk push ke GitHub!
