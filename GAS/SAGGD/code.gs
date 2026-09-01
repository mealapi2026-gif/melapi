/** REST API Dashboard SAGGD. Semua data dipetakan dari nama header Sheet. */
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'dashboard';
    var data = action === 'photo' ? getPhotoData(params.fileId) :
      action === 'headers' ? getSaggdHeaders() :
      action === 'dashboard' ? getDashboardData() : null;
    if (data === null) throw new Error('Parameter action tidak dikenal.');
    return jsonSaggd_({ status: 'success', data: data });
  } catch (error) {
    return jsonSaggd_({ status: 'error', message: error.message || String(error) });
  }
}

function jsonSaggd_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function getSaggdSheetApi_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet aktif tidak ditemukan.');
  var sheet = ss.getSheetByName('SAGGD');
  if (!sheet) throw new Error("Sheet 'SAGGD' tidak ditemukan.");
  return sheet;
}

function getSaggdHeaders() {
  var sheet = getSaggdSheetApi_();
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (header, index) {
    return { index: index + 1, header: String(header || '').trim() };
  });
}

function normSaggd_(value) { return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase(); }
function cellSaggd_(row, index) {
  if (Array.isArray(index)) return index.map(function (item) { return cellSaggd_(row, item); }).filter(function (item) { return item !== ''; }).join('\n');
  return index >= 0 && row[index] != null ? row[index] : '';
}
function textSaggd_(value, fallback) {
  var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  return text || (fallback == null ? '' : fallback);
}
function numberSaggd_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  var normalized = String(value == null ? '' : value).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  var result = Number(normalized);
  return isFinite(result) ? result : 0;
}
function dateSaggd_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return textSaggd_(value, 'Tanggal belum diisi');
}
function pointSaggd_(value) {
  var match = String(value || '').match(/\[?\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return { lat: null, lng: null };
  var lat = Number(match[1]), lng = Number(match[2]);
  return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat: lat, lng: lng } : { lat: null, lng: null };
}
function photoListSaggd_(value) {
  var items = String(value || '').split(/[\n,;]+/).map(function (item) { return item.trim(); }).filter(function (item) { return /^https?:\/\//i.test(item); });
  return items.filter(function (item, index) { return items.indexOf(item) === index; });
}

function resolveSaggdColumns_(headers) {
  var normalized = headers.map(normSaggd_);
  function find(candidates) {
    for (var c = 0; c < candidates.length; c++) {
      var target = normSaggd_(candidates[c]);
      var exact = normalized.indexOf(target);
      if (exact >= 0) return exact;
    }
    return -1;
  }
  function findAll(candidates) {
    var matches = [];
    candidates.forEach(function (candidate) {
      var target = normSaggd_(candidate);
      normalized.forEach(function (header, index) { if (header === target && matches.indexOf(index) === -1) matches.push(index); });
    });
    return matches;
  }
  return {
    lokasiProgram: find(['_1_Lokasi_Program']), organisasi: find(['_2_Nama_Organisasi']), komoditas: find(['_3_Komoditas']),
    kegiatan: find(['4. Nama/Jenis Kegiatan']), kegiatanLain: find(['_4_17_Kegiatan_Lainnya', 'Kegiatan_Lainya']),
    pelapor: find(['_5_Dilaporkan_Oleh']), tanggal: find(['_6_Tanggal_Pelaksanaan', '_6_Tanggal_Pelaksanan']), lokasi: find(['_7_Lokasi']), durasi: find(['_8_Durasi']),
    pemudaLaki: find(['group_rn3xe30/_9_1_Pemuda_Laki_Lak_ia_kurang_dari_35_th', 'group_rn3xe30/_9a_Pemuda_Laki2_35_th']),
    pemudaPerempuan: find(['group_rn3xe30/_9_2_Pemuda_Perempua_ia_kurang_dari_35_th', 'group_rn3xe30/_9b_Pemuda_Perempuan_35_th']),
    dewasaLaki: find(['group_rn3xe30/_9_3_Laki_Laki_usia_lebih_dari_35_th', 'group_rn3xe30/_9c_Laki_35_th']),
    dewasaPerempuan: find(['group_rn3xe30/_9_4_Perempuan_usia_lebih_dari_35_th', 'group_rn3xe30/_9d_Perempuan_35_th']),
    hasil: find(['_10_Hasil_dari_kegiatan', '_10_Hasil_Dari_Kegiatan']),
    produksi: find(['group_uc9ij19/_11_1_PENGEMBANGAN_P_ODUKSI_BERKELANJUTAN', 'group_uc9ij19/A_PENGEMBANGAN_PRODUKSI_BERKELANJUTAN']),
    ekonomi: find(['group_uc9ij19/_11_2_PENGUATAN_KEL_NOMI_DAN_AKSES_PASAR', 'group_uc9ij19/B_PENGUATAN_KELEMBA_NOMI_DAN_AKSES_PASAR']),
    kapasitas: find(['group_uc9ij19/_11_3_PENINGKATAN_KA_S_DAN_KAMPANYE_MEDIA', 'group_uc9ij19/C_PENINGKATAN_KAPAS_SDM_DAN_INKLUSIFITAS']),
    advokasi: find(['group_uc9ij19/_11_4_ADVOKASI_DAN_KEBIJAKAN', 'group_uc9ij19/D_ADVOKASI_DAN_KEBIJAKAN']),
    biayaAktual: find(['_12_Pembiayaan_Aktual_Rp']), swadaya: find(['_14_Kontribusi_Organisasi_Swadaya_Rp', '_14_Kontribusi_Orgaisasi_Suwadaya_Rp']),
    lembagaLain: find(['_13_Lembaga_Lainnya']), absensi: findAll(['group_ty8ag48/_15_1_File_absen_1', 'group_ty8ag48/_15_2_File_absen_2', 'group_ty8ag48/_15_3_File_absen_3', '_15_Upload_Absen_Kegiatan']), foto: findAll(['group_ea59f89/_16_1_Foto_kegiatan_1', 'group_ea59f89/_16_2_Foto_kegiatan_2', 'group_ea59f89/_16_3_Foto_kegiatan', '_16_Upload_Foto_Kegiatan']), gps: find(['_17_Record_your_current_location', '_geolocation']),
    kabupaten: find(['Kabupaten', 'District', 'Kota'])
  };
}

function getDashboardData() {
  var values = getSaggdSheetApi_().getDataRange().getValues();
  if (values.length < 2) throw new Error('Sheet SAGGD belum memiliki data laporan.');
  var headers = values[0].map(function (value) { return String(value || '').trim(); });
  var cols = resolveSaggdColumns_(headers);
  var rows = values.slice(1).filter(function (row) { return row.some(function (value) { return value !== '' && value != null; }); });
  var organizations = {}, activities = {}, districts = {}, totalPeserta = 0, totalPembiayaan = 0;
  var table = rows.slice().reverse().map(function (row) {
    var kegiatan = textSaggd_(cellSaggd_(row, cols.kegiatan));
    if (/lainnya|lainya|4\.16/i.test(kegiatan)) kegiatan = textSaggd_(cellSaggd_(row, cols.kegiatanLain), 'Kegiatan lainnya');
    var organisasi = textSaggd_(cellSaggd_(row, cols.organisasi), '-');
    var kabupaten = textSaggd_(cellSaggd_(row, cols.kabupaten), '-');
    var aktual = numberSaggd_(cellSaggd_(row, cols.biayaAktual)), swadaya = numberSaggd_(cellSaggd_(row, cols.swadaya));
    var peserta = { pemudaLaki: String(numberSaggd_(cellSaggd_(row, cols.pemudaLaki))), pemudaPr: String(numberSaggd_(cellSaggd_(row, cols.pemudaPerempuan))), dewasaLaki: String(numberSaggd_(cellSaggd_(row, cols.dewasaLaki))), dewasaPr: String(numberSaggd_(cellSaggd_(row, cols.dewasaPerempuan))) };
    totalPeserta += numberSaggd_(peserta.pemudaLaki) + numberSaggd_(peserta.pemudaPr) + numberSaggd_(peserta.dewasaLaki) + numberSaggd_(peserta.dewasaPr);
    totalPembiayaan += aktual + swadaya;
    organizations[organisasi.toLowerCase()] = organisasi; activities[kegiatan.toLowerCase()] = kegiatan; if (kabupaten !== '-') districts[kabupaten.toLowerCase()] = kabupaten;
    var point = pointSaggd_(cellSaggd_(row, cols.gps));
    return { lokasi: textSaggd_(cellSaggd_(row, cols.lokasi), textSaggd_(cellSaggd_(row, cols.lokasiProgram), '-')), organisasi: organisasi, kabupaten: kabupaten, komoditas: textSaggd_(cellSaggd_(row, cols.komoditas), '-'), jenisKegiatan: kegiatan, pelapor: textSaggd_(cellSaggd_(row, cols.pelapor), '-'), tanggal: dateSaggd_(cellSaggd_(row, cols.tanggal)), durasi: textSaggd_(cellSaggd_(row, cols.durasi), '-'), peserta: peserta, hasil: textSaggd_(cellSaggd_(row, cols.hasil), '-'), indikator: { produksi: textSaggd_(cellSaggd_(row, cols.produksi), '-'), ekonomi: textSaggd_(cellSaggd_(row, cols.ekonomi), '-'), kapasitas: textSaggd_(cellSaggd_(row, cols.kapasitas), '-'), advokasi: textSaggd_(cellSaggd_(row, cols.advokasi), '-') }, pembiayaanAktual: aktual, biayaSwadaya: swadaya, biayaLembagaLain: 0, totalPembiayaanItem: aktual + swadaya, lembagaLainNama: textSaggd_(cellSaggd_(row, cols.lembagaLain), '-'), fotoAbsensi: photoListSaggd_(cellSaggd_(row, cols.absensi)), fotoKegiatan: photoListSaggd_(cellSaggd_(row, cols.foto)), lat: point.lat, lng: point.lng };
  });
  function sortedValues(object) { return Object.keys(object).map(function (key) { return object[key]; }).sort(); }
  return { kpi: { totalKegiatan: rows.length, totalPeserta: totalPeserta, totalPembiayaan: totalPembiayaan, totalOrganisasi: Object.keys(organizations).length }, filterOptions: { kegiatan: sortedValues(activities), organisasi: sortedValues(organizations), kabupaten: sortedValues(districts) }, table: table };
}

function getPhotoData(fileId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(String(fileId || ''))) throw new Error('ID foto tidak valid.');
  var file = DriveApp.getFileById(fileId);
  var blob = file.getThumbnail() || file.getBlob();
  if (blob.getContentType().indexOf('image/') !== 0) throw new Error('Dokumentasi bukan file gambar.');
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}
