'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Activity, Eye, Leaf, Loader2, Map, Plus, Search, Sprout, Tractor, Users } from 'lucide-react';
import { db } from '../../../../lib/firebase';
import PetaniFormModal from './petani-form-modal';

type Lahan = {
  luasLahan?: string;
  komoditas?: string;
};

type Petani = {
  idPetani: string;
  namaPetani: string;
  kelompokTani: string;
  komoditasUtama: string;
  lahanUtama?: Lahan;
};

type AnalisaUsahaRow = {
  waktu?: string;
  volume?: number | string;
  harga?: number | string;
  keterangan?: string;
};

type AnalisaUsaha = {
  id: string;
  petaniId: string;
  namaPetani: string;
  kelompokTani: string;
  luasLahan?: string;
  varietas?: string;
  musimTanam?: string;
  totalBiaya?: number;
  totalHasilProduksi?: number;
  labaRugiNetto?: number;
  formData?: Record<string, AnalisaUsahaRow>;
  createdAt?: unknown;
};

function getLuasHektare(value?: string): number {
  if (!value) return 0;

  const numberValue = Number(value.replace(',', '.').match(/[\d.]+/)?.[0]);
  if (Number.isNaN(numberValue)) return 0;
  return /ha/i.test(value) ? numberValue : /m[²2]/i.test(value) ? numberValue / 10000 : 0;
}

export default function DashboardAppoli() {
  const [petani, setPetani] = useState<Petani[]>([]);
  const [analisaUsaha, setAnalisaUsaha] = useState<AnalisaUsaha[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAnalisa, setSelectedAnalisa] = useState<AnalisaUsaha | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'petani'),
      (snapshot) => {
        setPetani(snapshot.docs.map((document) => ({
          idPetani: document.id,
          ...document.data(),
        })) as Petani[]);
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Gagal memuat data petani:', snapshotError);
        setError('Data petani belum dapat dimuat. Periksa koneksi atau hak akses Firestore.');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'analisaUsaha'),
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...(document.data() as Omit<AnalisaUsaha, 'id'>),
        })) as AnalisaUsaha[];

        setAnalisaUsaha(data.sort((a, b) => {
          const aTime = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
          const bTime = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
          return bTime - aTime;
        }));
      },
      (snapshotError) => {
        console.error('Gagal memuat data analisa usaha:', snapshotError);
      }
    );

    return unsubscribe;
  }, []);

  const stats = useMemo(() => {
    const totalLuas = petani.reduce((total, item) => total + getLuasHektare(item.lahanUtama?.luasLahan), 0);
    const komoditas = new Set(petani.map((item) => item.komoditasUtama).filter(Boolean));
    const kelompok = new Set(petani.map((item) => item.kelompokTani).filter(Boolean));

    return [
      { label: 'Total Petani', value: petani.length.toLocaleString('id-ID'), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'Total Luas Lahan', value: `${totalLuas.toLocaleString('id-ID', { maximumFractionDigits: 2 })} Ha`, icon: Map, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'Komoditas Aktif', value: komoditas.size.toLocaleString('id-ID'), icon: Sprout, color: 'text-amber-600', bg: 'bg-amber-50' },
      { label: 'Kelompok Tani', value: kelompok.size.toLocaleString('id-ID'), icon: Tractor, color: 'text-violet-600', bg: 'bg-violet-50' },
    ];
  }, [petani]);

  const filteredPetani = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return petani;

    return petani.filter((item) =>
      [item.idPetani, item.namaPetani, item.kelompokTani, item.komoditasUtama]
        .some((value) => value?.toLowerCase().includes(keyword))
    );
  }, [petani, searchTerm]);

  const getPreviewRowTotal = (row?: AnalisaUsahaRow) => {
    const volume = Number(row?.volume ?? 0) || 0;
    const harga = Number(row?.harga ?? 0) || 0;
    return volume * harga;
  };

  const previewRows = useMemo(() => {
    if (!selectedAnalisa?.formData) return [];

    return Object.entries(selectedAnalisa.formData)
      .map(([key, row]) => {
        const total = getPreviewRowTotal(row);
        const hasValue = !!(
          total ||
          row?.waktu ||
          row?.keterangan ||
          row?.volume ||
          row?.harga
        );

        if (!hasValue) return null;

        return {
          key,
          label: key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase()),
          volume: Number(row?.volume ?? 0) || 0,
          harga: Number(row?.harga ?? 0) || 0,
          total,
          keterangan: row?.keterangan || '-',
        };
      })
      .filter(Boolean) as Array<{
        key: string;
        label: string;
        volume: number;
        harga: number;
        total: number;
        keterangan: string;
      }>;
  }, [selectedAnalisa]);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Appoli</h1>
          <p className="text-sm text-slate-500">Ringkasan data petani yang tersinkron secara real-time dari Firestore.</p>
        </div>
        <button type="button" onClick={() => setIsFormOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Tambah Petani
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className={`rounded-lg p-3 ${stat.bg} ${stat.color}`}><Icon className="w-6 h-6" /></div>
              <div><p className="text-sm font-medium text-slate-500">{stat.label}</p><p className="text-2xl font-bold text-slate-900">{stat.value}</p></div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2"><Users className="w-5 h-5 text-emerald-600" /><h2 className="text-lg font-bold text-slate-800">Data Petani</h2></div>
            <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 w-4 -translate-y-1/2 text-slate-400" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Cari ID, nama, kelompok..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" /></div>
          </div>
          {error ? <p className="p-6 text-sm text-rose-600">{error}</p> : loading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-500"><Loader2 className="w-5 animate-spin text-emerald-600" />Memuat data petani...</div> : (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-600"><thead className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">ID & Nama</th><th className="px-5 py-3">Kelompok / Komoditas</th><th className="px-5 py-3">Luas Lahan</th><th className="px-5 py-3 text-center">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredPetani.length === 0 ? <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">Belum ada data petani yang sesuai.</td></tr> : filteredPetani.map((item) => <tr key={item.idPetani} className="hover:bg-slate-50"><td className="px-5 py-3"><p className="font-semibold text-slate-900">{item.namaPetani}</p><p className="font-mono text-xs text-slate-500">{item.idPetani}</p></td><td className="px-5 py-3"><p className="font-medium text-slate-800">{item.kelompokTani}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600"><Sprout className="w-3 h-3" />{item.komoditasUtama}</p></td><td className="px-5 py-3 font-medium">{item.lahanUtama?.luasLahan || '—'}</td><td className="px-5 py-3 text-center"><button type="button" onClick={() => setIsFormOpen(true)} title="Tambah profil petani" className="inline-flex rounded-md p-1.5 text-blue-600 transition hover:bg-blue-50"><Eye className="w-4 h-4" /></button></td></tr>)}</tbody></table></div>
          )}
        </section>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 p-5"><h2 className="flex items-center gap-2 text-lg font-bold text-slate-800"><Activity className="w-5 h-5 text-blue-600" />Status Data</h2></div>
          <div className="space-y-4 p-5 text-sm"><div className="flex gap-3"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" /><div><p className="font-semibold text-slate-800">Firestore tersambung</p><p className="text-slate-500">Daftar dan ringkasan diperbarui otomatis saat data berubah.</p></div></div><div className="flex gap-3"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" /><div><p className="font-semibold text-slate-800">Data siap dikelola</p><p className="text-slate-500">Tambahkan profil petani melalui tombol di atas.</p></div></div><div className="rounded-lg bg-emerald-50 p-4 text-emerald-800"><Leaf className="mb-2 w-5" /><p className="font-semibold">{petani.length} profil petani tercatat</p></div></div>
        </aside>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 p-5">
          <Leaf className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-800">Daftar Analisa Usaha</h2>
        </div>

        {analisaUsaha.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Belum ada data analisa usaha yang tersimpan.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Petani</th>
                  <th className="px-5 py-3">Kelompok</th>
                  <th className="px-5 py-3">Luas</th>
                  <th className="px-5 py-3">Biaya</th>
                  <th className="px-5 py-3">Hasil</th>
                  <th className="px-5 py-3">Laba/Rugi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analisaUsaha.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-900">{item.namaPetani}</p>
                      <p className="font-mono text-[11px] text-slate-500">{item.petaniId}</p>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700">{item.kelompokTani || '-'}</td>
                    <td className="px-5 py-3 text-slate-700">{item.luasLahan || '-'}</td>
                    <td className="px-5 py-3 text-slate-700">Rp {Number(item.totalBiaya || 0).toLocaleString('id-ID')}</td>
                    <td className="px-5 py-3 text-slate-700">Rp {Number(item.totalHasilProduksi || 0).toLocaleString('id-ID')}</td>
                    <td className={`px-5 py-3 font-semibold ${Number(item.labaRugiNetto || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      Rp {Number(item.labaRugiNetto || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedAnalisa(item)}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedAnalisa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700">Preview PDF</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900">Analisa Usaha Tani</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAnalisa(null)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="p-5 text-slate-800 print:p-0">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-5 border-b border-slate-200 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-black text-emerald-700">
                        APPOLI
                      </div>
                      <div>
                        <div className="text-lg font-black text-slate-900">Aliansi Petani Padi dan Palawija Organik</div>
                        <div className="text-xs text-slate-500">Boyolali</div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div className="font-bold text-slate-700">No. Form</div>
                      <div>{selectedAnalisa.petaniId || '—'}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Nama Petani</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{selectedAnalisa.namaPetani || '-'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Kelompok Tani</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{selectedAnalisa.kelompokTani || '-'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Kode Petani</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{selectedAnalisa.petaniId || '-'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Luas Lahan</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{selectedAnalisa.luasLahan || '-'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Varietas</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{selectedAnalisa.varietas || '-'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Musim Tanam</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{selectedAnalisa.musimTanam || '-'}</div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-xs text-slate-700">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="border border-slate-700 px-2 py-2 text-left">Kegiatan</th>
                        <th className="border border-slate-700 px-2 py-2 text-right">Volume</th>
                        <th className="border border-slate-700 px-2 py-2 text-right">Harga</th>
                        <th className="border border-slate-700 px-2 py-2 text-right">Total</th>
                        <th className="border border-slate-700 px-2 py-2 text-left">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row.key} className="bg-white">
                          <td className="border border-slate-200 px-2 py-2 font-semibold text-slate-800">{row.label}</td>
                          <td className="border border-slate-200 px-2 py-2 text-right">{row.volume}</td>
                          <td className="border border-slate-200 px-2 py-2 text-right">{row.harga.toLocaleString('id-ID')}</td>
                          <td className="border border-slate-200 px-2 py-2 text-right font-bold text-slate-900">{row.total.toLocaleString('id-ID')}</td>
                          <td className="border border-slate-200 px-2 py-2 text-left text-slate-600">{row.keterangan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">Total Biaya</div>
                    <div className="mt-1 text-lg font-black text-amber-900">Rp {Number(selectedAnalisa.totalBiaya || 0).toLocaleString('id-ID')}</div>
                  </div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Hasil Produksi</div>
                    <div className="mt-1 text-lg font-black text-sky-900">Rp {Number(selectedAnalisa.totalHasilProduksi || 0).toLocaleString('id-ID')}</div>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700">Laba / Rugi Netto</div>
                    <div className="mt-1 text-lg font-black text-emerald-900">Rp {Number(selectedAnalisa.labaRugiNetto || 0).toLocaleString('id-ID')}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedAnalisa(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                Cetak PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <PetaniFormModal open={isFormOpen} onClose={() => setIsFormOpen(false)} />
    </div>
  );
}
