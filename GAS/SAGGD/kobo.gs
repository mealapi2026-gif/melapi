var SAGGD_KOBO_CONFIG = {
  token: '2314bc793b14bb76cc7ee2ae1eab1a750d557a97',
  assetUid: 'a7vNjseoAicBntatMQVdfC',
  sheetName: 'SAGGD',
  headerSheetName: 'SAGGD_Header_Kobo',
  driveFolderId: '1_gapfewLlFqIwu3rEKaD3eWGW0kKmt7p',
  baseUrl: 'https://kf.kobotoolbox.org'
};

// Alias menjaga data form lama dan form Kobo yang diperbarui tetap masuk ke
// kolom yang sama. Key pertama adalah header lama di Sheet; nilai berikutnya
// adalah key submission Kobo yang ekuivalen.
var SAGGD_HEADER_ALIASES = {
  '_2_Nama_Organisasi': ['_2_Nama_Organisasi'],
  '_6_Tanggal_Pelaksanan': ['_6_Tanggal_Pelaksanaan', '_6_Tanggal_Pelaksanan'],
  '_6_Tanggal_Pelaksanaan': ['_6_Tanggal_Pelaksanaan', '_6_Tanggal_Pelaksanan'],
  'group_rn3xe30/_9a_Pemuda_Laki2_35_th': ['group_rn3xe30/_9_1_Pemuda_Laki_Lak_ia_kurang_dari_35_th', 'group_rn3xe30/_9a_Pemuda_Laki2_35_th'],
  'group_rn3xe30/_9b_Pemuda_Perempuan_35_th': ['group_rn3xe30/_9_2_Pemuda_Perempua_ia_kurang_dari_35_th', 'group_rn3xe30/_9b_Pemuda_Perempuan_35_th'],
  'group_rn3xe30/_9c_Laki_35_th': ['group_rn3xe30/_9_3_Laki_Laki_usia_lebih_dari_35_th', 'group_rn3xe30/_9c_Laki_35_th'],
  'group_rn3xe30/_9d_Perempuan_35_th': ['group_rn3xe30/_9_4_Perempuan_usia_lebih_dari_35_th', 'group_rn3xe30/_9d_Perempuan_35_th'],
  '_10_Hasil_Dari_Kegiatan': ['_10_Hasil_dari_kegiatan', '_10_Hasil_Dari_Kegiatan'],
  'group_uc9ij19/A_PENGEMBANGAN_PRODUKSI_BERKELANJUTAN': ['group_uc9ij19/_11_1_PENGEMBANGAN_P_ODUKSI_BERKELANJUTAN', 'group_uc9ij19/A_PENGEMBANGAN_PRODUKSI_BERKELANJUTAN'],
  'group_uc9ij19/B_PENGUATAN_KELEMBA_NOMI_DAN_AKSES_PASAR': ['group_uc9ij19/_11_2_PENGUATAN_KEL_NOMI_DAN_AKSES_PASAR', 'group_uc9ij19/B_PENGUATAN_KELEMBA_NOMI_DAN_AKSES_PASAR'],
  'group_uc9ij19/C_PENINGKATAN_KAPAS_SDM_DAN_INKLUSIFITAS': ['group_uc9ij19/_11_3_PENINGKATAN_KA_S_DAN_KAMPANYE_MEDIA', 'group_uc9ij19/C_PENINGKATAN_KAPAS_SDM_DAN_INKLUSIFITAS'],
  'group_uc9ij19/D_ADVOKASI_DAN_KEBIJAKAN': ['group_uc9ij19/_11_4_ADVOKASI_DAN_KEBIJAKAN', 'group_uc9ij19/D_ADVOKASI_DAN_KEBIJAKAN'],
  '_14_Kontribusi_Orgaisasi_Suwadaya_Rp': ['_14_Kontribusi_Organisasi_Swadaya_Rp', '_14_Kontribusi_Orgaisasi_Suwadaya_Rp'],
  '_14_Kontribusi_Organisasi_Swadaya_Rp': ['_14_Kontribusi_Organisasi_Swadaya_Rp', '_14_Kontribusi_Orgaisasi_Suwadaya_Rp'],
  '_15_Upload_Absen_Kegiatan': ['group_ty8ag48/_15_1_File_absen_1', 'group_ty8ag48/_15_2_File_absen_2', 'group_ty8ag48/_15_3_File_absen_3', '_15_Upload_Absen_Kegiatan'],
  '_16_Upload_Foto_Kegiatan': ['group_ea59f89/_16_1_Foto_kegiatan_1', 'group_ea59f89/_16_2_Foto_kegiatan_2', 'group_ea59f89/_16_3_Foto_kegiatan', '_16_Upload_Foto_Kegiatan'],
  'Kegiatan_Lainya': ['_4_17_Kegiatan_Lainnya', 'Kegiatan_Lainya'],
  '_4_17_Kegiatan_Lainnya': ['_4_17_Kegiatan_Lainnya', 'Kegiatan_Lainya']
};

function getSaggdKoboToken_() {
  return PropertiesService.getScriptProperties().getProperty('SAGGD_KOBO_TOKEN') || SAGGD_KOBO_CONFIG.token;
}

function setSaggdKoboToken_(token) {
  if (!token || String(token).trim().length < 20) {
    throw new Error('Token Kobo tidak valid.');
  }
  var cleanToken = String(token).trim();
  PropertiesService.getScriptProperties().setProperty('SAGGD_KOBO_TOKEN', cleanToken);
  SAGGD_KOBO_CONFIG.token = cleanToken;
}

function getSaggdKoboSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Spreadsheet aktif tidak ditemukan.');
  return spreadsheet.getSheetByName(SAGGD_KOBO_CONFIG.sheetName) ||
    spreadsheet.insertSheet(SAGGD_KOBO_CONFIG.sheetName);
}

function getSaggdHeaderSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Spreadsheet aktif tidak ditemukan.');
  return spreadsheet.getSheetByName(SAGGD_KOBO_CONFIG.headerSheetName) ||
    spreadsheet.insertSheet(SAGGD_KOBO_CONFIG.headerSheetName);
}

function normalizeSaggdKey_(value) {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function submissionValueForHeader_(submission, sheetHeader, labelMap, reverseLabelMap) {
  var header = String(sheetHeader || '').trim();
  var candidates = [];
  function add(candidate) {
    if (candidate && candidates.indexOf(candidate) === -1) candidates.push(candidate);
  }
  add(header);
  add(reverseLabelMap[header]);
  (SAGGD_HEADER_ALIASES[header] || []).forEach(add);

  // Header baru kadang sudah merupakan label pertanyaan Kobo, sehingga cari
  // berdasarkan nama internal dan versi normalisasinya sebagai fallback.
  Object.keys(labelMap).forEach(function (key) {
    if (normalizeSaggdKey_(labelMap[key]) === normalizeSaggdKey_(header)) add(key);
  });
  var submissionKeys = Object.keys(submission);
  candidates.forEach(function (candidate) {
    if (Object.prototype.hasOwnProperty.call(submission, candidate) && submission[candidate] !== '' && submission[candidate] != null) {
      return;
    }
  });
  for (var i = 0; i < candidates.length; i++) {
    if (Object.prototype.hasOwnProperty.call(submission, candidates[i])) return submission[candidates[i]];
  }
  var normalizedHeader = normalizeSaggdKey_(header);
  for (var j = 0; j < submissionKeys.length; j++) {
    if (normalizeSaggdKey_(submissionKeys[j]) === normalizedHeader) return submission[submissionKeys[j]];
  }
  return '';
}

function formatSaggdKoboValue_(value, choiceMap) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return typeof value === 'object' ? JSON.stringify(value) : value;
  var text = value.trim();
  if (!text) return '';
  if (choiceMap[text] || choiceMap[normalizeSaggdKey_(text)]) return choiceMap[text] || choiceMap[normalizeSaggdKey_(text)];
  var parts = text.split(/\s+/);
  if (parts.length > 1 && parts.some(function (part) { return choiceMap[part] || choiceMap[normalizeSaggdKey_(part)]; })) {
    return parts.map(function (part) { return choiceMap[part] || choiceMap[normalizeSaggdKey_(part)] || part; }).join(', ');
  }
  return text;
}

// Mengambil nama field terbaru langsung dari form dan satu submission Kobo,
// lalu menulisnya ke tab SAGGD_Header_Kobo tanpa mengubah tab data SAGGD.
function ambilHeaderKoboSaggd() {
  var config = SAGGD_KOBO_CONFIG;
  var options = {
    method: 'get',
    headers: { Authorization: 'Token ' + config.token },
    muteHttpExceptions: true
  };
  var assetResponse = UrlFetchApp.fetch(config.baseUrl + '/api/v2/assets/' + config.assetUid + '/', options);
  if (assetResponse.getResponseCode() !== 200) {
    throw new Error('Gagal mengambil struktur form Kobo (HTTP ' + assetResponse.getResponseCode() + ').');
  }
  var asset = JSON.parse(assetResponse.getContentText());
  var survey = asset.content && asset.content.survey ? asset.content.survey : [];
  var formFields = survey.filter(function (question) { return question && question.name; }).map(function (question) {
    var label = Array.isArray(question.label) ? question.label[0] : (question.label || question.name);
    return {
      name: question.name,
      label: String(label).replace(/\r?\n|\r/g, ' ').trim(),
      type: question.type || '',
      xpath: question.$xpath || ''
    };
  });

  var dataResponse = UrlFetchApp.fetch(config.baseUrl + '/api/v2/assets/' + config.assetUid + '/data.json?limit=1', options);
  if (dataResponse.getResponseCode() !== 200) {
    throw new Error('Gagal mengambil contoh submission Kobo (HTTP ' + dataResponse.getResponseCode() + ').');
  }
  var results = JSON.parse(dataResponse.getContentText()).results || [];
  var submissionHeaders = results.length ? Object.keys(results[0]).sort() : [];
  var result = {
    assetUid: config.assetUid,
    formFields: formFields,
    submissionHeaders: submissionHeaders,
    fetchedAt: new Date().toISOString()
  };
  tulisHeaderKoboSaggd_(result);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function tulisHeaderKoboSaggd_(result) {
  var sheet = getSaggdHeaderSheet_();
  var formNames = result.formFields.map(function (field) { return field.name; });
  var formLabels = result.formFields.map(function (field) { return field.label; });
  var formTypes = result.formFields.map(function (field) { return field.type; });
  var formXpaths = result.formFields.map(function (field) { return field.xpath; });
  var width = Math.max(formNames.length, result.submissionHeaders.length) + 1;
  function paddedRow(label, values) {
    // setValues() menolak array berlubang atau baris dengan panjang berbeda.
    // Isi seluruh sel lebih dulu, lalu salin nilai header secara horizontal.
    var row = [];
    for (var column = 0; column < width; column++) row.push('');
    row[0] = label;
    for (var index = 0; index < values.length && index + 1 < width; index++) {
      row[index + 1] = values[index] == null ? '' : values[index];
    }
    return row;
  }
  var rows = [
    paddedRow('Nama internal form Kobo', formNames),
    paddedRow('Label pertanyaan Kobo', formLabels),
    paddedRow('Tipe field', formTypes),
    paddedRow('XPath', formXpaths),
    paddedRow('', []),
    paddedRow('Key submission terbaru', result.submissionHeaders),
    paddedRow('Diambil pada', [result.fetchedAt])
  ];

  // Ini adalah tab referensi khusus; setiap pengambilan menggantikan snapshot lama.
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, width).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 4, 1).setFontWeight('bold').setBackground('#d9ead3');
  sheet.getRange(6, 1, 2, 1).setFontWeight('bold').setBackground('#d9ead3');
  sheet.autoResizeColumns(1, width);
}

// Fungsi helper untuk retry download dengan exponential backoff
function downloadFileWithRetry_(downloadUrl, koboToken, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fetchOptions = {
        "method": "get",
        "headers": { "Authorization": "Token " + koboToken },
        "muteHttpExceptions": true,
        "followRedirects": false 
      };
      
      let fileResponse = UrlFetchApp.fetch(downloadUrl, fetchOptions);
      let responseCode = fileResponse.getResponseCode();

      // Handle redirect
      if (responseCode === 301 || responseCode === 302 || responseCode === 307) {
        let redirectUrl = fileResponse.getHeaders()['Location'];
        fileResponse = UrlFetchApp.fetch(redirectUrl, { "muteHttpExceptions": true });
        responseCode = fileResponse.getResponseCode();
      }

      if (responseCode === 200) {
        return fileResponse; // Sukses
      }
      
      Logger.log(`Attempt ${attempt}: HTTP ${responseCode}, retry...`);
      Utilities.sleep(Math.pow(2, attempt) * 1000); // Exponential backoff: 2s, 4s, 8s
    } catch (err) {
      Logger.log(`Attempt ${attempt} error: ${err.message}`);
      if (attempt < maxRetries) {
        Utilities.sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  return null; // Gagal setelah semua retry
}

// Fungsi untuk ambil semua data dari Kobo dengan pagination nextUrl
function ambilSemuaDataKoboDenganPaginasi_(baseUrl, assetUid, token) {
  const options = {
    method: 'get',
    headers: { Authorization: 'Token ' + token },
    muteHttpExceptions: true
  };

  let allSubmissions = [];
  let nextUrl = `${baseUrl}/api/v2/assets/${assetUid}/data.json`;
  let page = 1;

  Logger.log('🔄 Mulai pengambilan data dari Kobo (pagination nextUrl)...');
  Logger.log(`📍 Base URL: ${baseUrl}`);
  Logger.log(`🔑 Asset UID: ${assetUid}`);
  Logger.log(`🔐 Token prefix: ${token.substring(0, 10)}...`);

  while (nextUrl) {
    Logger.log(`📤 Request ${page}: ${nextUrl}`);
    const response = UrlFetchApp.fetch(nextUrl, options);
    const httpCode = response.getResponseCode();

    if (httpCode !== 200) {
      const errorBody = response.getContentText();
      Logger.log(`⚠️ Error HTTP ${httpCode} pada ${nextUrl}`);
      Logger.log(`📋 Response: ${errorBody.substring(0, 500)}`);
      throw new Error(`Gagal mengambil data Kobo: HTTP ${httpCode}`);
    }

    const pageData = JSON.parse(response.getContentText());
    const submissions = pageData.results || [];
    allSubmissions = allSubmissions.concat(submissions);
    Logger.log(`✓ Halaman ${page}: ${submissions.length} submission, Total: ${allSubmissions.length}`);

    nextUrl = pageData.next || '';
    page += 1;
    if (nextUrl) {
      Utilities.sleep(500);
    }
  }

  Logger.log(`✅ Total data diambil: ${allSubmissions.length}`);
  return allSubmissions;
}

function tarikDataKoboOtomatis() {
  const KOBO_TOKEN = getSaggdKoboToken_();
  const ASSET_UID = SAGGD_KOBO_CONFIG.assetUid;
  const DRIVE_FOLDER_ID = SAGGD_KOBO_CONFIG.driveFolderId;
  const KOBO_BASE_URL = SAGGD_KOBO_CONFIG.baseUrl;
  const MAX_DATA_PER_RUN = 100;

  // Validasi data sebelum sync (gunakan VALIDATION_UTILITIES.gs)
  // Fungsi validasiDanBersihkanSAGGD() akan deteksi & hapus duplikat header
  if (typeof validasiDanBersihkanSAGGD === 'function') {
    try {
      Logger.log('🔍 Validasi spreadsheet...');
      validasiDanBersihkanSAGGD();
    } catch (err) {
      Logger.log('⚠️ Validasi skip: ' + err.message);
    }
  }

  const HEADER_NAMA_KEGIATAN = 'Nama Kegiatan';
  const HEADER_FOTO_ABSENSI = 'Foto Absensi';
  const HEADER_FOTO_KEGIATAN = 'Foto Kegiatan';

  const sheet = getSaggdKoboSheet_();
  const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const options = {
    method: 'get',
    headers: { Authorization: 'Token ' + KOBO_TOKEN },
    muteHttpExceptions: true
  };

  const normalize = normalizeSaggdKey_;

  let folderCache = {};
  function getOrCreateFolder(parentFolder, folderName) {
    folderName = String(folderName || 'Tanpa Nama').replace(/[\/\?<>\\:\*\|":]/g, '_').trim();
    if (!folderName) folderName = 'Tanpa Nama';

    const cacheKey = parentFolder.getId() + '_' + folderName;
    if (folderCache[cacheKey]) return DriveApp.getFolderById(folderCache[cacheKey]);

    const folders = parentFolder.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : parentFolder.createFolder(folderName);
    folderCache[cacheKey] = folder.getId();
    return folder;
  }

  const assetInfoUrl = `${KOBO_BASE_URL}/api/v2/assets/${ASSET_UID}/`;
  const assetResponse = UrlFetchApp.fetch(assetInfoUrl, options);
  let labelMap = {};
  let reverseLabelMap = {};
  let choiceMap = {};

  if (assetResponse.getResponseCode() === 200) {
    const assetData = JSON.parse(assetResponse.getContentText());
    if (assetData.content && assetData.content.survey) {
      const walkSurvey = function (questions) {
        (questions || []).forEach(function (q) {
          if (!q || !q.name) return;
          let label = Array.isArray(q.label) ? q.label[0] : (q.label || q.name);
          label = String(label).replace(/\r?\n|\r/g, ' ').trim();
          labelMap[q.name] = label;
          reverseLabelMap[label] = q.name;
          if (q.children) walkSurvey(q.children);
        });
      };
      walkSurvey(assetData.content.survey);
    }

    if (assetData.content && assetData.content.choices) {
      assetData.content.choices.forEach(function (choice) {
        if (choice && choice.name) {
          let label = Array.isArray(choice.label) ? choice.label[0] : (choice.label || choice.name);
          choiceMap[choice.name] = label;
          choiceMap[normalize(choice.name)] = label;
        }
      });
    }
  }

  const submissions = ambilSemuaDataKoboDenganPaginasi_(KOBO_BASE_URL, ASSET_UID, KOBO_TOKEN);
  if (!submissions || submissions.length === 0) {
    Logger.log('⚠️ Tidak ada data submission dari Kobo');
    return;
  }

  let allColumns = new Set();
  submissions.forEach(function (sub) {
    Object.keys(sub).forEach(function (key) {
      if (key !== '_attachments') allColumns.add(key);
    });
  });

  let internalHeaders = Array.from(allColumns);
  let sheetHeaders = [];

  if (sheet.getLastRow() === 0) {
    sheetHeaders = internalHeaders.map(function (header) {
      return labelMap[header] || header;
    });
    sheet.appendRow(sheetHeaders);
    Logger.log(`✓ Header dibuat: ${sheetHeaders.length} kolom`);
  } else {
    sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    var missingHeaders = internalHeaders.filter(function (internalHeader) {
      return !sheetHeaders.some(function (sheetHeader) {
        var label = labelMap[internalHeader] || internalHeader;
        return String(sheetHeader || '').trim() === String(label || '').trim() || normalize(sheetHeader) === normalize(label);
      });
    });

    if (missingHeaders.length > 0) {
      var newHeaders = missingHeaders.map(function (internalHeader) {
        return labelMap[internalHeader] || internalHeader;
      });
      var firstNewColumn = sheetHeaders.length + 1;
      sheet.getRange(1, firstNewColumn, 1, newHeaders.length).setValues([newHeaders]);
      sheetHeaders = sheetHeaders.concat(newHeaders);
      Logger.log(`Sheet SAGGD diperbarui: ${missingHeaders.length} kolom baru ditambahkan.`);
    }
  }

  let existingIds = [];
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const idIndex = sheetHeaders.indexOf('_id');
    if (idIndex > -1) {
      existingIds = sheet.getRange(2, idIndex + 1, lastRow - 1, 1).getValues().flat().map(String);
    }
  }

  Logger.log(`📊 Status: ${lastRow - 1} existing rows, ${submissions.length} total in Kobo, ${existingIds.length} existing IDs`);

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const findHeaderIndexes = function (patterns) {
    return sheetHeaders.reduce(function (indexes, header, index) {
      const normalizedHeader = normalize(header);
      if (patterns.some(function (pattern) { return normalizedHeader.indexOf(normalize(pattern)) !== -1; })) indexes.push(index);
      return indexes;
    }, []);
  };
  const activityIndexes = findHeaderIndexes([HEADER_NAMA_KEGIATAN, 'Nama Jenis Kegiatan']);
  const attendancePhotoIndexes = findHeaderIndexes([HEADER_FOTO_ABSENSI, 'Upload Absen', 'File absen']);
  const activityPhotoIndexes = findHeaderIndexes([HEADER_FOTO_KEGIATAN, 'Upload Foto Kegiatan', 'Foto Kegiatan']);

  const existingRowsById = {};
  if (lastRow > 1 && sheetHeaders.indexOf('_id') > -1) {
    const savedRows = sheet.getRange(2, 1, lastRow - 1, sheetHeaders.length).getValues();
    savedRows.forEach(function (row, index) {
      const id = String(row[sheetHeaders.indexOf('_id')] || '').trim();
      if (id) existingRowsById[id] = { rowNumber: index + 2, values: row };
    });
  }
  let dataBaru = submissions.filter(function (sub) { return !existingRowsById[String(sub._id)]; });
  let dataLama = submissions.filter(function (sub) { return Boolean(existingRowsById[String(sub._id)]); });
  Logger.log(`🆕 Data baru ditemukan: ${dataBaru.length}`);
  
  // Ambil hanya MAX_DATA_PER_RUN data pertama untuk processing
  const dataYangAkanDiproses = dataBaru.concat(dataLama).slice(0, MAX_DATA_PER_RUN);
  Logger.log(`📋 Data yang akan diproses: ${dataYangAkanDiproses.length} (limit: ${MAX_DATA_PER_RUN})`);
  
  if (dataBaru.length > MAX_DATA_PER_RUN) {
    Logger.log(`  (Sisa ${dataBaru.length - MAX_DATA_PER_RUN} data akan diproses di run berikutnya)`);
  }

  if (dataYangAkanDiproses.length === 0) {
    Logger.log('✅ Tidak ada data baru untuk diproses');
    return;
  }

  let allNewRows = [];
  let updatedRows = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < dataYangAkanDiproses.length; i++) {
    try {
      const sub = dataYangAkanDiproses[i];
      const koboId = String(sub._id);
      let rowData = [];

      for (let h = 0; h < sheetHeaders.length; h++) {
        const value = submissionValueForHeader_(sub, sheetHeaders[h], labelMap, reverseLabelMap);
        rowData.push(formatSaggdKoboValue_(value, choiceMap));
      }

      const submitDate = new Date(sub._submission_time);
      const namaBulan = monthNames[submitDate.getMonth()] + ' ' + submitDate.getFullYear();
      const namaKegiatan = activityIndexes.map(function (index) { return rowData[index]; }).find(function (value) { return String(value || '').trim() !== ''; }) || 'Kegiatan Tidak Diketahui';

      let fileMap = {};
      if (sub._attachments && sub._attachments.length > 0) {
        Logger.log(`  📁 ${koboId}: Download ${sub._attachments.length} file...`);

        for (let j = 0; j < sub._attachments.length; j++) {
          const attachment = sub._attachments[j];
          const downloadUrl = attachment.download_url;
          const rawFileName = String(attachment.filename || '').split('/').pop();
          let originalFileName = rawFileName;
          try {
            originalFileName = decodeURIComponent(rawFileName);
          } catch (e) {
            // ignore decode error
          }

          const newFileName = `${koboId}_${originalFileName}`;

          try {
            let kategori = 'Lainnya';
            if (attendancePhotoIndexes.some(function (index) { return String(rowData[index] || '').indexOf(originalFileName) !== -1; })) {
              kategori = 'Foto Absensi';
            } else if (activityPhotoIndexes.some(function (index) { return String(rowData[index] || '').indexOf(originalFileName) !== -1; })) {
              kategori = 'Foto Kegiatan';
            }

            const catFolder = getOrCreateFolder(rootFolder, kategori);
            const monthFolder = getOrCreateFolder(catFolder, namaBulan);
            const actFolder = getOrCreateFolder(monthFolder, namaKegiatan);

            const fileResponse = downloadFileWithRetry_(downloadUrl, KOBO_TOKEN, 3);
            if (fileResponse) {
              let fileBlob;
              if (String(originalFileName).toLowerCase().endsWith('.heic')) {
                const rawData = fileResponse.getContent();
                fileBlob = Utilities.newBlob(rawData, 'image/heic', newFileName);
              } else {
                fileBlob = fileResponse.getBlob().setName(newFileName);
              }

              const file = actFolder.createFile(fileBlob);
              fileMap[originalFileName] = file.getUrl();
              fileMap[rawFileName] = file.getUrl();
              Logger.log(`    ✓ File: ${originalFileName}`);
              Utilities.sleep(500);
            } else {
              Logger.log(`    ⚠️ File gagal download: ${originalFileName}`);
            }
          } catch (err) {
            Logger.log(`    ❌ Error proses file ${originalFileName}: ${err.message}`);
          }
        }
      }

      for (let c = 0; c < rowData.length; c++) {
        let cellText = String(rowData[c] || '');
        if (!cellText || cellText === 'undefined' || cellText.trim() === '') continue;

        const matchedUrls = [];
        for (let fileName in fileMap) {
          const fileCompare = String(fileName).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (fileCompare.length > 3 && cellText.toLowerCase().includes(fileName.toLowerCase())) {
            matchedUrls.push(fileMap[fileName]);
          }
        }

        if (matchedUrls.length > 0) {
          rowData[c] = Array.from(new Set(matchedUrls)).join(',');
        }
      }

      const saved = existingRowsById[koboId];
      if (saved) {
        // Isi nilai kosong dari Kobo (misalnya tanggal pelaksanaan) tanpa
        // menghapus data Sheet apabila Kobo memang tidak memiliki nilai.
        const merged = rowData.map(function (value, index) {
          return value === '' && saved.values[index] !== '' && saved.values[index] != null ? saved.values[index] : value;
        });
        updatedRows.push({ rowNumber: saved.rowNumber, values: merged });
      } else {
        allNewRows.push(rowData);
      }
      successCount++;

      if ((i + 1) % 10 === 0) {
        Logger.log(`  ✓ ${i + 1}/${dataYangAkanDiproses.length} baris diproses...`);
      }
    } catch (err) {
      failCount++;
      Logger.log(`❌ Error baris ${i}: ${err.message}`);
    }
  }

  updatedRows.forEach(function (item) {
    sheet.getRange(item.rowNumber, 1, 1, item.values.length).setValues([item.values]);
  });
  if (allNewRows.length > 0) {
    try {
      const nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, allNewRows.length, allNewRows[0].length).setValues(allNewRows);
      Logger.log(`\n✅ SELESAI! ${successCount} baris berhasil ditambahkan`);
      if (failCount > 0) {
        Logger.log(`⚠️ ${failCount} baris gagal diproses`);
      }
    } catch (err) {
      Logger.log(`❌ Error menulis ke sheet: ${err.message}`);
    }
  } else {
    Logger.log('⚠️ Tidak ada data baru untuk ditulis');
  }
}

// === FUNGSI UTILITY UNTUK DEBUGGING & MAINTENANCE ===

// Tampilkan statistik data
function tampilkanStatistikData() {
  const sheet = getSaggdKoboSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const dataRows = lastRow - 1;
  
  Logger.log("\n========== STATISTIK DATA SAGGD ==========");
  Logger.log(`Total baris data: ${dataRows}`);
  Logger.log(`Total kolom: ${lastCol}`);
  Logger.log(`\nNama kolom:`);
  headers.forEach((h, idx) => Logger.log(`  ${idx + 1}. ${h}`));
  
  // Hitung berdasarkan bulan jika ada kolom _submission_time
  const idxTime = headers.indexOf('_submission_time');
  if (idxTime > -1 && lastRow > 1) {
    const times = sheet.getRange(2, idxTime + 1, dataRows, 1).getValues().flat();
    const monthCount = {};
    times.forEach(t => {
      if (t) {
        const date = new Date(t);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthCount[month] = (monthCount[month] || 0) + 1;
      }
    });
    Logger.log(`\n📊 Data per bulan:`);
    Object.keys(monthCount).sort().forEach(m => Logger.log(`  ${m}: ${monthCount[m]} baris`));
  }
  
  Logger.log("=========================================\n");
}

// Ambil status koneksi Kobo dengan detail debugging
function cekKoneksiKobo() {
  Logger.log("\n🔍 Mengecek koneksi Kobo...\n");
  
  const config = SAGGD_KOBO_CONFIG;
  const options = {
    method: 'get',
    headers: { Authorization: 'Token ' + config.token },
    muteHttpExceptions: true
  };
  
  try {
    // Test 1: Asset info
    Logger.log("TEST 1: Mengambil info asset form...");
    const assetInfoUrl = `${config.baseUrl}/api/v2/assets/${config.assetUid}/`;
    Logger.log(`  URL: ${assetInfoUrl}`);
    
    const assetResponse = UrlFetchApp.fetch(assetInfoUrl, options);
    const assetCode = assetResponse.getResponseCode();
    Logger.log(`  Response Code: ${assetCode}`);
    
    if (assetCode !== 200) {
      Logger.log(`  ❌ Error: ${assetResponse.getContentText().substring(0, 200)}`);
      return;
    }
    
    const assetData = JSON.parse(assetResponse.getContentText());
    
    Logger.log(`✅ Koneksi OK`);
    Logger.log(`📋 Form Name: ${assetData.name || 'Unknown'}`);
    Logger.log(`📊 Total submissions: ${assetData.deployment__submission_count || 'Unknown'}`);
    Logger.log(`🔑 Asset UID: ${config.assetUid}`);
    Logger.log(`📍 Base URL: ${config.baseUrl}`);
    
    // Test 2: Data API tanpa parameter
    Logger.log("\nTEST 2: Mengambil data tanpa parameter...");
    const dataUrlSimple = `${config.baseUrl}/api/v2/assets/${config.assetUid}/data.json`;
    Logger.log(`  URL: ${dataUrlSimple}`);
    
    const dataResponseSimple = UrlFetchApp.fetch(dataUrlSimple, options);
    const dataCodeSimple = dataResponseSimple.getResponseCode();
    Logger.log(`  Response Code: ${dataCodeSimple}`);
    
    if (dataCodeSimple === 200) {
      const data = JSON.parse(dataResponseSimple.getContentText());
      Logger.log(`✅ Data API OK - Total results: ${(data.results || []).length}`);
      if (data.results && data.results[0]) {
        Logger.log(`  Latest submission ID: ${data.results[0]._id}`);
      }
    } else {
      Logger.log(`  ❌ Error: ${dataResponseSimple.getContentText().substring(0, 200)}`);
    }
    
    // Test 3: Data API dengan limit/offset
    Logger.log("\nTEST 3: Mengambil data dengan limit=100&offset=0...");
    const dataUrlWithParams = `${config.baseUrl}/api/v2/assets/${config.assetUid}/data.json?limit=100&offset=0`;
    Logger.log(`  URL: ${dataUrlWithParams}`);
    
    const dataResponseParams = UrlFetchApp.fetch(dataUrlWithParams, options);
    const dataCodeParams = dataResponseParams.getResponseCode();
    Logger.log(`  Response Code: ${dataCodeParams}`);
    
    if (dataCodeParams === 200) {
      const data = JSON.parse(dataResponseParams.getContentText());
      Logger.log(`✅ Pagination OK - Total results: ${(data.results || []).length}`);
    } else {
      Logger.log(`  ❌ Error: ${dataResponseParams.getContentText().substring(0, 300)}`);
    }
    
  } catch (err) {
    Logger.log(`❌ Error: ${err.message}`);
  }
  
  Logger.log("");
}

// Reset - hapus semua data (kecuali header)
function resetDataSaggd() {
  const sheet = getSaggdKoboSheet_();
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
    Logger.log("✓ Data berhasil direset (header tetap ada)");
  } else {
    Logger.log("ℹ️ Tidak ada data untuk direset");
  }
}

// Test pagination - ambil jumlah data yang ada di Kobo
function testPaginasiKobo() {
  Logger.log("\n🔄 Test Pagination Kobo\n");
  
  const config = SAGGD_KOBO_CONFIG;
  const options = {
    "method": "get",
    "headers": { "Authorization": "Token " + config.token },
    "muteHttpExceptions": true
  };
  
  let offset = 0;
  let limit = 100;
  let totalCount = 0;
  
  while (true) {
    const url = `${config.baseUrl}/api/v2/assets/${config.assetUid}/data.json?limit=${limit}&offset=${offset}`;
    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() !== 200) {
      Logger.log(`Error: HTTP ${response.getResponseCode()}`);
      break;
    }
    
    const data = JSON.parse(response.getContentText());
    const count = data.results ? data.results.length : 0;
    
    if (count === 0) {
      Logger.log(`Halaman ${Math.floor(offset/limit)+1}: Selesai (total: ${totalCount})`);
      break;
    }
    
    totalCount += count;
    Logger.log(`Halaman ${Math.floor(offset/limit)+1}: ${count} items, Total: ${totalCount}`);
    
    offset += limit;
    Utilities.sleep(300);
  }
  
  Logger.log(`\n✅ Total data di Kobo: ${totalCount}\n`);
}

// Bandingkan data: Kobo vs Sheet
function bandingkanDataKoboVsSheet() {
  Logger.log("\n📊 Perbandingan Kobo vs Sheet\n");
  
  const config = SAGGD_KOBO_CONFIG;
  const options = {
    "method": "get",
    "headers": { "Authorization": "Token " + config.token },
    "muteHttpExceptions": true
  };
  
  // Ambil dari Kobo
  let koboIds = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const url = `${config.baseUrl}/api/v2/assets/${config.assetUid}/data.json?limit=${limit}&offset=${offset}&fields=_id`;
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    const results = data.results || [];
    
    if (results.length === 0) break;
    
    koboIds = koboIds.concat(results.map(r => String(r._id)));
    offset += limit;
    Utilities.sleep(300);
  }
  
  // Ambil dari Sheet
  const sheet = getSaggdKoboSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idIndex = headers.indexOf('_id');
  
  let sheetIds = [];
  if (idIndex > -1 && sheet.getLastRow() > 1) {
    sheetIds = sheet.getRange(2, idIndex + 1, sheet.getLastRow() - 1, 1).getValues().flat().map(String);
  }
  
  // Perbandingan
  const missing = koboIds.filter(id => !sheetIds.includes(id));
  const extra = sheetIds.filter(id => !koboIds.includes(id));
  
  Logger.log(`Kobo Total: ${koboIds.length}`);
  Logger.log(`Sheet Total: ${sheetIds.length}`);
  Logger.log(`\nTertinggal di Sheet: ${missing.length}`);
  if (missing.length > 0 && missing.length <= 20) {
    missing.forEach(id => Logger.log(`  - ${id}`));
  } else if (missing.length > 20) {
    Logger.log(`  (${missing.length} IDs, terlalu banyak untuk ditampilkan)`);
  }
  
  Logger.log(`\nExtra di Sheet (tidak ada di Kobo): ${extra.length}`);
  if (extra.length > 0 && extra.length <= 10) {
    extra.forEach(id => Logger.log(`  - ${id}`));
  }
  
  Logger.log("\n✅ Perbandingan selesai\n");
}
