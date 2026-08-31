// SAGGD Data Validation & Cleanup Utilities
// Pastikan data yang diambil dari spreadsheet valid sebelum sync

// Deteksi dan bersihkan duplikat header
function validasiDanBersihkanSAGGD() {
  Logger.log('\n========== VALIDASI DATA SAGGD ==========');
  
  const sheet = getSaggdKoboSheet_();
  if (sheet.getLastRow() === 0) {
    Logger.log('⚠️ Sheet kosong');
    return false;
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const lastRow = sheet.getLastRow();
  
  Logger.log(`📊 Total kolom: ${headers.length}`);
  Logger.log(`📊 Total baris data: ${lastRow - 1}`);
  
  // ===== CEK 1: Duplikat Header =====
  const normalize = value => String(value || '').trim().toLowerCase();
  const seen = {};
  const duplikatList = [];
  const indexTerhapus = [];
  
  headers.forEach((header, idx) => {
    const normalized = normalize(header);
    if (!normalized) return;
    
    if (seen[normalized]) {
      duplikatList.push({
        header: header,
        kolom: idx + 1,
        duplikatDari: seen[normalized] + 1
      });
      indexTerhapus.push(idx + 1);
    } else {
      seen[normalized] = idx;
    }
  });
  
  if (duplikatList.length > 0) {\n    Logger.log(`\\n❌ Ditemukan ${duplikatList.length} duplikat header:`);\n    duplikatList.forEach(dup => {\n      Logger.log(`  - Kolom ${dup.kolom}: \"${dup.header}\" (duplikat dari kolom ${dup.duplikatDari})`);\n    });\n    \n    Logger.log(`\\n🗑️ Menghapus duplikat...`);\n    indexTerhapus.sort((a, b) => b - a);\n    indexTerhapus.forEach(colIdx => {\n      sheet.deleteColumn(colIdx);\n    });\n    Logger.log(`✅ Duplikat header berhasil dihapus`);\n    \n    // Refresh headers setelah penghapusan\n    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];\n  } else {\n    Logger.log('✅ Tidak ada duplikat header');\n  }\n  \n  // ===== CEK 2: Struktur Data =====\n  if (!headers.includes('_id')) {\n    Logger.log('❌ ERROR: Kolom _id tidak ditemukan!');\n    return false;\n  }\n  Logger.log('✅ Kolom _id ada');\n  \n  // ===== CEK 3: Data Integrity =====\n  if (lastRow > 1) {\n    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();\n    const idIndex = headers.indexOf('_id');\n    let emptyIdCount = 0;\n    let totalCells = 0;\n    let emptyCells = 0;\n    \n    data.forEach(row => {\n      const idValue = row[idIndex];\n      if (!idValue || String(idValue).trim() === '') {\n        emptyIdCount++;\n      }\n      \n      row.forEach(cell => {\n        totalCells++;\n        if (!cell || String(cell).trim() === '') {\n          emptyCells++;\n        }\n      });\n    });\n    \n    if (emptyIdCount > 0) {\n      Logger.log(`⚠️ Ditemukan ${emptyIdCount} baris dengan _id kosong`);\n    }\n    \n    const fillRate = Math.round(((totalCells - emptyCells) / totalCells) * 100);\n    Logger.log(`📈 Data fill rate: ${fillRate}% (${emptyCells}/${totalCells} sel kosong)`);\n  }\n  \n  Logger.log('\\n========== VALIDASI SELESAI ==========\\n');\n  return true;\n}\n\n// Lihat duplikat header tanpa menghapus\nfunction lihatDuplikatHeader() {\n  const sheet = getSaggdKoboSheet_();\n  if (sheet.getLastRow() === 0) {\n    Logger.log('⚠️ Sheet kosong');\n    return;\n  }\n  \n  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];\n  const normalize = value => String(value || '').trim().toLowerCase();\n  \n  const seen = {};\n  const duplikat = [];\n  \n  Logger.log('\\n========== CEK DUPLIKAT HEADER ==========');\n  Logger.log(`Total kolom: ${headers.length}\\n`);\n  \n  headers.forEach((header, idx) => {\n    const normalized = normalize(header);\n    if (!normalized) return;\n    \n    if (seen[normalized]) {\n      duplikat.push({\n        header: header,\n        kolom: idx + 1,\n        duplikatDari: seen[normalized] + 1\n      });\n    } else {\n      seen[normalized] = idx;\n    }\n  });\n  \n  if (duplikat.length === 0) {\n    Logger.log('✅ Tidak ada duplikat header');\n  } else {\n    Logger.log(`❌ Ditemukan ${duplikat.length} duplikat:\\n`);\n    duplikat.forEach(dup => {\n      Logger.log(`Kolom ${dup.kolom}: \"${dup.header}\"`);\n      Logger.log(`  → Duplikat dari kolom ${dup.duplikatDari}`);\n    });\n  }\n  \n  Logger.log('\\n========== SELESAI ==========\\n');\n}\n\n// Hapus baris dengan _id kosong\nfunction hapusBarisDenganIdKosong() {\n  const sheet = getSaggdKoboSheet_();\n  if (sheet.getLastRow() <= 1) {\n    Logger.log('⚠️ Tidak ada data untuk diproses');\n    return;\n  }\n  \n  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];\n  const idIndex = headers.indexOf('_id');\n  \n  if (idIndex === -1) {\n    Logger.log('❌ Kolom _id tidak ditemukan');\n    return;\n  }\n  \n  const lastRow = sheet.getLastRow();\n  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();\n  \n  let rowsToDelete = [];\n  data.forEach((row, idx) => {\n    const idValue = row[idIndex];\n    if (!idValue || String(idValue).trim() === '') {\n      rowsToDelete.push(idx + 2); // +2 karena data mulai dari baris 2\n    }\n  });\n  \n  if (rowsToDelete.length === 0) {\n    Logger.log('✅ Tidak ada baris kosong untuk dihapus');\n    return;\n  }\n  \n  Logger.log(`\\n🗑️ Menghapus ${rowsToDelete.length} baris kosong...`);\n  // Hapus dari belakang ke depan\n  rowsToDelete.sort((a, b) => b - a);\n  rowsToDelete.forEach(rowIdx => {\n    sheet.deleteRow(rowIdx);\n  });\n  Logger.log(`✅ Selesai. ${rowsToDelete.length} baris dihapus.\\n`);\n}\n\n// Laporan data summary\nfunction laporanDataSAGGD() {\n  const sheet = getSaggdKoboSheet_();\n  if (sheet.getLastRow() === 0) {\n    Logger.log('⚠️ Sheet kosong');\n    return;\n  }\n  \n  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];\n  const lastRow = sheet.getLastRow();\n  \n  Logger.log('\\n========== LAPORAN DATA SAGGD ==========');\n  Logger.log(`Tanggal: ${new Date().toLocaleString('id-ID')}`);\n  Logger.log(`\\nStruktur:`);\n  Logger.log(`  Kolom: ${headers.length}`);\n  Logger.log(`  Data rows: ${lastRow - 1}`);\n  \n  // Data per kegiatan\n  const idxKegiatan = headers.indexOf('Nama Kegiatan');\n  if (idxKegiatan > -1 && lastRow > 1) {\n    const kegiatanData = sheet.getRange(2, idxKegiatan + 1, lastRow - 1, 1).getValues().flat();\n    const kegiatanCount = {};\n    \n    kegiatanData.forEach(kg => {\n      const key = String(kg || 'Tanpa Nama').trim();\n      kegiatanCount[key] = (kegiatanCount[key] || 0) + 1;\n    });\n    \n    Logger.log(`\\nData per kegiatan:`);\n    Object.entries(kegiatanCount).forEach(([kg, count]) => {\n      Logger.log(`  ${kg}: ${count}`);\n    });\n  }\n  \n  Logger.log('\\n========== SELESAI ==========\\n');\n}\n