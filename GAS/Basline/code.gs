/** Dashboard Baseline Petani — server-side Google Apps Script. */
var CONFIG = {
  sheetName: 'Baseline',
  spreadsheetId: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || ''
};

//function doGet() {
 // return HtmlService.createTemplateFromFile('index')
   // .evaluate()
    //.setTitle('Dashboard Baseline Petani');
//}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'dashboard';
    var filters = {
      province: params.province || '', commodity: params.commodity || '',
      district: params.district || '', enumerator: params.enumerator || '',
      onlyDuplicates: params.onlyDuplicates === 'true'
    };
    var data;
    if (action === 'options') data = getFilterOptions();
    else if (action === 'dashboard') data = getDashboard(filters);
    else if (action === 'analytics') data = getAnalytics(filters);
    else if (action === 'table') data = getTable(filters, params.page, params.pageSize);
    else if (action === 'detail') data = getSurveyDetail(params.id);
    else if (action === 'map') data = getMapPoints(filters);
    else if (action === 'photo') data = getPhotoData(params.fileId);
    else throw new Error('Parameter action tidak dikenal.');
    return jsonResponse_({ status: 'success', data: data });
  } catch (error) {
    return jsonResponse_({ status: 'error', message: error.message || String(error) });
  }
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// Jalankan sekali dari editor Apps Script jika proyek bukan container-bound.
function setSpreadsheetId(id) {
  if (!id || !/^[a-zA-Z0-9_-]{20,}$/.test(String(id))) throw new Error('Spreadsheet ID tidak valid.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', String(id));
  CONFIG.spreadsheetId = String(id);
}

function getFilterOptions() {
  var dataset = readDataset_();
  return {
    provinces: uniqueValues_(dataset.rows, dataset.columns.province),
    commodities: uniqueValues_(dataset.rows, dataset.columns.commodity, commodityFor_),
    districts: uniqueValues_(dataset.rows, dataset.columns.district),
    enumerators: uniqueValues_(dataset.rows, dataset.columns.enumerator),
    total: dataset.rows.length
  };
}

function getDashboard(filters) {
  var dataset = readDataset_();
  var rows = filterRows_(dataset.rows, dataset.columns, filters || {});
  return {
    total: rows.length,
    kpis: makeKpis_(rows, dataset.columns),
    provinces: countBy_(rows, dataset.columns.province),
    districts: countBy_(rows, dataset.columns.district),
    commodities: countBy_(rows, dataset.columns.commodity, commodityFor_),
    commoditySelections: commoditySelections_(rows, dataset.columns.commodity),
    gender: countBy_(rows, dataset.columns.gender),
    education: countBy_(rows, dataset.columns.education),
    youth: countByFilled_(rows, dataset.columns.youth),
    landStatus: countMultiBy_(rows, dataset.columns.landStatus, /^5\.2\./),
    waterSources: countMultiBy_(rows, dataset.columns.waterSource, /^5\.4\./),
    agroecology: countBy_(rows, dataset.columns.agroecology),
    chemicalReduction: { fertilizer: countBy_(rows, dataset.columns.chemicalFertilizer), pesticide: countBy_(rows, dataset.columns.chemicalPesticide) },
    organicInputs: countMultiBy_(rows, dataset.columns.organicInput, /^7\.3\./),
    financial: financialByCommodity_(rows, dataset.columns),
    salesChannels: countBy_(rows, dataset.columns.salesChannel),
    cooperativeSupport: countMultiBy_(rows, dataset.columns.cooperativeSupport, /^8\.9\./),
    governmentSupport: countMultiBy_(rows, dataset.columns.governmentSupport, /^8\.10\./),
    risks: countMultiBy_(rows, dataset.columns.risks, /^9\.2\./),
    certification: countBy_(rows, dataset.columns.certification)
  };
}

// Ringkasan analitik untuk dashboard Next.js: tren, statistik deskriptif,
// kualitas data, dan insight otomatis berdasarkan filter yang aktif.
function getAnalytics(filters) {
  var dataset = readDataset_();
  var cols = dataset.columns;
  var rows = filterRows_(dataset.rows, cols, filters || {});
  var trend = {};
  rows.forEach(function (row) {
    var value = valueFor_(row, cols.surveyDate);
    var date = Object.prototype.toString.call(value) === '[object Date]' ? value : new Date(value);
    if (isNaN(date.getTime())) return;
    var month = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM');
    trend[month] = (trend[month] || 0) + 1;
  });
  var trends = Object.keys(trend).sort().map(function (month) { return { month: month, responses: trend[month] }; });
  var land = numbers_(rows, cols.landArea);
  var yieldKg = numbers_(rows, cols.yieldKg);
  var missingCoordinates = rows.filter(function (row) { return !parseLocation_(valueFor_(row, cols.geolocation)); }).length;
  var missingIdentity = rows.filter(function (row) {
    return !valueFor_(row, cols.farmerName) || !valueFor_(row, cols.province) || !valueFor_(row, cols.commodity);
  }).length;
  var commodity = countBy_(rows, cols.commodity, commodityFor_);
  var validEconomics = rows.filter(function (row) {
    var cost = Number(valueFor_(row, cols.cost)), income = Number(valueFor_(row, cols.income));
    return isFinite(cost) && cost >= 0 && isFinite(income) && income >= 0;
  }).length;
  var certified = rows.filter(function (row) { return /ya|aktif/i.test(String(valueFor_(row, cols.certification))); }).length;
  var leadingCommodity = commodity.length ? commodity[0].label : 'Belum tersedia';
  var insights = [
    'Komoditas dengan respons terbanyak: ' + leadingCommodity + '.',
    trends.length > 1 ? 'Data mencakup ' + trends.length + ' periode bulan pencatatan.' : 'Belum cukup periode untuk membentuk tren waktu.',
    missingCoordinates ? missingCoordinates + ' respons belum memiliki koordinat valid.' : 'Seluruh respons memiliki koordinat yang valid.'
  ];
  return {
    trends: trends,
    statistics: { landArea: descriptiveStats_(land), yieldKg: descriptiveStats_(yieldKg) },
    productivity: productivityByCommodity_(rows, cols),
    economics: economicsByCommodity_(rows, cols),
    outliers: productivityOutliers_(rows, cols),
    agroecology: {
      stage: countBy_(rows, cols.agroecology),
      organicInputs: countMultiBy_(rows, cols.organicInput, /^7\.3\./),
      chemicalFertilizer: countBy_(rows, cols.chemicalFertilizer),
      chemicalPesticide: countBy_(rows, cols.chemicalPesticide)
    },
    market: { salesChannels: countBy_(rows, cols.salesChannel), certification: countBy_(rows, cols.certification) },
    support: { cooperative: countMultiBy_(rows, cols.cooperativeSupport, /^8\.9\./), government: countMultiBy_(rows, cols.governmentSupport, /^8\.10\./) },
    financialLiteracy: financialLiteracy_(rows, cols),
    risks: countMultiBy_(rows, cols.risks, /^9\.2\./),
    monitoring: {
      provinces: countBy_(rows, cols.province), districts: countBy_(rows, cols.district),
      commodities: commodity, gender: countBy_(rows, cols.gender), education: countBy_(rows, cols.education), youth: countBy_(rows, cols.youth),
      landStatus: countMultiBy_(rows, cols.landStatus, /^5\.2\./), waterSources: countMultiBy_(rows, cols.waterSource, /^5\.4\./)
    },
    quality: {
      uniqueResponses: rows.length, duplicateResponses: dataset.allRows.length - dataset.rows.length,
      missingCoordinates: missingCoordinates, missingIdentity: missingIdentity, validEconomics: validEconomics,
      coordinateCoverage: rows.length ? ((rows.length - missingCoordinates) / rows.length) * 100 : 0,
      certificationRate: rows.length ? (certified / rows.length) * 100 : 0,
      economicCoverage: rows.length ? (validEconomics / rows.length) * 100 : 0
    },
    insights: insights
  };
}

function productivityByCommodity_(rows, cols) {
  var groups = {};
  rows.forEach(function (row) {
    var commodity = commodityFor_(valueFor_(row, cols.commodity));
    var areaM2 = Number(valueFor_(row, cols.landArea));
    var yieldKg = Number(valueFor_(row, cols.yieldKg));
    if (!isFinite(areaM2) || areaM2 <= 0 || !isFinite(yieldKg) || yieldKg < 0 || commodity.indexOf('validasi') > -1 || commodity.indexOf('Multi-') === 0) return;
    if (!groups[commodity]) groups[commodity] = { yieldKg: [], yieldPerHa: [], areaHa: [] };
    groups[commodity].yieldKg.push(yieldKg);
    groups[commodity].yieldPerHa.push(yieldKg / (areaM2 / 10000));
    groups[commodity].areaHa.push(areaM2 / 10000);
  });
  return Object.keys(groups).sort().map(function (label) {
    return { commodity: label, yieldKg: descriptiveStats_(groups[label].yieldKg), yieldPerHa: descriptiveStats_(groups[label].yieldPerHa), areaHa: descriptiveStats_(groups[label].areaHa) };
  });
}

function economicsByCommodity_(rows, cols) {
  var groups = {};
  rows.forEach(function (row) {
    var commodity = commodityFor_(valueFor_(row, cols.commodity));
    var cost = Number(valueFor_(row, cols.cost));
    var income = Number(valueFor_(row, cols.income));
    if (!isFinite(cost) || cost < 0 || !isFinite(income) || income < 0 || commodity.indexOf('validasi') > -1 || commodity.indexOf('Multi-') === 0) return;
    if (!groups[commodity]) groups[commodity] = { cost: [], income: [], margin: [], roi: [] };
    groups[commodity].cost.push(cost);
    groups[commodity].income.push(income);
    groups[commodity].margin.push(income - cost);
    if (cost > 0) groups[commodity].roi.push(((income - cost) / cost) * 100);
  });
  return Object.keys(groups).sort().map(function (label) {
    return { commodity: label, cost: descriptiveStats_(groups[label].cost), income: descriptiveStats_(groups[label].income), margin: descriptiveStats_(groups[label].margin), roi: descriptiveStats_(groups[label].roi) };
  });
}

function productivityOutliers_(rows, cols) {
  var values = [];
  rows.forEach(function (row) {
    var areaM2 = Number(valueFor_(row, cols.landArea));
    var yieldKg = Number(valueFor_(row, cols.yieldKg));
    if (isFinite(areaM2) && areaM2 > 0 && isFinite(yieldKg) && yieldKg >= 0) values.push(yieldKg / (areaM2 / 10000));
  });
  if (values.length < 4) return { count: 0, lowerBound: 0, upperBound: 0 };
  values.sort(function (a, b) { return a - b; });
  var q1 = percentile_(values, 0.25), q3 = percentile_(values, 0.75), iqr = q3 - q1;
  var lower = q1 - 1.5 * iqr, upper = q3 + 1.5 * iqr;
  return { count: values.filter(function (value) { return value < lower || value > upper; }).length, lowerBound: lower, upperBound: upper };
}

// Indikator literasi keuangan berbasis praktik yang tersedia pada form,
// bukan pengganti asesmen literasi keuangan formal.
function financialLiteracy_(rows, cols) {
  var levels = { 'Perlu penguatan': 0, 'Dasar': 0, 'Menengah': 0, 'Lanjut': 0 };
  rows.forEach(function (row) {
    var habit = String(valueFor_(row, cols.savingHabit) || '');
    var location = String(valueFor_(row, cols.savingLocation) || '');
    if (!/\bya\b/i.test(habit)) { levels['Perlu penguatan']++; return; }
    if (/bank/i.test(location)) { levels['Lanjut']++; return; }
    if (/koperasi/i.test(location)) { levels['Menengah']++; return; }
    levels['Dasar']++;
  });
  return {
    levels: Object.keys(levels).map(function (label) { return { label: label, value: levels[label] }; }),
    savingHabits: countBy_(rows, cols.savingHabit),
    savingLocations: countMultiBy_(rows, cols.savingLocation, /^8\.11\.1\./),
    capitalSources: countBy_(rows, cols.capitalSource)
  };
}

function percentile_(values, percentile) {
  if (!values.length) return 0;
  var index = (values.length - 1) * percentile, lower = Math.floor(index), upper = Math.ceil(index);
  return lower === upper ? values[lower] : values[lower] + (values[upper] - values[lower]) * (index - lower);
}

function descriptiveStats_(values) {
  if (!values.length) return { count: 0, min: 0, max: 0, mean: 0, median: 0, standardDeviation: 0 };
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  var mean = average_(sorted);
  var middle = Math.floor(sorted.length / 2);
  var median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  var variance = sorted.reduce(function (sum, value) { return sum + Math.pow(value - mean, 2); }, 0) / sorted.length;
  return { count: sorted.length, min: sorted[0], max: sorted[sorted.length - 1], mean: mean, median: median, standardDeviation: Math.sqrt(variance) };
}

function getMapPoints(filters) {
  var dataset = readDataset_();
  var cols = dataset.columns;
  return filterRows_(dataset.rows, cols, filters || {}).map(function (row) {
    var point = parseLocation_(valueFor_(row, cols.geolocation));
    if (!point) return null;
    return {
      lat: point.lat, lng: point.lng,
      province: displayValue_(valueFor_(row, cols.province)) || 'Tidak diisi',
      commodity: commodityFor_(valueFor_(row, cols.commodity)),
      farmerName: displayValue_(valueFor_(row, cols.farmerName)) || 'Nama tidak diisi',
      photoId: driveFileId_(valueFor_(row, cols.photo))
    };
  }).filter(function (point) { return point; });
}

function getTable(filters, page, pageSize) {
  var dataset = readDataset_();
  filters = filters || {};
  var rows = filters.onlyDuplicates ? dataset.allRows : dataset.rows;
  rows = filterTableRows_(rows, dataset.columns, filters);
  if (filters.onlyDuplicates) rows = rows.filter(function (row) { return dataset.duplicateIds[String(valueFor_(row, dataset.columns.id))] > 1; });
  rows.sort(function (a, b) { return dateValue_(valueFor_(b, dataset.columns.surveyDate)) - dateValue_(valueFor_(a, dataset.columns.surveyDate)); });
  page = Math.max(0, Number(page) || 0);
  pageSize = Math.min(100, Math.max(10, Number(pageSize) || 25));
  var cols = dataset.columns;
  var fields = [
    ['Tanggal pendataan', cols.surveyDate], ['Nama petani', cols.farmerName], ['Provinsi', cols.province], ['Kabupaten', cols.district],
    ['Jenis kelamin', cols.gender], ['Usia', cols.birthDate], ['Pendidikan', cols.education],
    ['Kelompok tani', cols.farmerGroup], ['Komoditas utama', cols.commodity]
  ];
  var start = page * pageSize;
  return {
    headers: fields.map(function (field) { return field[0]; }).concat(['Status data']),
    rows: rows.slice(start, start + pageSize).map(function (row) {
      return { id: String(valueFor_(row, cols.id)), cells: fields.map(function (field) {
        if (field[1] === cols.surveyDate) return formatDateTime_(valueFor_(row, field[1]));
        return displayValue_(valueFor_(row, field[1]), field[1] === cols.birthDate);
      }).concat([dataset.duplicateIds[String(valueFor_(row, cols.id))] > 1 ? 'Duplikat: ' + dataset.duplicateIds[String(valueFor_(row, cols.id))] + ' baris' : 'Respons unik']) };
    }), total: rows.length, page: page, pageSize: pageSize, showingDuplicates: Boolean(filters.showDuplicates)
  };
}

function getSurveyDetail(id) {
  var dataset = readDataset_();
  var record = dataset.rows.filter(function (row) { return String(valueFor_(row, dataset.columns.id)) === String(id); })[0];
  if (!record) throw new Error('Respons survei tidak ditemukan.');
  var headers = readHeaders_();
  var photos = [], fields = [];
  headers.forEach(function (header, index) {
    var value = record[index];
    if (value === '' || value == null || technicalHeader_(header)) return;
    if (/foto_bersama_responden/i.test(String(header))) {
      var photoId = driveFileId_(value);
      if (photoId) photos.push({ label: prettyHeader_(header), fileId: photoId });
      return;
    }
    fields.push({ label: prettyHeader_(header), value: displayValue_(value, index === dataset.columns.birthDate) });
  });
  return { farmerName: displayValue_(valueFor_(record, dataset.columns.farmerName)), enumerator: displayValue_(valueFor_(record, dataset.columns.enumerator)), fields: fields, photos: photos };
}

function readDataset_() {
  var ss = CONFIG.spreadsheetId ? SpreadsheetApp.openById(CONFIG.spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet belum dipilih. Jalankan setSpreadsheetId(id) terlebih dahulu.');
  var sheet = ss.getSheetByName(CONFIG.sheetName) || ss.getSheets()[0];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Sheet belum memiliki data respons.');
  var headers = values.shift();
  var columns = resolveColumns_(headers);
  return { allRows: values, rows: deduplicateRows_(values, columns.id), duplicateIds: duplicateIds_(values, columns.id), columns: columns };
}

function readHeaders_() {
  var ss = CONFIG.spreadsheetId ? SpreadsheetApp.openById(CONFIG.spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.sheetName) || ss.getSheets()[0];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function resolveColumns_(headers) {
  function find(patterns) {
    for (var i = 0; i < headers.length; i++) {
      var header = String(headers[i] || '').toLowerCase();
      for (var j = 0; j < patterns.length; j++) if (header.indexOf(patterns[j]) > -1) return i;
    }
    return -1;
  }
  var districts = [];
  headers.forEach(function (header, index) {
    if (/^2\.?\s*kabupaten$/i.test(String(header || ''))) districts.push(index);
  });
  return {
    id: find(['_id']),
    surveyDate: find(['start']),
    province: find(['provinsi']), district: districts,
    farmerName: find(['_4_1_nama_lengkap']),
    enumerator: find(['_3_1_nama_petugas']),
    commodity: find(['apa_komoditas_utama', 'komoditas_utama', 'komoditas utama']),
    gender: find(['jenis_kelamin']), birthDate: find(['tanggal_lahir']),
    education: find(['pendidikan_terakhir']), farmerGroup: find(['nama_kelompok_tani']),
    youth: find(['anak_petani_atau_pemuda']),
    landArea: find(['luas_laha_komoditas', 'luas lahan']),
    landStatus: find(['status_lahan_are']), waterSource: find(['sumber_air_utama']),
    yieldKg: find(['rata_rata_atu_musim_panen', 'musim_panen_kg']),
    agroecology: find(['kondisi_praktik_agroekologi']),
    chemicalFertilizer: find(['dalam_12_bulan_t_pada_komoditas_utama']),
    chemicalPesticide: find(['dalam_12_bulan_t_obat_kimia_sintetis']),
    organicInput: find(['input_agroekologi_organik']),
    cost: find(['estimasi_aan_dalam_satu_musim']), income: find(['estimasi_alam_satu_masa_panen']),
    salesChannel: find(['hasil_utama_biasanya_d']), cooperativeSupport: find(['dukungan_apa_yang_paling_serin']), governmentSupport: find(['_8_10_dukungan_apa']), risks: find(['apa_3_risiko']),
    savingHabit: find(['apakah_ada_kebiasaan_menabung']), savingLocation: find(['_8_11_1_dimana_anda_menabung']), capitalSource: find(['_8_12_dari_mana_modal_usaha']),
    certification: find(['produk_pertanian_sa']),
    geolocation: find(['_geolocation']),
    photo: find(['_10_1_foto_bersama_responden_1'])
  };
}

function filterRows_(rows, cols, filters) {
  return rows.filter(function (row) {
    return (!filters.province || valueFor_(row, cols.province) === filters.province) &&
      (!filters.commodity || commodityFor_(valueFor_(row, cols.commodity)) === filters.commodity) &&
      (!filters.district || valueFor_(row, cols.district) === filters.district);
  });
}

function filterTableRows_(rows, cols, filters) {
  return rows.filter(function (row) {
    return (!filters.province || valueFor_(row, cols.province) === filters.province) &&
      (!filters.district || valueFor_(row, cols.district) === filters.district) &&
      (!filters.enumerator || valueFor_(row, cols.enumerator) === filters.enumerator) &&
      (!filters.commodity || commodityFor_(valueFor_(row, cols.commodity)) === filters.commodity);
  });
}

function valueFor_(row, column) {
  if (Array.isArray(column)) {
    for (var i = 0; i < column.length; i++) if (row[column[i]] !== '' && row[column[i]] != null) return row[column[i]];
    return '';
  }
  return column >= 0 ? row[column] : '';
}

function uniqueValues_(rows, column, transform) {
  var values = {};
  rows.forEach(function (row) {
    var v = valueFor_(row, column);
    v = transform ? transform(v) : v;
    if (v) values[String(v)] = true;
  });
  return Object.keys(values).sort();
}

function countBy_(rows, column, transform) {
  var count = {};
  rows.forEach(function (row) {
    var value = valueFor_(row, column);
    var key = transform ? transform(value) : displayValue_(value);
    key = key || 'Tidak diisi';
    count[key] = (count[key] || 0) + 1;
  });
  return Object.keys(count).map(function (key) { return { label: key, value: count[key] }; })
    .sort(function (a, b) { return b.value - a.value; });
}

function countByFilled_(rows, column) {
  return countBy_(rows.filter(function (row) { return valueFor_(row, column) !== '' && valueFor_(row, column) != null; }), column);
}

function countMultiBy_(rows, column, allowedCode) {
  var count = {};
  rows.forEach(function (row) {
    String(valueFor_(row, column) || '').split(',').forEach(function (item) {
      item = item.trim();
      if (!item || (allowedCode && !allowedCode.test(item))) return;
      var key = displayValue_(item);
      if (key) count[key] = (count[key] || 0) + 1;
    });
  });
  return Object.keys(count).map(function (key) { return { label: key, value: count[key] }; }).sort(function (a, b) { return b.value - a.value; });
}

function commoditySelections_(rows, column) {
  return countMultiBy_(rows, column, /^5\.1\./);
}

function financialByCommodity_(rows, cols) {
  var groups = {};
  rows.forEach(function (row) {
    var commodity = commodityFor_(valueFor_(row, cols.commodity));
    var cost = Number(valueFor_(row, cols.cost)), income = Number(valueFor_(row, cols.income));
    if (commodity === 'Perlu validasi' || commodity.indexOf('Multi-') === 0) return;
    if (!groups[commodity]) groups[commodity] = { costs: [], incomes: [] };
    if (isFinite(cost) && cost >= 0) groups[commodity].costs.push(cost);
    if (isFinite(income) && income >= 0) groups[commodity].incomes.push(income);
  });
  return Object.keys(groups).map(function (label) { return { label: label, cost: average_(groups[label].costs), income: average_(groups[label].incomes) }; });
}

function makeKpis_(rows, cols) {
  var areas = numbers_(rows, cols.landArea), yields = numbers_(rows, cols.yieldKg);
  return {
    respondents: rows.length,
    averageLandArea: average_(areas), averageYield: average_(yields),
    certified: rows.filter(function (row) { return /ya|aktif/i.test(String(valueFor_(row, cols.certification))); }).length
  };
}
function numbers_(rows, column) { return rows.map(function (row) { return Number(valueFor_(row, column)); }).filter(function (n) { return isFinite(n) && n > 0; }); }
function average_(values) { return values.length ? values.reduce(function (a, b) { return a + b; }, 0) / values.length : 0; }

// Pertanyaan komoditas pada form seharusnya satu jawaban. Beberapa baris
// memuat gabungan kode pertanyaan lain; jangan mengatribusikannya ke satu komoditas.
function commodityFor_(value) {
  var raw = String(value || '').toLowerCase();
  var matches = [];
  if (/5\.1\.1\s*padi|\bpadi\b/.test(raw)) matches.push('Padi');
  if (/5\.1\.2\s*kakao|\bkakao\b/.test(raw)) matches.push('Kakao');
  if (/5\.1\.7\s*kopi|\bkopi\b/.test(raw)) matches.push('Kopi');
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return 'Multi-komoditas (perlu validasi)';
  return raw ? 'Perlu validasi' : '';
}

// File sumber memiliki pengulangan _id yang isi surveinya sama; perbedaannya
// hanya URL foto. Satu _id dihitung sebagai satu respons pada dashboard.
function deduplicateRows_(rows, idColumn) {
  if (idColumn < 0) return rows;
  var seen = {}, unique = [];
  rows.forEach(function (row) {
    var id = String(row[idColumn] || '');
    if (!id || !seen[id]) { unique.push(row); seen[id] = true; }
  });
  return unique;
}

function duplicateIds_(rows, idColumn) {
  var count = {}, duplicates = {};
  if (idColumn < 0) return duplicates;
  rows.forEach(function (row) { var id = String(row[idColumn] || ''); if (id) count[id] = (count[id] || 0) + 1; });
  Object.keys(count).forEach(function (id) { if (count[id] > 1) duplicates[id] = count[id]; });
  return duplicates;
}

function parseLocation_(value) {
  if (!value) return null;
  var match = String(value).match(/\[?\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  var lat = Number(match[1]), lng = Number(match[2]);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: lat, lng: lng };
}

function driveFileId_(value) {
  var url = String(value || '');
  var match = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/i) ||
    url.match(/[?&]id=([^&]+)/i);
  return match ? decodeURIComponent(match[1]) : '';
}

function technicalHeader_(header) {
  return /^(_id|formhub\/uuid|start|end|__version__|meta\/|_xform|_uuid|_status|_geolocation|_submission|_validation|_submitted)/i.test(String(header));
}

function prettyHeader_(header) {
  var text = String(header).split('/').pop().replace(/^_?\d+(?:_\d+)*_?/, '').replace(/_/g, ' ').trim();
  return text || String(header);
}

// Dipanggil hanya saat popup peta dibuka, agar seluruh foto tidak diunduh sekaligus.
function getPhotoData(fileId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(String(fileId || ''))) throw new Error('ID foto tidak valid.');
  var file = DriveApp.getFileById(fileId);
  var blob = file.getThumbnail() || file.getBlob();
  var type = blob.getContentType();
  if (type.indexOf('image/') !== 0) throw new Error('Dokumentasi bukan file gambar.');
  return 'data:' + type + ';base64,' + Utilities.base64Encode(blob.getBytes());
}
function displayValue_(value, asAge) {
  if (value === '' || value == null) return '';
  if (asAge && Object.prototype.toString.call(value) === '[object Date]') {
    var age = new Date().getFullYear() - value.getFullYear();
    return age >= 0 && age <= 120 ? age + ' tahun' : 'Perlu validasi';
  }
  var text = String(value).replace(/^\d+(?:\.\d+)?\s*/, '').trim();
  return text || String(value);
}

function dateValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return value.getTime();
  var time = new Date(value).getTime();
  return isFinite(time) ? time : 0;
}

function formatDateTime_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm');
  var parsed = new Date(value);
  return isFinite(parsed.getTime()) ? Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm') : String(value || '');
}
