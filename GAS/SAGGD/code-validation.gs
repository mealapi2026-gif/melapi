/**
 * MODUL VALIDASI DATA UNTUK DASHBOARD
 * ====================================
 * Pastikan hanya data VALID yang ditampilkan di dashboard SAGGD
 * - Filter baris dengan _id kosong
 * - Hapus duplikat data
 * - Validasi struktur field
 */

/**
 * Validasi data sebelum ditampilkan ke dashboard
 * @param {Array} rows - Array baris dari sheet
 * @returns {Object} { validRows, invalidRows, stats }
 */
function validasiDataDashboard_(rows) {
  if (!rows || rows.length === 0) {
    return { validRows: [], invalidRows: [], stats: { total: 0, valid: 0, invalid: 0, duplikat: 0 } };
  }

  const seenIds = new Set();
  const validRows = [];
  const invalidRows = [];
  let duplikatCount = 0;

  rows.forEach((row, index) => {
    // Ambil _id dari kolom pertama (index 0)
    const rowId = String(row[0] || "").trim();
    
    // CEK 1: _id harus ada dan tidak kosong
    if (!rowId || rowId === "" || rowId === "null" || rowId === "undefined") {
      invalidRows.push({
        index: index + 2, // +2 karena baris header (1) + 0-indexed (1)
        reason: "ID kosong",
        row: row
      });
      return;
    }

    // CEK 2: Cek duplikat _id
    if (seenIds.has(rowId)) {
      invalidRows.push({
        index: index + 2,
        reason: "Duplikat ID: " + rowId,
        row: row
      });
      duplikatCount++;
      return;
    }

    // CEK 3: Validasi field penting tidak semua kosong
    const kegiatan = String(row[7] || "").trim();
    const organisasi = String(row[5] || "").trim();
    const lokasi = String(row[4] || "").trim();

    if (!kegiatan && !organisasi && !lokasi) {
      invalidRows.push({
        index: index + 2,
        reason: "Data utama kosong (kegiatan, organisasi, lokasi)",
        row: row
      });
      return;
    }

    // Data VALID
    seenIds.add(rowId);
    validRows.push(row);
  });

  return {
    validRows: validRows,
    invalidRows: invalidRows,
    stats: {
      total: rows.length,
      valid: validRows.length,
      invalid: invalidRows.length,
      duplikat: duplikatCount
    }
  };
}

/**
 * Wrapper getDashboardData yang include validasi
 * Gunakan fungsi ini sebagai pengganti getDashboardData()
 */
function getDashboardDataWithValidation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("Gagal terhubung ke Database. Pastikan skrip ini terikat pada Google Sheets.");
  }
  
  const sheet = ss.getSheetByName("SAGGD");
  if (!sheet) {
    throw new Error("Sheet dengan nama 'SAGGD' tidak ditemukan.");
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    throw new Error("Tabel 'SAGGD' kosong. Hanya ada baris header tanpa data laporan.");
  }

  // Ambil dan validasi rows
  const rows = data.slice(1).filter(r => r.join("").trim() !== "");
  const validation = validasiDataDashboard_(rows);

  // Log validasi (hanya di production log, user tidak perlu lihat)
  if (validation.invalidRows.length > 0) {
    Logger.log(`⚠️ Dashboard: ${validation.invalidRows.length} baris tidak valid dihapus dari display`);
    Logger.log(`   - Duplikat: ${validation.stats.duplikat}`);
    Logger.log(`   - Kosong: ${validation.invalidRows.length - validation.stats.duplikat}`);
  }

  // Gunakan validRows untuk proses selanjutnya
  const validatedData = [data[0], ...validation.validRows]; // Include header

  // LANJUTKAN LOGIKA getDashboardData() SEPERTI BIASA dengan validatedData
  const headers = validatedData[0].map(h => String(h).trim()); 
  const processedRows = validatedData.slice(1);

  const requiredHeaders = {
    pemudaLaki: 'group_rn3xe30/_9a_Pemuda_Laki2_35_th',
    pemudaPerempuan: 'group_rn3xe30/_9b_Pemuda_Perempuan_35_th',
    lakiDewasa: 'group_rn3xe30/_9c_Laki_35_th',
    perempuanDewasa: 'group_rn3xe30/_9d_Perempuan_35_th',
    biayaAktual: '_12_Pembiayaan_Aktual_Rp',
    biayaSwadaya: '_14_Kontribusi_Orgaisasi_Suwadaya_Rp'
  };

  const idx = {};
  for (let key in requiredHeaders) {
    let index = headers.findIndex(h => {
      let headerLower = h.toLowerCase();
      let reqLower = requiredHeaders[key].toLowerCase();
      return headerLower === reqLower || headerLower.includes(reqLower);
    });
    idx[key] = index !== -1 ? index : -1; 
  }

  let totalPembiayaanGlobal = 0;
  let totalPeserta = 0;
  let organisasiSet = new Set();
  let organisasiNames = {};

  processedRows.forEach(row => {
    let org = row[5]; 
    if (org && String(org).trim() !== "") {
      let organizationName = String(org).replace(/\s+/g, " ").trim();
      let organizationKey = organizationName.toLowerCase();
      organisasiSet.add(organizationKey);
      if (!organisasiNames[organizationKey]) organisasiNames[organizationKey] = organizationName;
    }
    
    let bAktual = idx.biayaAktual !== -1 ? (parseFloat(row[idx.biayaAktual]) || 0) : (parseFloat(row[22]) || 0);
    let bSwadaya = idx.biayaSwadaya !== -1 ? (parseFloat(row[idx.biayaSwadaya]) || 0) : 0;
    let bLembagaLain = parseFloat(row[23]) || 0; 
    
    totalPembiayaanGlobal += (bAktual + bSwadaya + bLembagaLain);
    
    if (idx.pemudaLaki !== -1) totalPeserta += (parseFloat(row[idx.pemudaLaki]) || 0);
    if (idx.pemudaPerempuan !== -1) totalPeserta += (parseFloat(row[idx.pemudaPerempuan]) || 0);
    if (idx.lakiDewasa !== -1) totalPeserta += (parseFloat(row[idx.lakiDewasa]) || 0);
    if (idx.perempuanDewasa !== -1) totalPeserta += (parseFloat(row[idx.perempuanDewasa]) || 0);
  });

  const kegiatanTerbaru = processedRows.slice().reverse().map(row => {
    let namaKegiatan = String(row[7] || "").trim(); 
    let cekKegiatan = namaKegiatan.toLowerCase();
    
    if (cekKegiatan.includes("lainnya") || cekKegiatan.includes("lainya") || cekKegiatan.includes("4.16")) {
      namaKegiatan = String(row[8] || "-").trim(); 
    }

    let tglStr = "-";
    let tgl = row[10]; 
    if (tgl instanceof Date) {
      tglStr = Utilities.formatDate(tgl, Session.getScriptTimeZone(), "yyyy-MM-dd");
    } else if (tgl) {
      tglStr = String(tgl);
    }

    let gpsString = String(row[27] || "").trim(); 
    let lat = null;
    let lng = null;
    
    if (gpsString !== "" && gpsString !== "-") {
      try {
        let cleanString = gpsString.replace(/\[|\]/g, ''); 
        let parts = cleanString.split(/[\s,]+/); 
        
        if (parts.length >= 2) {
          lat = parseFloat(parts[0]); 
          lng = parseFloat(parts[1]); 
          
          if (!isNaN(lat) && !isNaN(lng)) {
            let randomOffsetLat = (Math.random() - 0.5) * 0.001;
            let randomOffsetLng = (Math.random() - 0.5) * 0.001;
            lat += randomOffsetLat;
            lng += randomOffsetLng;
          }
        }
      } catch (error) {
        // Abaikan
      }
    }

    let bAktual = idx.biayaAktual !== -1 ? (parseFloat(row[idx.biayaAktual]) || 0) : (parseFloat(row[22]) || 0);
    let bSwadaya = idx.biayaSwadaya !== -1 ? (parseFloat(row[idx.biayaSwadaya]) || 0) : 0;
    let bLembagaLain = parseFloat(row[23]) || 0; 
    let totalBiayaItem = bAktual + bSwadaya + bLembagaLain;

    return {
      lokasi: String(row[4] || "-"),           
      organisasi: row[5] ? String(row[5]).replace(/\s+/g, " ").trim() : "-",
      komoditas: String(row[6] || "-"),        
      jenisKegiatan: namaKegiatan,             
      pelapor: String(row[9] || "-"),          
      tanggal: tglStr,                         
      durasi: String(row[12] || "-"),          
      peserta: {
        pemudaLaki: String(row[13] || "0"),    
        pemudaPr: String(row[14] || "0"),      
        dewasaLaki: String(row[15] || "0"),    
        dewasaPr: String(row[16] || "0")       
      },
      hasil: String(row[17] || "-"),           
      indikator: {
        produksi: String(row[18] || "-"),      
        ekonomi: String(row[19] || "-"),       
        kapasitas: String(row[20] || "-"),     
        advokasi: String(row[21] || "-")       
      },
      pembiayaanAktual: bAktual,    
      biayaSwadaya: bSwadaya,
      biayaLembagaLain: bLembagaLain,
      totalPembiayaanItem: totalBiayaItem,
      lembagaLainNama: String(row[23] || "-"), 
      fotoAbsensi: String(row[25] || ""),      
      fotoKegiatan: String(row[26] || ""),
      lat: lat,
      lng: lng
    };
  });

  return {
    kpi: {
      totalKegiatan: validation.validRows.length,  // Gunakan validated count
      totalPeserta: totalPeserta,
      totalPembiayaan: totalPembiayaanGlobal,
      totalOrganisasi: organisasiSet.size
    },
    filterOptions: {
      kegiatan: uniqueActivityNames_(kegiatanTerbaru),
      organisasi: Object.keys(organisasiNames).map(function (key) { return organisasiNames[key]; }).sort()
    },
    table: kegiatanTerbaru,
    _validation: {
      totalRows: validation.stats.total,
      validRows: validation.stats.valid,
      invalidRows: validation.stats.invalid,
      duplicateCount: validation.stats.duplikat
    }
  };
}

/**
 * Test: Lihat detail validasi data
 */
function testValidasiDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("SAGGD");
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1).filter(r => r.join("").trim() !== "");
  
  const validation = validasiDataDashboard_(rows);
  
  Logger.log("=== VALIDASI DATA DASHBOARD ===");
  Logger.log(`Total baris: ${validation.stats.total}`);
  Logger.log(`Baris valid: ${validation.stats.valid}`);
  Logger.log(`Baris invalid: ${validation.stats.invalid}`);
  Logger.log(`Duplikat: ${validation.stats.duplikat}`);
  
  if (validation.invalidRows.length > 0) {
    Logger.log("\n📋 Detail baris tidak valid:");
    validation.invalidRows.forEach(item => {
      Logger.log(`  Baris ${item.index}: ${item.reason}`);
    });
  }
}
