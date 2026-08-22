'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { 
  Users, 
  DollarSign, 
  Building2, 
  Activity, 
  RefreshCw, 
  Search, 
  MapPin, 
  Calendar, 
  Loader2,
  AlertCircle,
  BarChart3,
  Eye,
  X
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Peserta {
  pemudaLaki: string;
  pemudaPr: string;
  dewasaLaki: string;
  dewasaPr: string;
}

interface ActivityItem {
  lokasi: string;
  organisasi: string;
  komoditas: string;
  jenisKegiatan: string;
  pelapor: string;
  tanggal: string;
  durasi: string;
  peserta: Peserta;
  hasil: string;
  indikator: {
    produksi: string;
    ekonomi: string;
    kapasitas: string;
    advokasi: string;
  };
  pembiayaanAktual: number;
  biayaSwadaya: number;
  biayaLembagaLain: number;
  totalPembiayaanItem: number;
  fotoAbsensi: string;
  fotoKegiatan: string;
  lat: number | null;
  lng: number | null;
}

interface ApiResponse {
  kpi: {
    totalKegiatan: number;
    totalPeserta: number;
    totalPembiayaan: number;
    totalOrganisasi: number;
  };
  filterOptions?: {
    kegiatan: string[];
    organisasi: string[];
  };
  table: ActivityItem[];
}

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
const shortLabel = (value: string, max = 22) => value.length > max ? `${value.slice(0, max)}...` : value;
const driveFileId = (value: string) => {
  const fileMatch = value.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const queryMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return fileMatch?.[1] || queryMatch?.[1] || '';
};
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
}[character] || character));

type LeafletLayer = {
  addTo: (target: unknown) => LeafletLayer;
  bindPopup: (html: string) => LeafletLayer;
};
type LeafletMapInstance = {
  setView: (center: number[], zoom: number) => LeafletMapInstance;
  fitBounds: (bounds: number[][], options?: object) => LeafletMapInstance;
  remove: () => void;
};
type LeafletRuntime = {
  map: (node: HTMLElement, options?: object) => LeafletMapInstance;
  tileLayer: (url: string, options: object) => LeafletLayer;
  circleMarker: (point: number[], options: object) => LeafletLayer;
};

function loadLeaflet(): Promise<LeafletRuntime> {
  return new Promise((resolve, reject) => {
    const current = (window as unknown as { L?: LeafletRuntime }).L;
    if (current) return resolve(current);
    if (!document.querySelector('[data-saggd-leaflet-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.dataset.saggdLeafletCss = 'true';
      document.head.appendChild(link);
    }
    const script = document.querySelector<HTMLScriptElement>('[data-saggd-leaflet-js]') || document.createElement('script');
    script.dataset.saggdLeafletJs = 'true';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve((window as unknown as { L: LeafletRuntime }).L);
    script.onerror = () => reject(new Error('Peta tidak dapat dimuat.'));
    if (!script.parentNode) document.body.appendChild(script);
  });
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] h-[360px]">
      <h2 className="text-sm font-bold text-slate-800 mb-3">{title}</h2>
      <div className="h-[295px] w-full">{children}</div>
    </section>
  );
}

export default function SaggdDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activityFilter, setActivityFilter] = useState<string>('');
  const [organizationFilter, setOrganizationFilter] = useState<string>('');
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_SAGGD_APPS_SCRIPT_URL || '';

  const fetchData = useCallback(async () => {
    if (!APPS_SCRIPT_URL) {
      setError('URL Google Apps Script belum diatur di .env.local');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(APPS_SCRIPT_URL);
      const json = await response.json();

      if (json.status === 'success') {
        setData(json.data);
      } else {
        throw new Error(json.message || 'Gagal mengambil data dari Google Sheets.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menghubungkan ke server.');
    } finally {
      setLoading(false);
    }
  }, [APPS_SCRIPT_URL]);

  useEffect(() => {
    Promise.resolve().then(fetchData);
  }, [fetchData]);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const filteredTable = data?.table.filter((item) => {
    const q = normalize(searchQuery);
    return (
      (!activityFilter || normalize(item.jenisKegiatan) === normalize(activityFilter)) &&
      (!organizationFilter || normalize(item.organisasi) === normalize(organizationFilter)) &&
      (normalize(item.jenisKegiatan).includes(q) ||
        normalize(item.organisasi).includes(q) ||
        normalize(item.lokasi).includes(q) ||
        normalize(item.pelapor).includes(q))
    );
  }) || [];

  const filteredSummary = filteredTable.reduce((summary, item) => {
    summary.totalPeserta += Object.values(item.peserta).reduce((total, value) => total + (parseInt(value, 10) || 0), 0);
    summary.totalPembiayaan += item.totalPembiayaanItem || 0;
    return summary;
  }, { totalPeserta: 0, totalPembiayaan: 0 });

  const activityChart = Object.values(filteredTable.reduce<Record<string, { name: string; total: number }>>((groups, item) => {
    const key = normalize(item.jenisKegiatan) || 'tidak diisi';
    groups[key] = groups[key] || { name: item.jenisKegiatan || 'Tidak diisi', total: 0 };
    groups[key].total += 1;
    return groups;
  }, {})).sort((a, b) => b.total - a.total).slice(0, 8);

  const organizationChart = Object.values(filteredTable.reduce<Record<string, { name: string; total: number }>>((groups, item) => {
    const key = normalize(item.organisasi) || 'tidak diisi';
    groups[key] = groups[key] || { name: item.organisasi || 'Tidak diisi', total: 0 };
    groups[key].total += 1;
    return groups;
  }, {})).sort((a, b) => b.total - a.total).slice(0, 8);

  const participantChart = [
    { name: 'Pemuda laki-laki', total: filteredTable.reduce((sum, item) => sum + (parseInt(item.peserta.pemudaLaki, 10) || 0), 0) },
    { name: 'Pemuda perempuan', total: filteredTable.reduce((sum, item) => sum + (parseInt(item.peserta.pemudaPr, 10) || 0), 0) },
    { name: 'Dewasa laki-laki', total: filteredTable.reduce((sum, item) => sum + (parseInt(item.peserta.dewasaLaki, 10) || 0), 0) },
    { name: 'Dewasa perempuan', total: filteredTable.reduce((sum, item) => sum + (parseInt(item.peserta.dewasaPr, 10) || 0), 0) },
  ];

  const fundingChart = Object.values(filteredTable.reduce<Record<string, { name: string; total: number }>>((groups, item) => {
    const key = normalize(item.jenisKegiatan) || 'tidak diisi';
    groups[key] = groups[key] || { name: item.jenisKegiatan || 'Tidak diisi', total: 0 };
    groups[key].total += item.totalPembiayaanItem || 0;
    return groups;
  }, {})).sort((a, b) => b.total - a.total).slice(0, 8);

  const activityOptions = data?.filterOptions?.kegiatan || Array.from(new Map(data?.table.map((item) => [normalize(item.jenisKegiatan), item.jenisKegiatan]) || []).values()).sort();
  const organizationOptions = data?.filterOptions?.organisasi || Array.from(new Map(data?.table.map((item) => [normalize(item.organisasi), item.organisasi]) || []).values()).sort();

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Monitoring & Evaluasi SAGGD</h1>
          <p className="text-xs text-slate-500 mt-0.5">Data terhubung secara langsung dari Google Sheets via REST API</p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white hover:bg-slate-900 disabled:bg-slate-400 rounded-xl text-xs font-semibold transition-all shadow-md shadow-slate-800/10"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Sinkronisasi...' : 'Sinkronkan Data'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-medium">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Kegiatan</p>
              <h3 className="text-2xl font-black text-slate-800">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : filteredTable.length}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Peserta</p>
              <h3 className="text-2xl font-black text-slate-800">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : filteredSummary.totalPeserta}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Pembiayaan</p>
              <h3 className="text-xl font-black text-slate-800 truncate max-w-[170px]">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : formatIDR(filteredSummary.totalPembiayaan)}
              </h3>
            </div>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Organisasi Mitra</p>
              <h3 className="text-2xl font-black text-slate-800">
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : data?.kpi.totalOrganisasi || 0}
              </h3>
            </div>
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <label className="text-xs font-bold text-slate-500">
          Jenis kegiatan
          <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} className="mt-2 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
            <option value="">Semua kegiatan</option>
            {activityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-500">
          Nama organisasi
          <select value={organizationFilter} onChange={(e) => setOrganizationFilter(e.target.value)} className="mt-2 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
            <option value="">Semua organisasi</option>
            {organizationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <SaggdMap points={filteredTable} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartPanel title="Jumlah kegiatan per jenis">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={activityChart} layout="vertical" margin={{ left: 22, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={120} tickFormatter={(value) => shortLabel(value, 18)} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="total" name="Kegiatan" fill="#059669" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Jumlah kegiatan per organisasi">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={organizationChart} layout="vertical" margin={{ left: 22, right: 12 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={120} tickFormatter={(value) => shortLabel(value, 18)} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="total" name="Kegiatan" fill="#2563eb" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Komposisi peserta berdasarkan gender dan usia">
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={participantChart} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={88} label={({ name, percent }) => `${shortLabel(String(name || ''), 12)} ${((percent || 0) * 100).toFixed(0)}%`}><Cell fill="#059669" /><Cell fill="#34d399" /><Cell fill="#2563eb" /><Cell fill="#60a5fa" /></Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Total pembiayaan per jenis kegiatan">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={fundingChart} margin={{ left: 12, right: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tickFormatter={(value) => shortLabel(value, 13)} tick={{ fontSize: 10 }} /><YAxis tickFormatter={(value) => `Rp${(value / 1000000).toFixed(0)}M`} tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => formatIDR(Number(value))} /><Bar dataKey="total" name="Pembiayaan" fill="#d97706" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartPanel>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
        
        {/* Table Filter & Search */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-600" />Rincian Laporan Kegiatan <span className="text-xs font-medium text-slate-400">({filteredTable.length} data)</span></h2>
          
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kegiatan, lokasi, org..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">Kegiatan & Organisasi</th>
                <th className="py-4 px-6">Lokasi & Tanggal</th>
                <th className="py-4 px-6 text-center">Peserta</th>
                <th className="py-4 px-6">Total Biaya</th>
                <th className="py-4 px-6 text-center">Aksi / Lampiran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    <span>Memuat tabel data...</span>
                  </td>
                </tr>
              ) : filteredTable.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Tidak ada laporan kegiatan yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredTable.map((row, idx) => {
                  const totalPesertaItem = 
                    (parseInt(row.peserta.pemudaLaki) || 0) +
                    (parseInt(row.peserta.pemudaPr) || 0) +
                    (parseInt(row.peserta.dewasaLaki) || 0) +
                    (parseInt(row.peserta.dewasaPr) || 0);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-800 text-sm mb-0.5">{row.jenisKegiatan}</p>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                            {row.organisasi}
                          </span>
                          {row.komoditas && row.komoditas !== '-' && (
                            <span className="text-[10px] text-slate-400">• {row.komoditas}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="font-medium truncate max-w-[160px]">{row.lokasi}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>{row.tanggal}</span>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                          {totalPesertaItem} Orang
                        </span>
                      </td>

                      <td className="py-4 px-6 font-bold text-slate-700">
                        {formatIDR(row.totalPembiayaanItem)}
                      </td>

                      <td className="py-4 px-6 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedActivity(row)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {selectedActivity && (
        <ActivityDetailModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} formatIDR={formatIDR} />
      )}

    </div>
  );
}

function ActivityDetailModal({
  activity,
  onClose,
  formatIDR,
}: {
  activity: ActivityItem;
  onClose: () => void;
  formatIDR: (value: number) => string;
}) {
  const participants = [
    ['Pemuda laki-laki', activity.peserta.pemudaLaki],
    ['Pemuda perempuan', activity.peserta.pemudaPr],
    ['Dewasa laki-laki', activity.peserta.dewasaLaki],
    ['Dewasa perempuan', activity.peserta.dewasaPr],
  ];
  const indicators = [
    ['Produksi', activity.indikator?.produksi],
    ['Ekonomi', activity.indikator?.ekonomi],
    ['Kapasitas', activity.indikator?.kapasitas],
    ['Advokasi', activity.indikator?.advokasi],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="activity-detail-title" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white p-6">
          <div>
            <h2 id="activity-detail-title" className="text-lg font-bold text-slate-800">{activity.jenisKegiatan}</h2>
            <p className="mt-1 text-xs text-slate-500">Detail laporan kegiatan SAGGD</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup detail" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-5 p-6 md:grid-cols-2">
          <DetailGroup title="Informasi kegiatan">
            <DetailRow label="Organisasi" value={activity.organisasi} />
            <DetailRow label="Pelapor" value={activity.pelapor} />
            <DetailRow label="Lokasi" value={activity.lokasi} />
            <DetailRow label="Tanggal" value={activity.tanggal} />
            <DetailRow label="Komoditas" value={activity.komoditas} />
            <DetailRow label="Durasi" value={activity.durasi} />
          </DetailGroup>
          <DetailGroup title="Pembiayaan">
            <DetailRow label="Pembiayaan aktual" value={formatIDR(activity.pembiayaanAktual)} />
            <DetailRow label="Kontribusi swadaya" value={formatIDR(activity.biayaSwadaya)} />
            <DetailRow label="Kontribusi lembaga lain" value={formatIDR(activity.biayaLembagaLain)} />
            <DetailRow label="Total pembiayaan" value={formatIDR(activity.totalPembiayaanItem)} emphasis />
          </DetailGroup>
          <DetailGroup title="Sebaran peserta">
            <div className="grid grid-cols-2 gap-3">
              {participants.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-800">{value || '0'}</p></div>)}
            </div>
          </DetailGroup>
          <DetailGroup title="Capaian indikator">
            {indicators.map(([label, value]) => <DetailRow key={label} label={label} value={value || '-'} />)}
          </DetailGroup>
          <div className="md:col-span-2"><DetailGroup title="Hasil kegiatan"><p className="whitespace-pre-line text-sm leading-6 text-slate-600">{activity.hasil || '-'}</p></DetailGroup></div>
          <div className="md:col-span-2"><DetailGroup title="Dokumentasi">
            <div className="grid gap-4 md:grid-cols-2">
              {activity.fotoKegiatan?.startsWith('http') && <PhotoPreview label="Foto kegiatan" url={activity.fotoKegiatan} endpoint={process.env.NEXT_PUBLIC_SAGGD_APPS_SCRIPT_URL || ''} />}
              {activity.fotoAbsensi?.startsWith('http') && <PhotoPreview label="Foto absensi" url={activity.fotoAbsensi} endpoint={process.env.NEXT_PUBLIC_SAGGD_APPS_SCRIPT_URL || ''} />}
              {!activity.fotoKegiatan?.startsWith('http') && !activity.fotoAbsensi?.startsWith('http') && <span className="text-sm text-slate-400">Tidak ada dokumentasi.</span>}
            </div>
          </DetailGroup></div>
        </div>
      </div>
    </div>
  );
}

function DetailGroup({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-slate-100 bg-white"><h3 className="border-b border-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3><div className="p-4">{children}</div></section>;
}

function DetailRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0"><span className="text-xs text-slate-500">{label}</span><span className={`text-right text-xs ${emphasis ? 'font-bold text-emerald-700' : 'font-semibold text-slate-700'}`}>{value}</span></div>;
}

function PhotoPreview({ label, url, endpoint }: { label: string; url: string; endpoint: string }) {
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const fileId = driveFileId(url);
    let canceled = false;
    Promise.resolve().then(() => {
      if (canceled) return;
      setFailed(false);
      setSource(fileId && endpoint ? '' : url);
      setLoading(Boolean(fileId && endpoint));
    });
    if (!fileId || !endpoint) return;
    fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}action=photo&fileId=${encodeURIComponent(fileId)}`)
      .then((response) => response.json())
      .then((result: { status: string; data?: string }) => {
        if (canceled) return;
        if (result.status === 'success' && result.data) setSource(result.data);
        else setFailed(true);
        setLoading(false);
      })
      .catch(() => {
        if (!canceled) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => { canceled = true; };
  }, [endpoint, url]);

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      {loading ? <div className="flex h-56 items-center justify-center text-xs text-slate-400">Memuat preview foto...</div> : failed ? <div className="flex h-56 items-center justify-center px-4 text-center text-xs text-slate-400">Preview foto tidak dapat dimuat.</div> : <img src={source} alt={label} className="h-56 w-full object-cover" onError={() => setFailed(true)} />}
      <figcaption className="px-3 py-2 text-xs font-semibold text-slate-600">{label}</figcaption>
    </figure>
  );
}

function SaggdMap({ points }: { points: ActivityItem[] }) {
  const node = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: LeafletMapInstance | undefined;
    let canceled = false;
    loadLeaflet().then((L) => {
      if (canceled || !node.current) return;
      map = L.map(node.current).setView([-2.5, 118], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 18,
      }).addTo(map);
      const valid = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
      valid.forEach((point) => L.circleMarker([point.lat as number, point.lng as number], {
        radius: 7, color: '#ffffff', weight: 2, fillColor: '#059669', fillOpacity: 0.9,
      }).bindPopup(`<strong>${escapeHtml(point.jenisKegiatan)}</strong><br/>${escapeHtml(point.organisasi)}<br/>${escapeHtml(point.lokasi)}`).addTo(map as unknown as LeafletMapInstance));
      if (valid.length) map?.fitBounds(valid.map((point) => [point.lat as number, point.lng as number]), { padding: [28, 28], maxZoom: 12 });
    }).catch(() => undefined);
    return () => { canceled = true; map?.remove(); };
  }, [points]);

  const pointCount = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)).length;
  return (
    <section className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden lg:col-span-2">
      <div className="p-5 flex items-start justify-between gap-3">
        <div><h2 className="text-sm font-bold text-slate-800">Peta sebaran kegiatan</h2><p className="text-xs text-slate-500 mt-1">Klik marker untuk melihat kegiatan, organisasi, dan lokasi.</p></div>
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full whitespace-nowrap">{pointCount} titik GPS</span>
      </div>
      <div ref={node} className="h-[380px] w-full bg-slate-100" />
    </section>
  );
}