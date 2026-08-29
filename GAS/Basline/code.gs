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
      district: params.district || '', subdistrict: params.subdistrict || '',
      village: params.village || '', enumerator: params.enumerator || '',
      onlyDuplicates: params.onlyDuplicates === 'true'
    };
    var data;
    if (action === 'options') data = getFilterOptions(filters);
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

function getFilterOptions(filters) {
  var dataset = readDataset_();
  filters = filters || {};
  var provinceRows = filterRows_(dataset.rows, dataset.columns, { province: filters.province });
  var districtRows = filterRows_(provinceRows, dataset.columns, {
    province: filters.province, district: filters.district
  });
  var subdistrictRows = filterRows_(districtRows, dataset.columns, {
    province: filters.province, district: filters.district, subdistrict: filters.subdistrict
  });
  return {
    provinces: uniqueValues_(dataset.rows, dataset.columns.province),
    commodities: uniqueValues_(dataset.rows, dataset.columns.commodity, commodityFor_),
    districts: uniqueValues_(provinceRows, dataset.columns.district),
    subdistricts: uniqueValues_(districtRows, dataset.columns.subdistrict),
    villages: uniqueValues_(subdistrictRows, dataset.columns.village),
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
    var day = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    trend[day] = (trend[day] || 0) + 1;
  });
  // Tampilkan maksimal tujuh tanggal pengisian terbaru agar tren ringkas dan
  // tetap relevan terhadap filter wilayah/komoditas yang sedang aktif.
  var trends = Object.keys(trend).sort().slice(-7).map(function (day) { return { day: day, responses: trend[day] }; });
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
    trends.length > 1 ? 'Data mencakup ' + trends.length + ' hari pengisian terbaru.' : 'Belum cukup hari pengisian untuk membentuk tren waktu.',
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
      subdistricts: countBy_(rows, cols.subdistrict), villages: countBy_(rows, cols.village),
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
  // Ekspor/sinkronisasi Kobo dapat menyisakan baris kosong di bawah data.
  // Baris tersebut bukan respons dan tidak boleh ikut menghitung KPI.
  values = values.filter(function (row) {
    return row.some(function (value) { return value !== '' && value != null; });
  });
  var columns = resolveColumns_(headers);
  return { allRows: values, rows: deduplicateRows_(values, columns.id), duplicateIds: duplicateIds_(values, columns.id), columns: columns };
}

function readHeaders_() {
  var ss = CONFIG.spreadsheetId ? SpreadsheetApp.openById(CONFIG.spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.sheetName) || ss.getSheets()[0];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function resolveColumns_(headers) {
  // Header dari ekspor XLSForm dapat memakai spasi, garis bawah, titik, simbol,
  // atau kolom pengulangan. Normalisasi aman memastikan format header baru
  // tetap cocok tanpa mengubah nilai asli dari spreadsheet.
  function normalized(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[\/._-]+/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // Pola harus cocok dari header menuju pola, bukan sebaliknya. Pencocokan
  // terbalik membuat header pendek seperti "_id" dianggap cocok dengan
  // "pestisida" dan menyebabkan diagram membaca ID respons sebagai jawaban.
  function headerMatches(header, pattern) {
    var text = normalized(header);
    var candidate = normalized(pattern);
    return Boolean(candidate) && (text === candidate || text.indexOf(candidate) > -1);
  }
  function find(patterns) {
    // Urutan pola adalah prioritas. Letakkan nama/nomor pertanyaan yang paling
    // spesifik terlebih dahulu agar kolom "Lainnya" tidak mengalahkan kolom inti.
    for (var p = 0; p < patterns.length; p++) {
      for (var i = 0; i < headers.length; i++) {
        if (headerMatches(headers[i], patterns[p])) return i;
      }
    }
    return -1;
  }
  function findAll(patterns) {
    var matches = [];
    headers.forEach(function (header, index) {
      for (var i = 0; i < patterns.length; i++) {
        if (headerMatches(header, patterns[i])) { matches.push(index); return; }
      }
    });
    return matches;
  }
  var districts = [];
  headers.forEach(function (header, index) {
    if (/kabupaten/i.test(normalized(header))) districts.push(index);
  });
  return {
    id: find(['_id', 'id responden', 'submission id']),
    surveyDate: find(['start', 'tanggal survei', 'tanggal pendataan', 'waktu submit', 'submission time']),
    province: find(['1 provinsi', 'provinsi', 'nama provinsi', 'propinsi']),
    district: districts.length ? districts : findAll(['2 kabupaten', 'kabupaten', 'district']),
    subdistrict: find(['4 8 kecamatan', 'kecamatan', 'subdistrict']),
    village: find(['4 9 desa kelurahan', 'desa kelurahan', 'desa', 'kelurahan', 'village']),
    farmerName: find(['4 1 nama lengkap', 'nama lengkap', 'nama petani', 'nama responden']),
    enumerator: find(['3 1 nama petugas', 'nama petugas', 'petugas', 'pencacah', 'enumerator']),
    commodity: find(['5 1 apa komoditas utama yang sedang diusahakan petani saat ini', 'komoditas utama', 'komoditas usaha utama', 'apa komoditas utama', 'nama komoditas utama']),
    gender: find(['4 4 jenis kelamin', 'jenis kelamin', 'kelamin']), birthDate: find(['4 3 tanggal lahir', 'tanggal lahir', 'ttl']), maritalStatus: find(['4 5 status perkawinan', 'status perkawinan', 'status menikah']),
    education: find(['4 11 pendidikan terakhir', '_4 11 pendidikan terakhir', 'pendidikan terakhir', 'tingkat pendidikan']), farmerGroup: find(['4 12 nama kelompok tani', 'nama kelompok tani', 'kelompok tani']),
    youth: find(['apakah anak petani atau pemuda', 'anak petani atau pemuda', 'pemuda petani', 'usia muda']), cooperativeMembership: find(['tergabung sebagai anggota koperasi', 'apakah tergabung sebagai', 'anggota koperasi', '8 11 1 apakah tergabung']),
    landArea: find(['5 3 berapa luas laha', '5 3 berapa luas lahan komoditas utama m2', 'luas lahan area usaha utama', 'luas area usaha utama', 'luas lahan komoditas utama', 'luas areal']),
    landStatus: findAll(['5 2 bagaimana status lahan area usaha', 'status lahan area usaha utama', 'status lahan', 'bagaimana status lahan area usaha']),
    waterSource: find(['apa sumber air utama untuk usa', 'apa sumber air utama untuk usaha', 'sumber air utama untuk usaha tani', 'sumber air utama']),
    contaminationRisk: find(['sumber risiko pencemaran', 'apakah lahan area usaha', 'risiko pencemaran', 'status lahan']),
    // Kolom varietas dapat berpindah sesuai komoditas yang dipilih.
    varieties: findAll(['varietas padi', 'varietas kakao', 'varietas kopi', '5 1 2 varietas kakao', '5 1 1 varietas padi apa', '5 4 varietas kopi', 'varietas']) ,
    farmingPattern: findAll(['6 3 pola usaha tani petani saat ini paling mendekati yang mana', 'pola usaha tani petani', 'pola usaha tani', '6 3']),
    plantingMethod: find(['6 4 metode tanam yang dikembangkan', 'metode tanam yang dikembangkan', 'metode tanam', '6 4']),
    yieldKg: find(['8 1 berapa rata rata hasil panen dalam satu musim panen kg', 'rata rata hasil panen dalam satu musim panen', 'rata rata hasil dalam satu musim panen', 'rata rata produksi dalam satu musim panen', 'hasil panen', 'produksi panen', '8 1 berapa rata rata']),
    agroecology: find(['6 5 menurut kondisi praktik agroekologi', 'tahap mana dalam praktik agroekologi', 'tahap agroekologi', 'praktik agroekologi', '6 5']),
    chemicalFertilizer: find(['7 1 dalam 12 bulan t pada komoditas utama', '7 1 dalam 12 bulan terakhir pada komoditas utama', 'masih menggunakan pupuk kimia pada komoditas utama', 'pupuk kimia']),
    chemicalPesticide: find(['7 2 dalam 12 bulan t obat kimia sintetis', '7 2 dalam 12 bulan terakhir obat kimia sintetis', 'masih menggunakan pestisida herbisida obat kimia sintetis', 'pestisida kimia', 'herbisida']),
    organicInput: find(['input agroekologi organik apa', 'input organik', 'apakah memakai input organik']),
    seedSource: find(['7 4 dari mana asal benih bibit', 'asal benih bibit klon benur indukan sumber produksi utama', 'asal benih', 'sumber benih', '7 4']),
    companionPlants: find(['6 2 selain komoditas sebutkan maksimal 3', 'tanaman pendamping penutup tanah refugia', 'tanaman pendamping', 'refugia', '6 2']),
    soilWaterConservation: find(['7 6 bagaimana cara merawat konservasi tanah dan air', 'cara merawat konservasi tanah dan air', 'konservasi tanah', 'air dan tanah', '7 6']),
    pestControl: find(['7 7 bagaimana cara unit gangguan budidaya', 'cara utama petani mengendalikan hama', 'kendali hama', 'cara mengendalikan hama', '7 7']),
    wasteReuse: find(['7 8 apakah sisa pane dimanfaatkan kembali', 'sisa panen kotoran ternak limbah kebun', 'pengelolaan limbah', 'limbah kebun', '7 8']),
    bufferProtection: find(['7 9 apakah ada zona r tanaman perangkap', 'zona pembatas atau upaya perlindungan', 'zona pembatas', 'perlindungan ekosistem', '7 9']),
    ecosystemProtection: find(['7 10 apakah petani melakukan praktik yang melindungi ekosistem sekitar', 'praktik yang melindungi ekosistem', 'melindungi ekosistem', 'ekosistem', '7 10']),
    agroecologyInterest: find(['7 11 apakah petani tertarik untuk beralih atau mempertahankan praktek pertanian berbasis agroekologi', 'tertarik untuk beralih atau mempertahankan praktek pertanian berbasis agroekologi', 'minat agroekologi', 'beralih agroekologi', '7 18']),
    cost: find(['8 3 berapa estimasi biaya dalam satu musim', 'estimasi biaya untuk tanam dan atau pemeliharaan dalam satu musim', 'estimasi biaya produksi', 'biaya tanam', 'estimasi biaya', 'biaya untuk tanam', '8 3 berapa estimasi']),
    income: find(['8 4 berapa estimasi pendapatan dalam satu masa panen', 'estimasi pendapatan yang diperoleh petani dalam satu masa panen', 'estimasi pendapatan', 'pendapatan petani', 'pendapatan yang diperoleh petani', '8 4 berapa estimasi']),
    recordKeeping: find(['8 2 apakah petani men catat kegiatan usaha tani', 'mencatat kegiatan usaha tani', 'catat usaha tani', 'mencatat', '8 2']),
    qualityStandards: find(['8 8 apakah hasil pertanian memiliki standar mutu', 'hasil pertanian saat ini sudah memiliki standar mutu', 'standar mutu', 'standar kualitas', '8 8']),
    salesChannel: find(['ke mana hasil utama biasanya d', '8 6 ke mana hasil utama biasanya dijual', 'hasil pertanian biasanya dijual disalurkan', 'saluran pemasaran', 'pemasaran hasil']),
    cooperativeSupport: find(['8 9 dukungan apa yang paling sering diterima petani dari koperasi', 'dukungan apa yang paling serin', 'dukungan koperasi']),
    governmentSupport: find(['8 10 dukungan apa yang paling sering diterima petani dari pemerintah', 'dukungan apa yang paling sering diterima petani pemerintah', 'dukungan pemerintah', 'pemerintah', '8 10']),
    risks: find(['9 2 apa 3 risiko atau masalah utama', 'apa 3 risiko atau masalah utama', 'risiko utama', 'masalah utama', '9 2']),
    savingHabit: find(['8 11 apakah ada kebiasaan menabung setelah panen', 'kebiasaan menabung setelah panen', 'menabung setelah panen', 'kebiasaan menabung', '8 11']),
    savingLocation: find(['8 11 1 dimana anda menabung', 'dimana anda menabung', 'lokasi menabung', 'tempat menabung', '8 11 1']),
    capitalSource: find(['8 12 dari mana modal usaha pertanian saat ini', 'dari mana modal usaha pertanian', 'sumber modal', 'modal usaha', '8 12']),
    certification: find(['8 7 apakah produk pertanian saat ini sudah memiliki sertifikat organik', 'produk pertanian saat ini sudah memiliki sertifikat organik', 'sertifikat', 'organik', '8 7 apakah produk pertanian']),
    resultCondition: find(['9 1 dalam 1 tahun musim terakhir', 'kondisi hasil usaha utama dibanding sebelumnya', 'kondisi hasil usaha utama', 'hasil usaha utama', '9 1 dalam 1 tahun']),
    increasePercentage: find(['9 1 4 berapa persentase peningkatan', 'persentase peningkatan', 'peningkatan persentase', '9 1 4']),
    decreasePercentage: find(['9 1 3 berapa persentase penurunan', 'persentase penurunan', 'penurunan persentase', '9 1 3']),
    suggestions: find(['9 3 berikan saran atau harapan untuk usaha tani ke depan', 'saran atau harapan untuk meningkatan usaha tani', 'saran harapan', '9 3']),
    geolocation: findAll(['_geolocation', 'geotag', 'koordinat', 'gps', '11 geotag']),
    photo: findAll(['foto bersama responden', 'foto dokumentasi', 'foto absensi', 'foto kegiatan'])
  };
}

function filterRows_(rows, cols, filters) {
  return rows.filter(function (row) {
    return (!filters.province || comparableValue_(valueFor_(row, cols.province)) === comparableValue_(filters.province)) &&
      (!filters.commodity || comparableValue_(commodityFor_(valueFor_(row, cols.commodity))) === comparableValue_(filters.commodity)) &&
      (!filters.district || comparableValue_(valueFor_(row, cols.district)) === comparableValue_(filters.district)) &&
      (!filters.subdistrict || comparableValue_(valueFor_(row, cols.subdistrict)) === comparableValue_(filters.subdistrict)) &&
      (!filters.village || comparableValue_(valueFor_(row, cols.village)) === comparableValue_(filters.village));
  });
}

function filterTableRows_(rows, cols, filters) {
  return rows.filter(function (row) {
    return (!filters.province || comparableValue_(valueFor_(row, cols.province)) === comparableValue_(filters.province)) &&
      (!filters.district || comparableValue_(valueFor_(row, cols.district)) === comparableValue_(filters.district)) &&
      (!filters.enumerator || comparableValue_(valueFor_(row, cols.enumerator)) === comparableValue_(filters.enumerator)) &&
      (!filters.commodity || comparableValue_(commodityFor_(valueFor_(row, cols.commodity))) === comparableValue_(filters.commodity)) &&
      (!filters.subdistrict || comparableValue_(valueFor_(row, cols.subdistrict)) === comparableValue_(filters.subdistrict)) &&
      (!filters.village || comparableValue_(valueFor_(row, cols.village)) === comparableValue_(filters.village));
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

function normalizeChoiceValue_(value) {
  if (value === '' || value == null) return '';
  if (Array.isArray(value)) {
    var collected = [];
    value.forEach(function (item) {
      var normalized = normalizeChoiceValue_(item);
      if (normalized) collected.push(normalized);
    });
    return collected.join(', ');
  }

  var text = String(value).trim();
  if (!text) return '';

  var codeMap = {
    0: 'Tidak',
    1: 'Ya',
    2: 'Tidak',
    10: 'Laki-laki',
    11: 'Perempuan',
    20: 'SD/Sederajat',
    21: 'SMP/Sederajat',
    22: 'SMA/SMK/Sederajat',
    23: 'Diploma',
    24: 'S1',
    25: 'S2/S3',
    30: 'Belum Kawin',
    31: 'Kawin',
    32: 'Cerai Hidup',
    33: 'Cerai Mati',
    40: 'Milik Sendiri',
    41: 'Sewa/Kontrak',
    42: 'Bagi Hasil',
    43: 'Lainnya',
    50: 'Sumur',
    51: 'Sungai',
    52: 'Irigasi',
    53: 'Hujan',
    54: 'Lainnya',
    55: 'Banjir',
    56: 'Sawah tadah hujan',
    57: 'Lahan kering',
    60: 'Pribadi',
    61: 'Keluarga',
    62: 'Koperasi',
    63: 'Bank',
    64: 'Lainnya'
  };

  var direct = text.replace(/^\d+\s*[\.\-)]\s*/, '').replace(/^\d+\s*[:\-]\s*/, '').trim();
  if (direct && !/^\d+(?:[.,]\d+)?$/.test(direct)) {
    var directLabel = direct.replace(/\s+/g, ' ').trim();
    if (/^(laki|perempuan|sd|smp|sma|smk|diploma|s1|s2|s3|kawin|cerai|sumur|sungai|irigasi|hujan|milik|sewa|bagi|hasil|bank|koperasi|pribadi|keluarga)/i.test(directLabel)) {
      return directLabel;
    }
    return directLabel;
  }

  var numeric = Number(text.replace(/[^\d]/g, ''));
  if (isFinite(numeric) && numeric >= 0 && mathValueExists_(numeric, codeMap)) {
    return codeMap[numeric];
  }

  var textLower = text.toLowerCase();
  if (/laki/i.test(textLower)) return 'Laki-laki';
  if (/perempuan/i.test(textLower)) return 'Perempuan';
  if (/sd|sekolah dasar/i.test(textLower)) return 'SD/Sederajat';
  if (/smp|sekolah menengah pertama/i.test(textLower)) return 'SMP/Sederajat';
  if (/sma|smk|sekolah menengah atas|menengah kejuruan/i.test(textLower)) return 'SMA/SMK/Sederajat';
  if (/diploma|akademi/i.test(textLower)) return 'Diploma';
  if (/s1|sarjana|strata 1/i.test(textLower)) return 'S1';
  if (/s2|s3|magister|doktor/i.test(textLower)) return 'S2/S3';
  if (/kawin|nikah/i.test(textLower)) return 'Kawin';
  if (/belum kawin|belum menikah/i.test(textLower)) return 'Belum Kawin';
  if (/cerai hidup|cerai/i.test(textLower)) return 'Cerai Hidup';
  if (/cerai mati/i.test(textLower)) return 'Cerai Mati';
  if (/milik sendiri|sendiri/i.test(textLower)) return 'Milik Sendiri';
  if (/sewa|kontrak/i.test(textLower)) return 'Sewa/Kontrak';
  if (/bagi hasil|hasil bagi/i.test(textLower)) return 'Bagi Hasil';
  if (/sumur/i.test(textLower)) return 'Sumur';
  if (/sungai/i.test(textLower)) return 'Sungai';
  if (/irigasi/i.test(textLower)) return 'Irigasi';
  if (/hujan/i.test(textLower)) return 'Hujan';
  if (/bank/i.test(textLower)) return 'Bank';
  if (/koperasi/i.test(textLower)) return 'Koperasi';
  if (/pribadi/i.test(textLower)) return 'Pribadi';
  if (/keluarga/i.test(textLower)) return 'Keluarga';

  return text;
}

function mathValueExists_(value, map) {
  return Object.prototype.hasOwnProperty.call(map, Number(value));
}

function countMultiBy_(rows, column, allowedCode) {
  var count = {};
  rows.forEach(function (row) {
    var rawValue = valueFor_(row, column);
    var items = Array.isArray(rawValue) ? rawValue : String(rawValue || '').split(/[;\n,]+/);
    items.forEach(function (item) {
      item = String(item || '').trim();
      if (!item) return;
      var normalizedItem = normalizeChoiceValue_(item);
      var itemCode = String(item);
      var matchedCode = allowedCode ? (allowedCode.test(itemCode) || allowedCode.test(normalizedItem) || /^\d+(?:[.,]\d+)?$/.test(itemCode)) : true;
      if (!matchedCode) return;
      var key = displayValue_(normalizedItem);
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
      var rawValue = row[column];
      var items = Array.isArray(rawValue) ? rawValue : String(rawValue).split(/[;\n,]+/);
      items.forEach(function (item) {
        var itemText = String(item || '').trim();
        if (!itemText) return;
        var normalizedItem = normalizeChoiceValue_(itemText);
        var matchedCode = allowedCode ? (allowedCode.test(itemText) || allowedCode.test(normalizedItem) || /^\d+(?:[.,]\d+)?$/.test(itemText)) : true;
        if (!matchedCode) return;
        var key = displayValue_(normalizedItem);
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

  if (Array.isArray(value)) {
    return value.map(function (item) { return displayValue_(item); }).filter(function (item) { return item; }).join(', ');
  }

  var normalized = normalizeChoiceValue_(value);
  if (normalized && normalized !== String(value).trim()) return normalized;

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
