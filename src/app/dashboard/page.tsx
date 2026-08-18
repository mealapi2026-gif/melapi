'use client';

import { useEffect, useState } from 'react';
import { Users, DollarSign, Activity, Building2, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function DashboardOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const SAGGD_URL = process.env.NEXT_PUBLIC_SAGGD_APPS_SCRIPT_URL || '';

  useEffect(() => {
    async function fetchOverviewData() {
      if (!SAGGD_URL) return;
      try {
        const res = await fetch(SAGGD_URL);
        const json = await res.json();
        if (json.status === 'success') {
          setData(json.data);
        }
      } catch (err) {
        console.error('Gagal memuat data Overview:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchOverviewData();
  }, [SAGGD_URL]);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Siapkan data 5 kegiatan terbaru untuk Grafik
  const chartData = data?.table.slice(0, 5).map((item: any) => ({
    name: item.jenisKegiatan.length > 15 ? item.jenisKegiatan.substring(0, 15) + '...' : item.jenisKegiatan,
    biaya: item.totalPembiayaanItem,
    fullName: item.jenisKegiatan
  })) || [];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Kegiatan</p>
          <div className="flex justify-between items-center">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : data?.kpi.totalKegiatan || 0}
            </h3>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Activity className="w-6 h-6" /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Peserta</p>
          <div className="flex justify-between items-center">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : data?.kpi.totalPeserta || 0}
            </h3>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users className="w-6 h-6" /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Pembiayaan</p>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : formatIDR(data?.kpi.totalPembiayaan || 0)}
            </h3>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-xl"><DollarSign className="w-6 h-6" /></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mitra Aktif</p>
          <div className="flex justify-between items-center">
            <h3 className="text-3xl font-black text-slate-800 tracking-tight">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : data?.kpi.totalOrganisasi || 0}
            </h3>
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Building2 className="w-6 h-6" /></div>
          </div>
        </div>
      </div>

      {/* Grafik & Tabel Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Chart Area */}
        <div className="bg-white p-6 lg:p-8 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] flex flex-col h-[450px]">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Serapan Dana (5 Kegiatan Terbaru)</h3>
          <div className="flex-1 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                  <YAxis tickFormatter={(value) => `Rp${(value/1000000).toFixed(0)}M`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                 <Tooltip 
  cursor={{ fill: '#f8fafc' }}
  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
  formatter={(value: any) => [
    typeof value === 'number' ? formatIDR(value) : value, 
    "Total Biaya"
  ]}
/>
                  <Bar dataKey="biaya" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#059669' : '#34d399'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">Tidak ada data.</div>
            )}
          </div>
        </div>

        {/* List Kegiatan Terbaru */}
        <div className="bg-white p-6 lg:p-8 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] flex flex-col h-[450px]">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Aktivitas Terkini</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {loading ? (
              <div className="py-8 text-center text-slate-400 flex flex-col items-center">
                <Loader2 className="w-6 h-6 animate-spin mb-2 text-emerald-600" />
                <span className="text-sm">Menyelaraskan data...</span>
              </div>
            ) : (
              data?.table.slice(0, 6).map((item: any, idx: number) => (
                <div key={idx} className="flex items-start justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl border border-slate-100">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-bold text-slate-800 text-sm truncate">{item.jenisKegiatan}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-white text-slate-600 rounded text-[10px] border border-slate-200 font-semibold truncate max-w-[120px]">
                        {item.organisasi}
                      </span>
                      <span className="text-xs text-slate-400 truncate">{item.lokasi}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="block text-xs font-semibold text-slate-400 mb-1">{item.tanggal}</span>
                    <span className="block text-xs font-bold text-emerald-600">{item.peserta.pemudaLaki ? 'Ada Peserta' : 'Valid'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}