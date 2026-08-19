// GANTI fungsi doGet() lama dengan ini:
function doGet(e) {
  try {
    // Memanggil fungsi logika Anda yang sudah ada
    const resultData = getDashboardData();
    
    // Mengubah hasil menjadi format string JSON
    const jsonResponse = JSON.stringify({
      status: "success",
      data: resultData
    });
    
    // Mengembalikan data sebagai REST API (JSON)
    return ContentService.createTextOutput(jsonResponse)
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Jika ada error (misal nama sheet salah/kosong), kembalikan pesan error
    const errorResponse = JSON.stringify({
      status: "error",
      message: error.message || String(error)
    });
    
    return ContentService.createTextOutput(errorResponse)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- BIARKAN FUNGSI DI BAWAH INI TETAP ADA SEPERTI SEMULA ---
// function getDashboardData() { ... }
function getDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error("Gagal terhubung ke Database. Pastikan skrip ini terikat pada Google Sheets.");
  }
  
  const sheet = ss.getSheetByName("SAGGD");
  if (!sheet) {
    throw new Error("Sheet dengan nama 'SAGGD' tidak ditemukan. Harap pastikan nama tab di bawah spreadsheet persis 'SAGGD'.");
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    throw new Error("Tabel 'SAGGD' kosong. Hanya ada baris header tanpa data laporan.");
  }

  const headers = data[0].map(h => String(h).trim()); 
  // Memotong 1 baris header, data dibaca dari baris ke-2
  const rows = data.slice(1).filter(r => r.join("").trim() !== "");

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

  rows.forEach(row => {
    let org = row[5]; 
    if (org && String(org).trim() !== "") organisasiSet.add(String(org).trim());
    
    let bAktual = idx.biayaAktual !== -1 ? (parseFloat(row[idx.biayaAktual]) || 0) : (parseFloat(row[22]) || 0);
    let bSwadaya = idx.biayaSwadaya !== -1 ? (parseFloat(row[idx.biayaSwadaya]) || 0) : 0;
    let bLembagaLain = parseFloat(row[23]) || 0; 
    
    totalPembiayaanGlobal += (bAktual + bSwadaya + bLembagaLain);
    
    if (idx.pemudaLaki !== -1) totalPeserta += (parseFloat(row[idx.pemudaLaki]) || 0);
    if (idx.pemudaPerempuan !== -1) totalPeserta += (parseFloat(row[idx.pemudaPerempuan]) || 0);
    if (idx.lakiDewasa !== -1) totalPeserta += (parseFloat(row[idx.lakiDewasa]) || 0);
    if (idx.perempuanDewasa !== -1) totalPeserta += (parseFloat(row[idx.perempuanDewasa]) || 0);
  });

  const kegiatanTerbaru = rows.slice().reverse().map(row => {
    
    // LOGIKA PERBAIKAN "KEGIATAN LAINNYA" (KOLOM H & I)
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

    // LOGIKA PEMECAHAN KOORDINAT (KOLOM AB / INDEKS 27)
    let gpsString = String(row[27] || "").trim(); 
    let lat = null;
    let lng = null;
    
    if (gpsString !== "" && gpsString !== "-") {
      try {
        // Hapus kurung siku jika ada, misal: "[-8.14, 112.17]" menjadi "-8.14, 112.17"
        let cleanString = gpsString.replace(/\[|\]/g, ''); 
        
        // Pisahkan berdasarkan koma dan/atau spasi
        let parts = cleanString.split(/[\s,]+/); 
        
        if (parts.length >= 2) {
          lat = parseFloat(parts[0]); 
          lng = parseFloat(parts[1]); 
          
          // TRIK JITTER: Geser titik sejauh ~50-100 meter agar marker tidak saling menutupi
          if (!isNaN(lat) && !isNaN(lng)) {
            let randomOffsetLat = (Math.random() - 0.5) * 0.001;
            let randomOffsetLng = (Math.random() - 0.5) * 0.001;
            lat += randomOffsetLat;
            lng += randomOffsetLng;
          }
        }
      } catch (error) {
        // Abaikan jika format teks salah/tidak valid
      }
    }

    let bAktual = idx.biayaAktual !== -1 ? (parseFloat(row[idx.biayaAktual]) || 0) : (parseFloat(row[22]) || 0);
    let bSwadaya = idx.biayaSwadaya !== -1 ? (parseFloat(row[idx.biayaSwadaya]) || 0) : 0;
    let bLembagaLain = parseFloat(row[23]) || 0; 
    let totalBiayaItem = bAktual + bSwadaya + bLembagaLain;

    return {
      lokasi: String(row[4] || "-"),           
      organisasi: String(row[5] || "-"),       
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
      totalKegiatan: rows.length,
      totalPeserta: totalPeserta,
      totalPembiayaan: totalPembiayaanGlobal,
      totalOrganisasi: organisasiSet.size
    },
    table: kegiatanTerbaru
  };
}