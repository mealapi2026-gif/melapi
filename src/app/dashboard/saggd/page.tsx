'use client';

import { useEffect, useState } from 'react';
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
  ExternalLink,
  AlertCircle
} from 'lucide-react';

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
  pembiayaanAktual: number;
  biayaSwadaya: number;
  biayaLembagaLain: number;
  totalPembiayaanItem: number;
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
  table: ActivityItem[];
}

export default function SaggdDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const APPS_SCRIPT_URL = process.env.NEXT_PUBLIC_SAGGD_APPS_SCRIPT_URL || '';

  const fetchData = async () => {
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
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menghubungkan ke server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const filteredTable = data?.table.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.jenisKegiatan.toLowerCase().includes(q) ||
      item.organisasi.toLowerCase().includes(q) ||
      item.lokasi.toLowerCase().includes(q) ||
      item.pelapor.toLowerCase().includes(q)
    );
  }) || [];

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
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : data?.kpi.totalKegiatan || 0}
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
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : data?.kpi.totalPeserta || 0}
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
                {loading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : formatIDR(data?.kpi.totalPembiayaan || 0)}
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

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
        
        {/* Table Filter & Search */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-800">Rincian Laporan Kegiatan</h2>
          
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
                        {row.fotoKegiatan && row.fotoKegiatan.startsWith('http') ? (
                          <a
                            href={row.fotoKegiatan}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold text-xs"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Foto
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}