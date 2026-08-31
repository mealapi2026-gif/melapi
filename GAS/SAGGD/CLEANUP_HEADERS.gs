// Utility: Deteksi dan bersihkan duplikat header di sheet SAGGD

function cekDuplikatHeader() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SAGGD');
  if (!sheet || sheet.getLastRow() === 0) {
    Logger.log('⚠️ Sheet SAGGD kosong atau tidak ditemukan');
    return;
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const normalize = value => String(value || '').trim().toLowerCase();
  
  Logger.log('\n========== CEK DUPLIKAT HEADER ==========');
  Logger.log('Total kolom: ' + headers.length);
  
  // Cari duplikat
  const seen = {};
  const duplikat = [];
  
  headers.forEach((header, idx) => {
    const normalized = normalize(header);
    if (!normalized) return; // Skip kosong
    
    if (seen[normalized]) {
      duplikat.push({
        header: header,
        index: idx,
        firstIndex: seen[normalized],
        normalized: normalized
      });
    } else {
      seen[normalized] = idx;
    }
  });
  
  if (duplikat.length === 0) {
    Logger.log('✅ Tidak ada duplikat header');
  } else {
    Logger.log('❌ Ditemukan ' + duplikat.length + ' duplikat header:');
    duplikat.forEach(dup => {
      Logger.log('  - "' + dup.header + '" (kolom ' + (dup.index + 1) + ', duplikat dari kolom ' + (dup.firstIndex + 1) + ')');
    });
  }
  
  Logger.log('=========================================\n');
  return duplikat;
}

function bersihkanDuplikatHeader() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SAGGD');
  if (!sheet || sheet.getLastRow() === 0) {
    Logger.log('⚠️ Sheet SAGGD kosong atau tidak ditemukan');
    return;
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const normalize = value => String(value || '').trim().toLowerCase();
  
  // Cari duplikat dan kumpulkan index untuk dihapus
  const seen = {};
  const indexTerhapus = [];
  
  headers.forEach((header, idx) => {
    const normalized = normalize(header);
    if (!normalized) return;
    
    if (seen[normalized]) {
      indexTerhapus.push(idx + 1); // 1-based untuk deleteColumn
    } else {
      seen[normalized] = idx;
    }
  });
  
  if (indexTerhapus.length === 0) {
    Logger.log('✅ Tidak ada duplikat yang perlu dihapus');
    return;
  }
  
  Logger.log('\nMenghapus ' + indexTerhapus.length + ' kolom duplikat...');
  // Hapus dari belakang ke depan agar index tidak berubah
  indexTerhapus.sort((a, b) => b - a);
  indexTerhapus.forEach(colIdx => {
    Logger.log('  Menghapus kolom ' + colIdx + '...');
    sheet.deleteColumn(colIdx);
  });
  Logger.log('✅ Kolom duplikat berhasil dihapus\n');
}
