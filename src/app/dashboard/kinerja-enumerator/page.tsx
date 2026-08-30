'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Award, BarChart3, CalendarClock, CheckCircle2, Search, ShieldCheck, TrendingUp, Users } from 'lucide-react';

type BaselineDashboard = {
  total?: number;
  kpis?: {
    respondents?: number;
    certified?: number;
    averageLandArea?: number;
    averageYield?: number;
  };
  enumerators?: Array<{ label: string; value: number }>;
  enumeratorPerformance?: Array<{
    name: string;
    total: number;
    latest: string;
    province?: string;
    district?: string;
    commodity?: string;
    status?: string;
    monthly?: Array<{ month: string; total: number }>;
  }>;
};

type EnumeratorStat = {
  name: string;
  total: number;
  latest: string;
  province: string;
  district: string;
  commodity: string;
  status: string;
  monthly: Array<{ month: string; total: number }>;
};

const endpoint = process.env.NEXT_PUBLIC_BASELINE_APPS_SCRIPT_URL;

const api = async <T,>(action: string, params: Record<string, string> = {}): Promise<T> => {
  if (!endpoint) throw new Error('NEXT_PUBLIC_BASELINE_APPS_SCRIPT_URL belum diatur.');

  const query = new URLSearchParams({ action, ...params });
  const response = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}${query}`, { cache: 'no-store' });
  const result = await response.json();

  if (!response.ok || result.status !== 'success') {
    throw new Error(result.message || 'Data Baseline gagal dimuat.');
  }

  return result.data as T;
};

export default function KinerjaEnumeratorPage() {
  const [enumerators, setEnumerators] = useState<EnumeratorStat[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<BaselineDashboard>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEnumerator, setSelectedEnumerator] = useState<EnumeratorStat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const dashboard = await api<BaselineDashboard>('dashboard');
        if (!active) return;

        const source = dashboard.enumeratorPerformance?.length ? dashboard.enumeratorPerformance : dashboard.enumerators ?? [];
        const nextEnumerators = source
          .filter((item) => item && typeof item === 'object' && 'name' in item ? Boolean((item as { name?: string }).name?.trim()) : Boolean((item as { label?: string }).label?.trim()))
          .map((item) => {
            const isDetailed = 'name' in item;
            const name = (isDetailed ? (item as { name?: string }).name : (item as { label?: string }).label)?.trim() ?? '';
            const total = Number(isDetailed ? (item as { total?: number }).total : (item as { value?: number }).value) || 0;
            return {
              name,
              total,
              latest: isDetailed ? (item as { latest?: string }).latest || '-' : '-',
              province: isDetailed ? (item as { province?: string }).province || 'Belum ada' : 'Belum ada',
              district: isDetailed ? (item as { district?: string }).district || 'Belum ada' : 'Belum ada',
              commodity: isDetailed ? (item as { commodity?: string }).commodity || 'Belum ada' : 'Belum ada',
              status: isDetailed ? (item as { status?: string }).status || 'Aktif' : 'Aktif',
              monthly: isDetailed ? ((item as { monthly?: Array<{ month: string; total: number }> }).monthly ?? []) : [],
            };
          })
          .sort((a, b) => b.total - a.total);

        setEnumerators(nextEnumerators);
        setError('');
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Data enumerator baseline gagal dimuat.');
        setEnumerators([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const filteredEnumerators = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return enumerators;
    return enumerators.filter((item) => item.name.toLowerCase().includes(query));
  }, [enumerators, searchTerm]);

  const formatMonthLabel = (month: string) => {
    if (!month) return 'Belum ada';
    const [year, monthNumber] = month.split('-');
    const monthIndex = Number(monthNumber) - 1;
    const date = new Date(Number(year), monthIndex, 1);
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
  };

  const topPerformer = filteredEnumerators[0] ?? null;
  const totalEntries = enumerators.reduce((sum, item) => sum + item.total, 0);
  const maxTotal = Math.max(...enumerators.map((item) => item.total), 1);
  const averageLandArea = dashboardSummary.kpis?.averageLandArea ?? 0;

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-10">
      <section className="rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-sky-600 p-7 text-white shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-100">Monitoring</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Kinerja Enumerator</h1>
            <p className="mt-3 max-w-2xl text-sm text-emerald-50/90">
              Data enumerator diambil dari baseline, sesuai nama petugas yang tercatat pada form survei baseline.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <BarChart3 className="h-5 w-5 text-emerald-100" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-100">Total kerja</p>
              <p className="text-xl font-black">{totalEntries}</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Enumerator aktif" value={enumerators.length.toString()} icon={Users} tone="emerald" />
        <MetricCard label="Responden baseline" value={String(totalEntries)} icon={ShieldCheck} tone="amber" />
        <MetricCard label="Tersertifikasi" value={String(0)} icon={TrendingUp} tone="sky" />
        <MetricCard label="Rerata luas" value={String(Math.round((Number(averageLandArea) || 0) * 10) / 10)} icon={Activity} tone="violet" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Ranking</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Performa enumerator</h2>
          </div>
          <label className="relative block w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Cari nama enumerator"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-emerald-400 focus:bg-white"
            />
          </label>
        </div>

        {loading ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Memuat data enumerator baseline...
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {filteredEnumerators.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                Tidak ada enumerator yang sesuai dengan pencarian.
              </div>
            )}

            {filteredEnumerators.slice(0, 3).map((item, index) => (
              <div key={item.name} className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.total} responden</p>
                    </div>
                  </div>
                  <Award className="h-5 w-5 text-amber-500" />
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Produktivitas</span>
                    <span>{Math.min(100, Math.round((item.total / maxTotal) * 100))}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
                      style={{ width: `${Math.min(100, Math.round((item.total / maxTotal) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Daftar</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Detail kinerja per enumerator</h2>
          </div>
          {topPerformer && (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
              <ArrowUpRight className="h-4 w-4" />
              Leader: {topPerformer.name}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-bold">Enumerator</th>
                <th className="px-5 py-3 font-bold">Total responden</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Terakhir</th>
                <th className="px-5 py-3 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredEnumerators.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                    Data tidak ditemukan.
                  </td>
                </tr>
              ) : (
                filteredEnumerators.map((item) => (
                  <tr key={item.name} className="transition hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
                          {item.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.province} • {item.commodity}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-bold text-slate-800">{item.total}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{item.status}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-slate-400" />
                        {item.latest || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedEnumerator(item)}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedEnumerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Detail enumerator</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">{selectedEnumerator.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEnumerator(null)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Total</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{selectedEnumerator.total}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Provinsi</p>
                  <p className="mt-2 text-sm font-bold text-slate-800">{selectedEnumerator.province}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Kabupaten</p>
                  <p className="mt-2 text-sm font-bold text-slate-800">{selectedEnumerator.district}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Terakhir</p>
                  <p className="mt-2 text-sm font-bold text-slate-800">{selectedEnumerator.latest}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Komoditas utama</p>
                <p className="mt-2 text-base font-bold text-slate-800">{selectedEnumerator.commodity}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Hasil per bulan</p>
                <div className="mt-3 space-y-2">
                  {selectedEnumerator.monthly?.length ? (
                    selectedEnumerator.monthly
                      .slice()
                      .sort((a, b) => a.month.localeCompare(b.month))
                      .map((item) => (
                        <div key={item.month} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                          <span className="text-sm font-medium text-slate-700">{formatMonthLabel(item.month)}</span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{item.total} responden</span>
                        </div>
                      ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                      Belum ada data bulanan untuk enumerator ini.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InsightCard
          title="Kinerja tertinggi"
          value={topPerformer ? topPerformer.name : 'Belum ada'}
          detail={topPerformer ? `${topPerformer.total} responden tercatat` : 'Data akan muncul setelah masuknya formulir.'}
          icon={Award}
        />
        <InsightCard
          title="Rata-rata responden"
          value={enumerators.length ? (Math.round((totalEntries / enumerators.length) * 10) / 10).toString() : '0'}
          detail="per enumerator"
          icon={CheckCircle2}
        />
        <InsightCard
          title="Kondisi tim"
          value={enumerators.length > 0 ? 'Aktif' : 'Menunggu'}
          detail={enumerators.length > 0 ? 'Semua enumerator baseline sudah terpantau' : 'Belum ada aktivitas input'}
          icon={ShieldCheck}
        />
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  tone: 'emerald' | 'amber' | 'sky' | 'violet';
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
  };

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      </div>
      <div className={`rounded-xl p-3 ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  );
}

function InsightCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Award;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-2xl font-black text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}
