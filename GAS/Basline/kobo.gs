function tarikDataKoboOtomatis() {

  // === 1. KONFIGURASI UTAMA ===
  const KOBO_TOKEN = PropertiesService.getScriptProperties().getProperty("KOBO_TOKEN");
  if (!KOBO_TOKEN) throw new Error("KOBO_TOKEN belum diatur di Script Properties.");
  const ASSET_UID = "aU3j8JYdHg3wuSYiiac2qq";
  const DRIVE_FOLDER_ID = "1IgHc3jikKSTcFeesluomKTWv5inrdkQ1";
  const KOBO_BASE_URL = "https://kf.kobotoolbox.org"; 
  const TARGET_SHEET_NAME = "Baseline";

  // === 1A. KONFIGURASI NAMA KOLOM ===
  const HEADER_NAMA_KEGIATAN = "Nama Kegiatan"; 
  const HEADER_FOTO_ABSENSI = "Foto Absensi"; 
  const HEADER_FOTO_KEGIATAN = "Foto Kegiatan"; 
  const MAX_DATA_PER_RUN = 10;

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Spreadsheet aktif tidak ditemukan.");
  const sheet = spreadsheet.getSheetByName(TARGET_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet ${TARGET_SHEET_NAME} tidak ditemukan.`);
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
  let labelCandidates = {};
  const normalizeLabel = value => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const normalizedSubmissionKeys = {};
  const registerSubmissionKey = key => {
    [key, String(key).split('/').pop()].forEach(name => {
      const normalizedKey = normalizeLabel(name);
      if (!normalizedSubmissionKeys[normalizedKey]) normalizedSubmissionKeys[normalizedKey] = [];
      if (!normalizedSubmissionKeys[normalizedKey].includes(key)) normalizedSubmissionKeys[normalizedKey].push(key);
    });
  };
  const registerQuestion = q => {
    if (!q || !q.name) return;
    let label = Array.isArray(q.label) ? q.label[0] : (q.label || q.name);
    label = String(label).replace(/\r?\n|\r/g, " ").trim();
    labelMap[q.name] = label;
    reverseLabelMap[label] = q.name;
    const normalized = normalizeLabel(label);
    if (!labelCandidates[normalized]) labelCandidates[normalized] = [];
    if (!labelCandidates[normalized].includes(q.name)) labelCandidates[normalized].push(q.name);
    const normalizedName = normalizeLabel(q.name);
    if (!labelCandidates[normalizedName]) labelCandidates[normalizedName] = [];
    if (!labelCandidates[normalizedName].includes(q.name)) labelCandidates[normalizedName].push(q.name);
  };
  const walkSurvey = questions => (questions || []).forEach(q => {
    registerQuestion(q);
    if (q && Array.isArray(q.children)) walkSurvey(q.children);
  });

  if (assetResponse.getResponseCode() === 200) {
    const assetData = JSON.parse(assetResponse.getContentText());
    if (assetData.content && assetData.content.survey) {
      walkSurvey(assetData.content.survey);
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

  const normalizedChoiceMap = {};
  Object.keys(choiceMap).forEach(key => {
    normalizedChoiceMap[normalizeLabel(key)] = choiceMap[key];
  });
  const getChoiceLabel = value => choiceMap[value] || normalizedChoiceMap[normalizeLabel(value)];
  const formatChoiceValue = value => {
    const text = String(value == null ? "" : value).trim();
    if (!text) return text;
    const exactLabel = getChoiceLabel(text);
    if (exactLabel) return exactLabel;
    const items = text.includes(",") ? text.split(",") : text.split(/\s+/);
    if (items.length > 1 && items.every(item => getChoiceLabel(item.trim()))) {
      return items.map(item => item.trim() + " " + getChoiceLabel(item.trim())).join(", ");
    }
    return text;
  };

  // === 3. AMBIL DATA SUBMISSION ===
  const apiUrl = `${KOBO_BASE_URL}/api/v2/assets/${ASSET_UID}/data.json`;
  let submissions = [];
  let nextUrl = apiUrl;
  while (nextUrl) {
    const response = UrlFetchApp.fetch(nextUrl, options);
    if (response.getResponseCode() !== 200) throw new Error(`Gagal mengambil data Kobo: HTTP ${response.getResponseCode()}`);
    const page = JSON.parse(response.getContentText());
    submissions = submissions.concat(page.results || []);
    nextUrl = page.next || '';
  }
  if (!submissions || submissions.length === 0) return;

  // === 4. SIAPKAN HEADER ===
  let allColumns = new Set();
  submissions.forEach(sub => {
    Object.keys(sub).forEach(key => {
      if (key !== "_attachments" && !/^_?2[_\s.-]*kabupaten/i.test(String(key).split('/').pop())) allColumns.add(key);
    });
  });
  
  let internalHeaders = Array.from(allColumns);
  let sheetHeaders = [];
  
  if (sheet.getLastRow() === 0) {
    sheetHeaders = internalHeaders.map(h => labelMap[h] || h);
    sheet.appendRow(sheetHeaders);
  } else {
    sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const districtColumns = sheetHeaders.map((header, index) => ({ header: String(header || ''), index }))
      .filter(item => /^2\s*\.??\s*kabupaten/i.test(item.header.trim()) || /^_?2[_\s.-]*kabupaten/i.test(item.header.trim()));
    if (districtColumns.length > 0) {
      const keepIndex = districtColumns[0].index;
      const values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), sheet.getLastColumn()).getValues();
      districtColumns.slice(1).forEach(item => {
        values.forEach(row => {
          if ((row[keepIndex] === '' || row[keepIndex] == null) && row[item.index] !== '' && row[item.index] != null) row[keepIndex] = row[item.index];
        });
      });
      if (values.length > 0) sheet.getRange(2, 1, values.length, sheet.getLastColumn()).setValues(values);
      sheet.getRange(1, keepIndex + 1).setValue('2. Kabupaten');
      districtColumns.slice(1).map(item => item.index).sort((a, b) => b - a).forEach(index => sheet.deleteColumn(index + 1));
      sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      Logger.log(`Kolom kabupaten bercabang digabung menjadi satu kolom: ${districtColumns.length} kolom diproses.`);
    }
    const canonicalQuestion = value => normalizeLabel(String(value).split('/').pop()).replace(/^\d+/, '');
    const headerMatchesInternal = (sheetHeader, internalHeader) => {
      const label = labelMap[internalHeader] || internalHeader;
      const internalQuestion = canonicalQuestion(internalHeader);
      const sheetQuestion = canonicalQuestion(sheetHeader);
      return internalQuestion === sheetQuestion ||
        (internalQuestion.length >= 16 && (sheetQuestion.indexOf(internalQuestion) === 0 || internalQuestion.indexOf(sheetQuestion) === 0));
    };
    const missingHeaders = internalHeaders.filter(internalHeader => {
      return !sheetHeaders.some(sheetHeader => headerMatchesInternal(sheetHeader, internalHeader));
    });
    if (missingHeaders.length > 0) {
      const firstNewColumn = sheetHeaders.length + 1;
      const newHeaders = missingHeaders.map(internalHeader => labelMap[internalHeader] || internalHeader);
      sheet.getRange(1, firstNewColumn, 1, newHeaders.length).setValues([newHeaders]);
      sheetHeaders = sheetHeaders.concat(newHeaders);
      Logger.log(`Sheet Baseline diperbarui: ${missingHeaders.length} kolom Kobo baru ditambahkan.`);
    }
  }

  // === 5. CEK DUPLIKAT DATA ===
  let existingIds = [];
  const lastRow = sheet.getLastRow();
  const idIndex = sheetHeaders.indexOf('_id');

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const findHeaderIndexes = patterns => sheetHeaders.reduce((indexes, header, index) => {
    const normalizedHeader = normalizeLabel(header);
    if (patterns.some(pattern => normalizedHeader.includes(normalizeLabel(pattern)))) indexes.push(index);
    return indexes;
  }, []);
  const activityIndexes = findHeaderIndexes([HEADER_NAMA_KEGIATAN, "nama kegiatan", "kegiatan"]);
  const attendancePhotoIndexes = findHeaderIndexes([HEADER_FOTO_ABSENSI, "foto absensi"]);
  const activityPhotoIndexes = findHeaderIndexes([HEADER_FOTO_KEGIATAN, "foto kegiatan", "foto bersama responden"]);

  // === FILTER DATA BARU DAN DATA LAMA YANG MASIH BELUM LENGKAP ===
  submissions.forEach(submission => Object.keys(submission).forEach(registerSubmissionKey));
  const resolveSubmissionKey = (sub, sheetHeader) => {
    const normalizedHeader = normalizeLabel(sheetHeader);
    const candidates = [sheetHeader, reverseLabelMap[sheetHeader], ...(labelCandidates[normalizedHeader] || []), ...(normalizedSubmissionKeys[normalizedHeader] || [])].filter(Boolean);
    const canonicalHeader = normalizeLabel(String(sheetHeader).split('/').pop()).replace(/^\d+/, '');
    const canonicalMatches = Object.keys(sub).filter(key => {
      const canonicalKey = normalizeLabel(String(key).split('/').pop()).replace(/^\d+/, '');
      return canonicalKey.length >= 16 && (canonicalKey.indexOf(canonicalHeader) === 0 || canonicalHeader.indexOf(canonicalKey) === 0);
    });
    const matches = candidates.concat(candidates.flatMap(candidate => normalizedSubmissionKeys[normalizeLabel(candidate)] || []), canonicalMatches)
      .filter((key, index, values) => values.indexOf(key) === index && Object.prototype.hasOwnProperty.call(sub, key));
    return matches.find(key => sub[key] !== '' && sub[key] !== null && sub[key] !== undefined) || matches[0];
  };
  const farmerNameIndex = sheetHeaders.findIndex(header => {
    const normalizedHeader = normalizeLabel(header);
    return normalizedHeader.includes('41namalengkap') || normalizedHeader.includes('namalengkap');
  });
  const normalizeIdentityPart = value => normalizeLabel(value);
  const submissionIdentity = submission => {
    const farmerKey = resolveSubmissionKey(submission, farmerNameIndex >= 0 ? sheetHeaders[farmerNameIndex] : '');
    return `${String(submission._id || '').trim()}::${normalizeIdentityPart(farmerKey === undefined ? '' : submission[farmerKey])}`;
  };
  const savedRowIdentity = row => `${String(idIndex >= 0 ? row[idIndex] || '' : '').trim()}::${normalizeIdentityPart(farmerNameIndex >= 0 ? row[farmerNameIndex] || '' : '')}`;
  const existingRows = {};
  if (lastRow > 1 && sheetHeaders.length > 0) {
    const savedRows = sheet.getRange(2, 1, lastRow - 1, sheetHeaders.length).getValues();
    savedRows.forEach((row, index) => {
      const identity = savedRowIdentity(row);
      if (identity !== '::') existingRows[identity] = { rowNumber: index + 2, values: row };
    });
    existingIds = Object.keys(existingRows);
  }
  const repairFieldCounts = {};
  const repairReasons = { missing: {}, staleChoice: {} };
  const needsRepair = submission => {
    const saved = existingRows[submissionIdentity(submission)];
    if (!saved) return false;
    return sheetHeaders.some((header, index) => {
      const key = resolveSubmissionKey(submission, header);
      const value = key === undefined ? '' : submission[key];
      const convertedValue = formatChoiceValue(value);
      const missing = value !== '' && value !== null && value !== undefined && (saved.values[index] === '' || saved.values[index] === null);
      const staleChoice = convertedValue !== String(value) && String(saved.values[index]) === String(value);
      if (missing) {
        repairFieldCounts[header] = (repairFieldCounts[header] || 0) + 1;
        repairReasons.missing[header] = (repairReasons.missing[header] || 0) + 1;
      }
      if (staleChoice) {
        repairFieldCounts[header] = (repairFieldCounts[header] || 0) + 1;
        repairReasons.staleChoice[header] = (repairReasons.staleChoice[header] || 0) + 1;
      }
      return missing || staleChoice;
    });
  };
  const dataBaru = submissions.filter(sub => !existingIds.includes(submissionIdentity(sub)));
  const dataPerluDiperbaiki = submissions.filter(needsRepair);
  const dataYangAkanDiproses = dataBaru.concat(dataPerluDiperbaiki).slice(0, MAX_DATA_PER_RUN);
  Logger.log(`Kobo: ${submissions.length} submission, ${dataBaru.length} data baru, ${dataPerluDiperbaiki.length} data lama belum lengkap, ${dataYangAkanDiproses.length} diproses pada batch ini.`);
  const formatRepairLog = (label, values) => {
    const entries = Object.keys(values).map(header => `${header} (${values[header]} sel)`).slice(0, 15);
    return `${label}: ${entries.join(', ') || 'tidak ada'}.`;
  };
  Logger.log(formatRepairLog('Sel kosong diisi ulang', repairReasons.missing));
  Logger.log(formatRepairLog('Nilai lama dinormalisasi', repairReasons.staleChoice));
  let allNewRows = []; 
  let repairedRows = [];

  // === 6. PROSES BARIS DATA ===
  for (let i = 0; i < dataYangAkanDiproses.length; i++) {
    const sub = dataYangAkanDiproses[i];
    const koboId = String(sub._id);

    let rowData = [];
    for (let h = 0; h < sheetHeaders.length; h++) {
      const sheetHeader = sheetHeaders[h];
      const originalColName = resolveSubmissionKey(sub, sheetHeader);
      let val = originalColName === undefined ? undefined : sub[originalColName];
      
      if (val !== undefined && val !== null) {
        if (typeof val === 'string') {
          val = formatChoiceValue(val);
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
    let namaKegiatan = activityIndexes.map(index => rowData[index]).find(value => value !== "" && value != null) || "Kegiatan Tidak Diketahui";
    
    let fileMap = {};

    // === PROSES DOWNLOAD FILE ===
    if (sub._attachments && sub._attachments.length > 0) {
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
          if (attendancePhotoIndexes.some(index => String(rowData[index]).includes(originalFileName))) {
            kategori = "Foto Absensi";
          } else if (activityPhotoIndexes.some(index => String(rowData[index]).includes(originalFileName))) {
            kategori = "Foto Kegiatan";
          }

          let catFolder = getOrCreateFolder(rootFolder, kategori);
          let monthFolder = getOrCreateFolder(catFolder, namaBulan);
          let actFolder = getOrCreateFolder(monthFolder, namaKegiatan);

          let fetchOptions = {
            "method": "get",
            "headers": { "Authorization": "Token " + KOBO_TOKEN },
            "muteHttpExceptions": true,
            "followRedirects": false 
          };
          
          let fileResponse = UrlFetchApp.fetch(downloadUrl, fetchOptions);
          let responseCode = fileResponse.getResponseCode();

          if (responseCode === 301 || responseCode === 302 || responseCode === 307) {
            let redirectUrl = fileResponse.getHeaders()['Location'];
            fileResponse = UrlFetchApp.fetch(redirectUrl, { "muteHttpExceptions": true });
            responseCode = fileResponse.getResponseCode();
          }

          if (responseCode === 200) {
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
            
            Utilities.sleep(1000); 
          }
        } catch (err) {
          Logger.log(`Gagal proses file ${originalFileName}: ${err.message}`);
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

    const saved = existingRows[submissionIdentity(sub)];
    if (saved) {
      repairedRows.push({ rowNumber: saved.rowNumber, values: rowData });
    } else {
      allNewRows.push(rowData);
    }
  }

  // TULIS KE SHEET
  repairedRows.forEach(repaired => sheet.getRange(repaired.rowNumber, 1, 1, repaired.values.length).setValues([repaired.values]));
  if (repairedRows.length > 0) Logger.log(`${repairedRows.length} baris lama berhasil diperbarui.`);
  if (allNewRows.length > 0) {
    const nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, allNewRows.length, allNewRows[0].length).setValues(allNewRows);
  }
}

function setKoboToken(token) {
  if (!token || String(token).trim().length < 20) throw new Error("Token Kobo tidak valid.");
  PropertiesService.getScriptProperties().setProperty("KOBO_TOKEN", String(token).trim());
}

function testAuth() {
  Logger.log("Akses aktif: " + DriveApp.getRootFolder().getName());
}

function lihatHeaderKobo() {
  const KOBO_TOKEN = PropertiesService.getScriptProperties().getProperty("KOBO_TOKEN");
  if (!KOBO_TOKEN) throw new Error("KOBO_TOKEN belum diatur di Script Properties.");
  const ASSET_UID = "aU3j8JYdHg3wuSYiiac2qq";
  const KOBO_BASE_URL = "https://kf.kobotoolbox.org";
  const options = {
    method: "get",
    headers: { Authorization: "Token " + KOBO_TOKEN },
    muteHttpExceptions: true
  };
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Spreadsheet aktif tidak ditemukan. Jalankan script dari Google Sheet yang benar.");
  let headerSheet = spreadsheet.getSheets().find(sheet => sheet.getName().trim().toLowerCase() === "header");
  if (!headerSheet) headerSheet = spreadsheet.insertSheet("header");
  const assetResponse = UrlFetchApp.fetch(`${KOBO_BASE_URL}/api/v2/assets/${ASSET_UID}/`, options);
  const dataResponse = UrlFetchApp.fetch(`${KOBO_BASE_URL}/api/v2/assets/${ASSET_UID}/data.json`, options);
  if (assetResponse.getResponseCode() !== 200 || dataResponse.getResponseCode() !== 200) {
    throw new Error(`Gagal mengambil struktur Kobo. Asset: ${assetResponse.getResponseCode()}, Data: ${dataResponse.getResponseCode()}`);
  }

  const assetData = JSON.parse(assetResponse.getContentText());
  const submissionData = JSON.parse(dataResponse.getContentText());
  const submissions = submissionData.results || [];
  const labels = {};
  const visitSurvey = questions => (questions || []).forEach(question => {
    if (question.name) {
      const label = Array.isArray(question.label) ? question.label[0] : (question.label || question.name);
      labels[question.name] = String(label).replace(/\r?\n|\r/g, " ").trim();
    }
    if (Array.isArray(question.children)) visitSurvey(question.children);
  });
  visitSurvey(assetData.content?.survey);

  const fieldNames = new Set();
  submissions.forEach(submission => Object.keys(submission).forEach(field => field !== "_attachments" && fieldNames.add(field)));
  const fields = Array.from(fieldNames);
  if (fields.length === 0) throw new Error("Tidak ada nama field pada data submission Kobo.");
  const labelsRow = fields.map(field => labels[field] || field);
  const samplesRow = fields.map(field => {
    const sample = submissions.find(submission => submission[field] !== undefined && submission[field] !== null);
    let sampleValue = sample ? sample[field] : "";
    if (typeof sampleValue === "object") sampleValue = JSON.stringify(sampleValue);
    return String(sampleValue || "");
  });
  const rows = [fields, labelsRow, samplesRow];

  headerSheet.clearContents();
  headerSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  headerSheet.setFrozenRows(1);
  if (fields.length > 0) headerSheet.autoResizeColumns(1, fields.length);
  Logger.log(`Header Kobo berhasil ditulis mendatar ke sheet header: ${fields.length} field.`);
}
