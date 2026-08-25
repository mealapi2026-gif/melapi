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
    landStatus: countMultiAcross_(rows, dataset.columns.landStatus, /^5\.2\./),
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
    var cost = parseNumber_(valueFor_(row, cols.cost)), income = parseNumber_(valueFor_(row, cols.income));
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
      chemicalPesticide: countBy_(rows, cols.chemicalPesticide),
      seedSources: countMultiBy_(rows, cols.seedSource, /^7\.4\./),
      companionPlants: countBy_(rows, cols.companionPlants),
      soilWaterConservation: countMultiBy_(rows, cols.soilWaterConservation, /^7\.6\./),
      pestControl: countBy_(rows, cols.pestControl),
      wasteReuse: countBy_(rows, cols.wasteReuse),
      bufferProtection: countBy_(rows, cols.bufferProtection),
      ecosystemProtection: countMultiBy_(rows, cols.ecosystemProtection, /^7\.10\./),
      agroecologyInterest: countBy_(rows, cols.agroecologyInterest)
    },
    profile: {
      maritalStatus: countBy_(rows, cols.maritalStatus), cooperativeMembership: countBy_(rows, cols.cooperativeMembership)
    },
    land: { contaminationRisks: countMultiBy_(rows, cols.contaminationRisk, /^5\.5\./) },
    commodity: {
      main: commoditySelections_(rows, cols.commodity), farmingPatterns: countMultiBy_(rows, cols.farmingPattern, /^6\.3\./),
      varieties: countMultiAcross_(rows, cols.varieties), plantingMethods: countMultiBy_(rows, cols.plantingMethod, /^6\.4\./),
      agroecologyStage: countBy_(rows, cols.agroecology)
    },
    farmManagement: { recordKeeping: countBy_(rows, cols.recordKeeping), qualityStandards: countBy_(rows, cols.qualityStandards) },
    results: {
      performance: countBy_(rows, cols.resultCondition), increase: countBy_(rows, cols.increasePercentage),
      decrease: countBy_(rows, cols.decreasePercentage), suggestionsCount: rows.filter(function (row) { return Boolean(valueFor_(row, cols.suggestions)); }).length
    },
    market: { salesChannels: countBy_(rows, cols.salesChannel), certification: countBy_(rows, cols.certification) },
    support: { cooperative: countMultiBy_(rows, cols.cooperativeSupport, /^8\.9\./), government: countMultiBy_(rows, cols.governmentSupport, /^8\.10\./) },
    financialLiteracy: financialLiteracy_(rows, cols),
    risks: countMultiBy_(rows, cols.risks, /^9\.2\./),
    monitoring: {
      provinces: countBy_(rows, cols.province), districts: countBy_(rows, cols.district),
      commodities: commodity, gender: countBy_(rows, cols.gender), education: countBy_(rows, cols.education), youth: countBy_(rows, cols.youth),
      landStatus: countMultiAcross_(rows, cols.landStatus, /^5\.2\./), waterSources: countMultiBy_(rows, cols.waterSource, /^5\.4\./)
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
    var areaM2 = parseNumber_(valueFor_(row, cols.landArea));
    var yieldKg = parseNumber_(valueFor_(row, cols.yieldKg));
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
    var cost = parseNumber_(valueFor_(row, cols.cost));
    var income = parseNumber_(valueFor_(row, cols.income));
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
    var areaM2 = parseNumber_(valueFor_(row, cols.landArea));
    var yieldKg = parseNumber_(valueFor_(row, cols.yieldKg));
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
  // Header dari ekspor XLSForm dapat memakai spasi, garis bawah, titik, atau
  // kolom pengulangan. Normalisasi membuat resolver tetap cocok dengan format
  // header pada Baseline.xlsx tanpa mengubah nilai asli dari spreadsheet.
  function normalized(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function find(patterns) {
    for (var i = 0; i < headers.length; i++) {
      var header = normalized(headers[i]);
      for (var j = 0; j < patterns.length; j++) if (header.indexOf(normalized(patterns[j])) > -1) return i;
    }
    return -1;
  }
  function findAll(patterns) {
    var matches = [];
    headers.forEach(function (header, index) {
      var text = normalized(header);
      for (var i = 0; i < patterns.length; i++) {
        if (text.indexOf(normalized(patterns[i])) > -1) { matches.push(index); return; }
      }
    });
    return matches;
  }
  var districts = [];
  headers.forEach(function (header, index) {
    if (/^2 kabupaten(?: |$)/i.test(normalized(header))) districts.push(index);
  });
  return {
    id: find(['_id']),
    surveyDate: find(['start']),
    province: find(['provinsi']), district: districts,
    farmerName: find(['4 1 nama lengkap', 'nama lengkap']),
    enumerator: find(['3 1 nama petugas', 'nama petugas']),
    commodity: find(['apa komoditas utama yang sedang diusahakan', 'komoditas utama']),
    gender: find(['jenis kelamin']), birthDate: find(['tanggal lahir']), maritalStatus: find(['status perkawinan']),
    education: find(['pendidikan terakhir']), farmerGroup: find(['nama kelompok tani']),
    youth: find(['anak petani atau pemuda']), cooperativeMembership: find(['tergabung sebagai anggota koperasi', 'apakah tergabung sebagai', '8 11 1 apakah tergabung']),
    landArea: find(['luas lahan area usaha utama yang dikelola', 'berapa luas lahan komoditas utama', 'berapa luas laha komoditas utama', 'luas lahan komoditas utama']),
    landStatus: findAll(['status lahan area usaha utama', 'bagaimana status lahan area usaha', '5 2']), waterSource: find(['sumber air utama untuk usaha tani', 'sumber air utama']), contaminationRisk: find(['sumber risiko pencemaran', 'apakah lahan area usaha']),
    // Tiga kolom cabang Kobo: Z (kakao), CC (padi), dan CY (kopi).
    // Semua perlu dikumpulkan karena hanya satu kolom terisi sesuai komoditas.
    varieties: findAll(['5 1 2 varietas kakao', '5 1 1 varietas padi apa', '5 4 varietas kopi', 'varietas padi', 'varietas kakao', 'varietas kopi']),
    farmingPattern: findAll(['pola usaha tani petani', '6 3']), plantingMethod: find(['metode tanam yang dikembangkan', '6 4']),
    yieldKg: find(['rata rata hasil panen dalam satu musim panen', 'rata rata hasil dalam satu musim panen', 'rata rata produksi dalam satu musim panen', '8 1 berapa rata rata']),
    agroecology: find(['tahap mana dalam praktik agroekologi', '6 5']),
    chemicalFertilizer: find(['masih menggunakan pupuk kimia pada komoditas utama', '7 1']),
    chemicalPesticide: find(['masih menggunakan pestisida herbisida obat kimia sintetis', '7 2']),
    organicInput: find(['input agroekologi organik apa saja', '7 3']), seedSource: find(['asal benih bibit klon benur indukan sumber produksi utama', '7 4']),
    companionPlants: find(['tanaman pendamping penutup tanah refugia', '6 2']), soilWaterConservation: find(['cara merawat konservasi tanah dan air', '7 6']),
    pestControl: find(['cara utama petani mengendalikan hama', '7 7']), wasteReuse: find(['sisa panen kotoran ternak limbah kebun', '7 8']),
    bufferProtection: find(['zona pembatas atau upaya perlindungan', '7 9']), ecosystemProtection: find(['praktik yang melindungi ekosistem', '7 10']),
    agroecologyInterest: find(['tertarik untuk beralih atau mempertahankan praktek pertanian berbasis agroekologi', '7 18']),
    cost: find(['estimasi biaya untuk tanam dan atau pemeliharaan dalam satu musim', '8 3 berapa estimasi', 'estimasi biaya', 'biaya untuk tanam']), income: find(['estimasi pendapatan yang diperoleh petani dalam satu masa panen', '8 4 berapa estimasi', 'estimasi pendapatan', 'pendapatan yang diperoleh petani']),
    recordKeeping: find(['mencatat kegiatan usaha tani', '8 2']), qualityStandards: find(['hasil pertanian saat ini sudah memiliki standar mutu', '8 8']),
    salesChannel: find(['hasil pertanian biasanya dijual disalurkan', '8 6']), cooperativeSupport: find(['dukungan apa yang paling sering diterima petani dari koperasi', '8 9']), governmentSupport: find(['dukungan apa yang paling sering diterima petani pemerintah', '8 10']), risks: find(['apa 3 risiko atau masalah utama', '9 2']),
    savingHabit: find(['kebiasaan menabung setelah panen', '8 11']), savingLocation: find(['dimana anda menabung', '8 11 1']), capitalSource: find(['dari mana modal usaha pertanian', '8 12']),
    certification: find(['produk pertanian saat ini sudah memiliki sertifikat organik', '8 7 apakah produk pertanian']), resultCondition: find(['kondisi hasil usaha utama dibanding sebelumnya', '9 1 dalam 1 tahun']),
    increasePercentage: find(['persentase peningkatan', '9 1 4']), decreasePercentage: find(['persentase penurunan', '9 1 3']), suggestions: find(['saran atau harapan untuk meningkatan usaha tani', '9 3']),
    geolocation: findAll(['_geolocation', '11 geotag']),
    photo: findAll(['foto bersama responden'])
  };
}

function filterRows_(rows, cols, filters) {
  return rows.filter(function (row) {
    return (!filters.province || comparableValue_(valueFor_(row, cols.province)) === comparableValue_(filters.province)) &&
      (!filters.commodity || comparableValue_(commodityFor_(valueFor_(row, cols.commodity))) === comparableValue_(filters.commodity)) &&
      (!filters.district || comparableValue_(valueFor_(row, cols.district)) === comparableValue_(filters.district));
  });
}

function filterTableRows_(rows, cols, filters) {
  return rows.filter(function (row) {
    return (!filters.province || comparableValue_(valueFor_(row, cols.province)) === comparableValue_(filters.province)) &&
      (!filters.district || comparableValue_(valueFor_(row, cols.district)) === comparableValue_(filters.district)) &&
      (!filters.enumerator || comparableValue_(valueFor_(row, cols.enumerator)) === comparableValue_(filters.enumerator)) &&
      (!filters.commodity || comparableValue_(commodityFor_(valueFor_(row, cols.commodity))) === comparableValue_(filters.commodity));
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
    var display = displayValue_(v);
    var key = comparableValue_(display);
    if (key && !values[key]) values[key] = display;
  });
  return Object.keys(values).map(function (key) { return values[key]; }).sort();
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

// Varietas pada Kobo berada di kolom berbeda menurut komoditas. Semua kolom
// aktif dihitung, tanpa memakai valueFor_ yang hanya mengambil kolom pertama.
function countMultiAcross_(rows, columns, allowedCode) {
  var count = {};
  if (!Array.isArray(columns)) columns = [columns];
  rows.forEach(function (row) {
    columns.forEach(function (column) {
      if (column < 0 || row[column] === '' || row[column] == null) return;
      String(row[column]).split(',').forEach(function (item) {
        var itemText = item.trim();
        if (allowedCode && !allowedCode.test(itemText)) return;
        var key = displayValue_(itemText);
        if (key) count[key] = (count[key] || 0) + 1;
      });
    });
  });
  return Object.keys(count).map(function (key) { return { label: key, value: count[key] }; })
    .sort(function (a, b) { return b.value - a.value; });
}

function commoditySelections_(rows, column) {
  return countMultiBy_(rows, column, /^5\.1\./);
}

function financialByCommodity_(rows, cols) {
  var groups = {};
  rows.forEach(function (row) {
    var commodity = commodityFor_(valueFor_(row, cols.commodity));
    var cost = parseNumber_(valueFor_(row, cols.cost)), income = parseNumber_(valueFor_(row, cols.income));
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
function numbers_(rows, column) { return rows.map(function (row) { return parseNumber_(valueFor_(row, column)); }).filter(function (n) { return isFinite(n) && n > 0; }); }
function parseNumber_(value) {
  if (typeof value === 'number') return value;
  var text = String(value == null ? '' : value).trim();
  if (!text) return NaN;
  text = text.replace(/\s/g, '');
  var multiplier = 1, unit = text.match(/(miliar|juta|ribu|m)$/i);
  if (unit) {
    multiplier = /miliar/i.test(unit[1]) ? 1000000000 : /juta/i.test(unit[1]) ? 1000000 : 1000;
    text = text.slice(0, -unit[1].length).replace(/^rp|^idr/i, '');
    text = text.replace(',', '.');
    var unitValue = Number(text);
    return isFinite(unitValue) ? unitValue * multiplier : NaN;
  }
  text = text.replace(/^rp|^idr/i, '');
  if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  else if (/^-?\d{1,3}(,\d{3})+$/.test(text)) text = text.replace(/,/g, '');
  else if (text.indexOf(',') > -1 && text.indexOf('.') > -1) text = text.replace(/\./g, '').replace(',', '.');
  else if (text.indexOf(',') > -1) text = text.replace(',', '.');
  return Number(text);
}
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
  var text = String(value).replace(/^\d+(?:\.\d+)?\s*/, '').replace(/\s+/g, ' ').trim();
  return text || String(value);
}

function comparableValue_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().toLowerCase();
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
