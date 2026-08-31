# 📊 Perbandingan Baseline vs SAGGD - Implementasi Kobo Data Sync

## Overview

| Aspek | Baseline | SAGGD (Sekarang) |
|-------|----------|-----------------|
| **Pagination** | `nextUrl` dari API | offset/limit manual |
| **Data Processing** | Data baru + Repair lama incomplete | Data baru saja |
| **Field Matching** | Kompleks (canonical questions) | Sederhana (labelMap) |
| **Batch Limit** | MAX_DATA_PER_RUN = 10 | ❌ Tidak ada batasan (FIXED) |
| **Token Storage** | PropertiesService | Hardcoded di config |
| **File Retry** | ❌ Tidak ada | ✅ 3x retry |
| **File Download** | Single attempt | Exponential backoff |

---

## 1️⃣ PAGINATION

### ❌ Baseline (Lebih Sederhana)
```javascript
// Menggunakan property 'next' dari API response
let nextUrl = apiUrl;
while (nextUrl) {
  const response = UrlFetchApp.fetch(nextUrl, options);
  const page = JSON.parse(response.getContentText());
  submissions = submissions.concat(page.results || []);
  nextUrl = page.next || '';  // ← API sudah provide next URL
}
```

**Kelebihan:**
- Lebih sederhana, API handle pagination
- Tidak perlu hitung offset manual

**Kekurangan:**
- API harus support `next` property

### ✅ SAGGD (Lebih Eksplisit & Kontrol)
```javascript
// Menggunakan offset/limit dengan sort
let offset = 0;
while (hasMore) {
  const apiUrl = `...data.json?limit=100&offset=${offset}&sort=-_id`;
  const response = UrlFetchApp.fetch(apiUrl, options);
  const submissions = data.results || [];
  offset += limit;
}
```

**Kelebihan:**
- Full kontrol urutan (sort=-_id terbaru dulu)
- Lebih eksplisit untuk debugging
- Bisa sort/filter per request

**Kekurangan:**
- Lebih kompleks, perlu hitung offset

---

## 2️⃣ FIELD MAPPING (Critical Difference!)

### ❌ Baseline - Complex Field Resolution
```javascript
// 1. Normalisasi label
const normalizeLabel = value => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

// 2. Build multiple candidates
const registerSubmissionKey = key => {
  [key, String(key).split('/').pop()].forEach(name => {
    const normalizedKey = normalizeLabel(name);
    if (!normalizedSubmissionKeys[normalizedKey]) normalizedSubmissionKeys[normalizedKey] = [];
    normalizedSubmissionKeys[normalizedKey].push(key);
  });
};

// 3. Resolve dengan canonical questions (untuk multi-level forms)
const canonicalHeader = normalizeLabel(String(sheetHeader).split('/').pop()).replace(/^\d+/, '');
const canonicalMatches = Object.keys(sub).filter(key => {
  const canonicalKey = normalizeLabel(String(key).split('/').pop()).replace(/^\d+/, '');
  return canonicalKey.length >= 16 && (canonicalKey.indexOf(canonicalHeader) === 0 || canonicalHeader.indexOf(canonicalKey) === 0);
});

// 4. Multiple fallback attempts
const matches = candidates.concat(canonicalMatches)
  .filter((key, index, values) => values.indexOf(key) === index && Object.prototype.hasOwnProperty.call(sub, key));
```

**Untuk:** Form dengan struktur multi-level (nested groups)
**Contoh:** 
```
- Kabupaten
  - Kecamatan
    - Desa
      - Petani
```

### ✅ SAGGD - Simple Field Resolution
```javascript
// Langsung lookup dengan label atau name
const sheetHeader = sheetHeaders[h];
const originalColName = reverseLabelMap[sheetHeader] || sheetHeader;
let val = sub[originalColName];
```

**Untuk:** Form dengan struktur flat/sederhana
**Contoh:**
```
- Nama Petani
- Kode Petani
- Nama Kegiatan
- Foto
```

---

## 3️⃣ DATA PROCESSING STRATEGY

### ❌ Baseline - Smart Processing
```javascript
// 1. Cek apakah submission sudah ada di sheet
const submissionIdentity = submission => {
  const farmerKey = resolveSubmissionKey(submission, farmerNameIndex);
  return `${submission._id}::${submission[farmerKey]}`;
};

// 2. Jika sudah ada, cek apakah perlu diperbaiki
const needsRepair = submission => {
  const saved = existingRows[submissionIdentity(submission)];
  if (!saved) return false;
  
  // Ada field yang missing?
  return sheetHeaders.some((header, index) => {
    const value = submission[key];
    const missing = value !== '' && (saved.values[index] === '' || saved.values[index] === null);
    return missing;
  });
};

// 3. Proses keduanya: data baru + data lama yang incomplete
const dataBaru = submissions.filter(sub => !existingIds.includes(submissionIdentity(sub)));
const dataPerluDiperbaiki = submissions.filter(needsRepair);
const dataYangAkanDiproses = dataBaru.concat(dataPerluDiperbaiki).slice(0, MAX_DATA_PER_RUN);
```

**Fitur:**
- ✅ Auto-repair incomplete submissions
- ✅ Track field yang sering kosong
- ❌ Masih punya limit 10 per run

### ✅ SAGGD - Simple Processing
```javascript
// 1. Hanya cek ID
let dataBaru = submissions.filter(sub => !existingIds.includes(String(sub._id)));

// 2. Proses SEMUA data baru
let allNewRows = [];
for (let i = 0; i < dataBaru.length; i++) {
  // process...
}
```

**Fitur:**
- ✅ Lebih sederhana
- ✅ Tidak ada batasan (SEMUANYA diproses)
- ❌ Tidak repair incomplete submissions

---

## 4️⃣ FILE DOWNLOAD STRATEGY

### ❌ Baseline - Basic (No Retry)
```javascript
let fileResponse = UrlFetchApp.fetch(downloadUrl, fetchOptions);
let responseCode = fileResponse.getResponseCode();

if (responseCode === 301 || responseCode === 302 || responseCode === 307) {
  let redirectUrl = fileResponse.getHeaders()['Location'];
  fileResponse = UrlFetchApp.fetch(redirectUrl, { "muteHttpExceptions": true });
  responseCode = fileResponse.getResponseCode();
}

if (responseCode === 200) {
  // Save file
} else {
  // Just log error, file lost!
}
```

**Masalah:**
- Jika file gagal download 1x = hilang selamanya
- Tidak ada exponential backoff

### ✅ SAGGD - Robust (Retry with Backoff)
```javascript
function downloadFileWithRetry_(downloadUrl, koboToken, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fileResponse = UrlFetchApp.fetch(downloadUrl, fetchOptions);
      if (responseCode === 200) {
        return fileResponse; // SUCCESS
      }
      
      Logger.log(`Attempt ${attempt}: HTTP ${responseCode}, retry...`);
      Utilities.sleep(Math.pow(2, attempt) * 1000); // 2s, 4s, 8s
    } catch (err) {
      if (attempt < maxRetries) {
        Utilities.sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  return null; // Failed after 3 retries
}
```

**Fitur:**
- ✅ 3x retry otomatis
- ✅ Exponential backoff (tidak spam server)
- ✅ Handle transient errors

---

## 5️⃣ TOKEN MANAGEMENT

### ❌ Baseline - Secure (PropertiesService)
```javascript
const KOBO_TOKEN = PropertiesService.getScriptProperties().getProperty("KOBO_TOKEN");
if (!KOBO_TOKEN) throw new Error("KOBO_TOKEN belum diatur di Script Properties.");

// Di Script Properties: KOBO_TOKEN = [token]
function setKoboToken(token) {
  PropertiesService.getScriptProperties().setProperty("KOBO_TOKEN", String(token).trim());
}
```

**Kelebihan:** Token tidak terlihat di source code

### ❌ SAGGD - Hardcoded (Tidak Aman!)
```javascript
var SAGGD_KOBO_CONFIG = {
  token: '2314bc793b14bb76cc7ee2ae1eab1a750d557a97',  // ← Visible di code!
  assetUid: 'a7vNjseoAicBntatMQVdfC',
  // ...
};
```

**Masalah:** Token terlihat di repository (security risk!)

---

## 6️⃣ LOGGING & MONITORING

### ❌ Baseline
```
Kobo: 250 submission, 5 data baru, 2 data lama belum lengkap, 7 diproses pada batch ini.
Sel kosong diisi ulang: Nama Kegiatan (3 sel), Foto Absensi (1 sel).
Nilai lama dinormalisasi: Status (2 sel).
2 baris lama berhasil diperbarui.
7 baris baru berhasil ditambahkan.
```

### ✅ SAGGD (Better)
```
🔄 Mulai pengambilan data dari Kobo (pagination dengan limit 100)...
✓ Halaman 1: 100 submission, Total: 100
✓ Halaman 2: 100 submission, Total: 200
✓ Halaman 3: 50 submission, Total: 250
✅ Total data diambil: 250

📊 Status: 245 existing rows, 250 total in Kobo, 245 existing IDs
🆕 Data baru ditemukan: 5

  📁 abc123: Download 2 file...
    ✓ File: photo1.jpg
    ✓ File: photo2.jpg
  ✓ 1/5 baris diproses...
  ✓ 2/5 baris diproses...
  
✅ SELESAI! 5 baris berhasil ditambahkan
```

---

## Recommendation: Hybrid Approach untuk SAGGD

Untuk mendapatkan yang terbaik dari kedua, pertimbangkan:

```javascript
// 1. PAGINATION - Pakai Baseline's nextUrl (lebih sederhana)
// 2. FIELD MAPPING - Pakai Baseline's canonical resolution (untuk future complex forms)
// 3. DATA PROCESSING - Pakai SAGGD's unlimited (no MAX_DATA_PER_RUN)
// 4. REPAIR LOGIC - Tambahkan dari Baseline (auto-repair incomplete)
// 5. FILE DOWNLOAD - Pakai SAGGD's retry logic (sudah optimal)
// 6. TOKEN - Upgrade ke PropertiesService untuk security
```

---

## Implementasi Sekarang (SAGGD)

```
✅ Pagination lengkap (offset/limit)
✅ No data limit (unlimited)
✅ File retry 3x dengan backoff
✅ Simple field mapping
❌ Tidak ada repair logic
❌ Token hardcoded (security)
```

---

## Future Enhancement

### Priority 1 (High)
- [ ] Upgrade token ke PropertiesService
- [ ] Add repair logic (fix incomplete submissions)
- [ ] Test dengan complex form structure

### Priority 2 (Medium)
- [ ] Switch pagination ke `nextUrl` (jika API support)
- [ ] Improve field resolution dengan canonical questions

### Priority 3 (Low)
- [ ] Add checkpoint/resume di tengah jalan
- [ ] Auto-move files seperti Baseline

---

**Last Updated**: 2026-08-31
**Status**: SAGGD Production Ready (v2.0)
