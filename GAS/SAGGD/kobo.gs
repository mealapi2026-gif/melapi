var SAGGD_KOBO_CONFIG = {
  token: '2314bc793b14bb76cc7ee2ae1eab1a750d557a97',
  assetUid: 'a7vNjseoAicBntatMQVdfC',
  sheetName: 'SAGGD',
  headerSheetName: 'SAGGD_Header_Kobo',
  // Folder utama Dokumen SAGGD.
  driveFolderId: '1_gapfewLlFqIwu3rEKaD3eWGW0kKmt7p',
  baseUrl: 'https://kf.kobotoolbox.org'
};

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

// Fungsi untuk ambil semua data dari Kobo dengan pagination
function ambilSemuaDataKoboDenganPaginasi_(baseUrl, assetUid, token) {
  const options = {
    "method": "get",
    "headers": { "Authorization": "Token " + token },
    "muteHttpExceptions": true
  };
  
  let allSubmissions = [];
  let limit = 100; // Ambil 100 per halaman
  let offset = 0;
  let hasMore = true;

  Logger.log(`🔄 Mulai pengambilan data dari Kobo (pagination dengan limit ${limit})...`);
  
  while (hasMore) {
    try {
      const apiUrl = `${baseUrl}/api/v2/assets/${assetUid}/data.json?limit=${limit}&offset=${offset}&sort=-_id`;
      const response = UrlFetchApp.fetch(apiUrl, options);
      
      if (response.getResponseCode() !== 200) {
        Logger.log(`⚠️ Error HTTP ${response.getResponseCode()} pada offset ${offset}`);
        break;
      }
      
      const data = JSON.parse(response.getContentText());
      const submissions = data.results || [];
      
      if (submissions.length === 0) {
        hasMore = false;
        break;
      }

      allSubmissions = allSubmissions.concat(submissions);
      Logger.log(`✓ Halaman ${Math.floor(offset/limit)+1}: ${submissions.length} submission, Total: ${allSubmissions.length}`);
      
      offset += limit;
      Utilities.sleep(500); // Rate limiting
      
    } catch (err) {
      Logger.log(`❌ Error pagination: ${err.message}`);
      break;
    }
  }

  Logger.log(`✅ Total data diambil: ${allSubmissions.length}`);
  return allSubmissions;
}

function tarikDataKoboOtomatis() {

  // === 1. KONFIGURASI UTAMA ===
  const KOBO_TOKEN = SAGGD_KOBO_CONFIG.token;
  const ASSET_UID = SAGGD_KOBO_CONFIG.assetUid;
  const DRIVE_FOLDER_ID = SAGGD_KOBO_CONFIG.driveFolderId;
  const KOBO_BASE_URL = SAGGD_KOBO_CONFIG.baseUrl;

  // === 1A. KONFIGURASI NAMA KOLOM ===
  const HEADER_NAMA_KEGIATAN = "Nama Kegiatan"; 
  const HEADER_FOTO_ABSENSI = "Foto Absensi"; 
  const HEADER_FOTO_KEGIATAN = "Foto Kegiatan"; 

  const sheet = getSaggdKoboSheet_();
  const rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  
  const options = {
    "method": "get",
    "headers": { "Authorization": "Token " + KOBO_TOKEN },
    "muteHttpExceptions": true
  };

  let folderCache = {};
  
  function getOrCreateFolder(parentFolder, folderName) {
    folderName = folderName.replace(/[\/\?<>\\:\*\|":]/g, "_").trim();
    if (!folderName) folderName = "Tanpa Nama";
    
    let cacheKey = parentFolder.getId() + "_" + folderName;
    if (folderCache[cacheKey]) return DriveApp.getFolderById(folderCache[cacheKey]);
    
    let folders = parentFolder.getFoldersByName(folderName);
    let folder = folders.hasNext() ? folders.next() : parentFolder.createFolder(folderName);
    folderCache[cacheKey] = folder.getId();
    
    return folder;
  }

  // === 2. AMBIL KAMUS FORM ===
  const assetInfoUrl = `${KOBO_BASE_URL}/api/v2/assets/${ASSET_UID}/`;
  const assetResponse = UrlFetchApp.fetch(assetInfoUrl, options);
  let labelMap = {}; 
  let reverseLabelMap = {}; 
  let choiceMap = {}; 

  if (assetResponse.getResponseCode() === 200) {
    const assetData = JSON.parse(assetResponse.getContentText());
    if (assetData.content && assetData.content.survey) {
      assetData.content.survey.forEach(q => {
        if (q.name) {
          let label = Array.isArray(q.label) ? q.label[0] : (q.label || q.name);
          label = label.replace(/\r?\n|\r/g, " ").trim(); 
          labelMap[q.name] = label;
          reverseLabelMap[label] = q.name;
        }
      });
    }
    if (assetData.content && assetData.content.choices) {
      assetData.content.choices.forEach(c => {
        if (c.name) {
          let label = Array.isArray(c.label) ? c.label[0] : (c.label || c.name);
          choiceMap[c.name] = label;
        }
      });
    }
  }

  // === 3. AMBIL SEMUA DATA SUBMISSION DENGAN PAGINATION ===
  const submissions = ambilSemuaDataKoboDenganPaginasi_(KOBO_BASE_URL, ASSET_UID, KOBO_TOKEN);
  if (!submissions || submissions.length === 0) {
    Logger.log("⚠️ Tidak ada data submission dari Kobo");
    return;
  }

  // === 4. SIAPKAN HEADER ===
  let allColumns = new Set();
  submissions.forEach(sub => {
    Object.keys(sub).forEach(key => { if (key !== "_attachments") allColumns.add(key); });
  });
  
  let internalHeaders = Array.from(allColumns);
  let sheetHeaders = [];
  
  if (sheet.getLastRow() === 0) {
    sheetHeaders = internalHeaders.map(h => labelMap[h] || h);
    sheet.appendRow(sheetHeaders);
    Logger.log(`✓ Header dibuat: ${sheetHeaders.length} kolom`);
  } else {
    sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  // === 5. CEK DUPLIKAT DATA ===
  let existingIds = [];
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const idIndex = sheetHeaders.indexOf('_id');
    if (idIndex > -1) {
      existingIds = sheet.getRange(2, idIndex + 1, lastRow - 1, 1).getValues().flat().map(String);
    }
  }

  Logger.log(`📊 Status: ${lastRow-1} existing rows, ${submissions.length} total in Kobo, ${existingIds.length} existing IDs`);

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const idxKegiatan = sheetHeaders.indexOf(HEADER_NAMA_KEGIATAN);
  const idxAbsen = sheetHeaders.indexOf(HEADER_FOTO_ABSENSI);
  const idxFotoKeg = sheetHeaders.indexOf(HEADER_FOTO_KEGIATAN);

  // === FILTER & AMBIL SEMUA DATA BARU (TIDAK ADA BATASAN 10) ===
  let dataBaru = submissions.filter(sub => !existingIds.includes(String(sub._id)));
  Logger.log(`🆕 Data baru ditemukan: ${dataBaru.length}`);
  
  if (dataBaru.length === 0) {
    Logger.log("✅ Tidak ada data baru untuk diproses");
    return;
  }

  let allNewRows = []; 
  let successCount = 0;
  let failCount = 0; 

  // === 6. PROSES BARIS DATA (SEMUA DATA BARU, TANPA BATASAN) ===
  for (let i = 0; i < dataBaru.length; i++) {
    try {
      const sub = dataBaru[i];
      const koboId = String(sub._id);

      let rowData = [];
      for (let h = 0; h < sheetHeaders.length; h++) {
        const sheetHeader = sheetHeaders[h];
        const originalColName = reverseLabelMap[sheetHeader] || sheetHeader;
        let val = sub[originalColName];
        
        if (val !== undefined && val !== null) {
          if (typeof val === 'string') {
            if (choiceMap[val]) {
              val = choiceMap[val]; 
            } else if (val.includes(" ")) {
              let splitVals = val.split(" ");
              if (splitVals.some(v => choiceMap[v])) {
                val = splitVals.map(v => choiceMap[v] || v).join(", ");
              }
            }
          } else if (typeof val === 'object') {
            val = JSON.stringify(val); 
          }
        } else {
          val = ""; 
        }
        rowData.push(val);
      }

      let submitDate = new Date(sub._submission_time);
      let namaBulan = monthNames[submitDate.getMonth()] + " " + submitDate.getFullYear();
      let namaKegiatan = (idxKegiatan > -1 && rowData[idxKegiatan] !== "") ? String(rowData[idxKegiatan]) : "Kegiatan Tidak Diketahui";
      
      let fileMap = {};

      // === PROSES DOWNLOAD FILE DENGAN RETRY ===
      if (sub._attachments && sub._attachments.length > 0) {
        Logger.log(`  📁 ${koboId}: Download ${sub._attachments.length} file...`);
        
        for (let j = 0; j < sub._attachments.length; j++) {
          const attachment = sub._attachments[j];
          const downloadUrl = attachment.download_url;
          
          // Ambil nama file dan handle URL encoding
          const rawFileName = attachment.filename.split('/').pop(); 
          let originalFileName = rawFileName;
          try { originalFileName = decodeURIComponent(rawFileName); } catch(e) {}
          
          const newFileName = `${koboId}_${originalFileName}`;

          try {
            let kategori = "Lainnya";
            if (idxAbsen > -1 && String(rowData[idxAbsen]).includes(originalFileName)) {
              kategori = "Foto Absensi";
            } else if (idxFotoKeg > -1 && String(rowData[idxFotoKeg]).includes(originalFileName)) {
              kategori = "Foto Kegiatan";
            }

            let catFolder = getOrCreateFolder(rootFolder, kategori);
            let monthFolder = getOrCreateFolder(catFolder, namaBulan);
            let actFolder = getOrCreateFolder(monthFolder, namaKegiatan);

            // Gunakan download dengan retry
            const fileResponse = downloadFileWithRetry_(downloadUrl, KOBO_TOKEN, 3);
            
            if (fileResponse) {
              let fileBlob;
              if (originalFileName.toLowerCase().endsWith('.heic')) {
                const rawData = fileResponse.getContent(); 
                fileBlob = Utilities.newBlob(rawData, "image/heic", newFileName);
              } else {
                fileBlob = fileResponse.getBlob().setName(newFileName);
              }
              
              const file = actFolder.createFile(fileBlob); 
              
              // Simpan URL Google Drive langsung ke map
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

      // === GANTI NAMA FILE DENGAN URL GOOGLE DRIVE ===
      for (let c = 0; c < rowData.length; c++) {
        let cellText = String(rowData[c]);
        
        if (!cellText || cellText === "undefined" || cellText.trim() === "") continue;

        // Pencarian dengan mengabaikan huruf besar/kecil dan karakter khusus
        let cellCompare = cellText.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        for (let fileName in fileMap) {
          let fileCompare = fileName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          
          if (fileCompare.length > 3 && cellCompare.includes(fileCompare)) {
            // Ganti nama file langsung dengan URL Drive
            rowData[c] = fileMap[fileName]; 
            break; 
          }
        }
      }

      allNewRows.push(rowData);
      successCount++;
      
      // Log progress setiap 10 baris
      if ((i + 1) % 10 === 0) {
        Logger.log(`  ✓ ${i + 1}/${dataBaru.length} baris diproses...`);
      }
      
    } catch (err) {
      failCount++;
      Logger.log(`❌ Error baris ${i}: ${err.message}`);
    }
  }

  // === TULIS SEMUA DATA KE SHEET ===
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
    Logger.log("⚠️ Tidak ada data baru untuk ditulis");
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

// Ambil status koneksi Kobo
function cekKoneksiKobo() {
  Logger.log("\n🔍 Mengecek koneksi Kobo...\n");
  
  const config = SAGGD_KOBO_CONFIG;
  const options = {
    method: 'get',
    headers: { Authorization: 'Token ' + config.token },
    muteHttpExceptions: true
  };
  
  try {
    const assetResponse = UrlFetchApp.fetch(config.baseUrl + '/api/v2/assets/' + config.assetUid + '/', options);
    const assetData = JSON.parse(assetResponse.getContentText());
    
    Logger.log(`✅ Koneksi OK`);
    Logger.log(`📋 Form: ${assetData.name || 'Unknown'}`);
    Logger.log(`📊 Total submissions: ${assetData.deployment__submission_count || 'Unknown'}`);
    Logger.log(`🔑 Asset UID: ${config.assetUid}`);
    
    const dataResponse = UrlFetchApp.fetch(config.baseUrl + '/api/v2/assets/' + config.assetUid + '/data.json?limit=1', options);
    const data = JSON.parse(dataResponse.getContentText());
    
    Logger.log(`✅ Data API OK - Latest submission ID: ${data.results && data.results[0] ? data.results[0]._id : 'None'}`);
    
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
