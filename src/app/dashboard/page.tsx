 'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Activity, ArrowRight, BarChart3, CheckCircle2, ClipboardCheck, FileText, Leaf, Loader2, MapPinned, Users } from 'lucide-react';
import { db } from '../../../lib/firebase';

type FirestoreRecord = { id: string; namaPetani?: string; namaPetugas?: string; inspektur?: string; createdAt?: unknown; tanggal?: string; keputusan?: string };
type SaggdData = { kpi?: { totalKegiatan?: number; totalPeserta?: number; totalPembiayaan?: number; totalOrganisasi?: number }; table?: Array<{ jenisKegiatan?: string; organisasi?: string; lokasi?: string; tanggal?: string; totalPembiayaanItem?: number }> };
type BaselineData = { kpis?: { respondents?: number; certified?: number; averageLandArea?: number } };

const formatNumber = (value: number) => value.toLocaleString('id-ID');
const formatMoney = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;
const recordTime = (value: unknown) => {
	if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
	const parsed = new Date(String(value || '')).getTime();
	return Number.isFinite(parsed) ? parsed : 0;
};

export default function DashboardOverview() {
	const [farmers, setFarmers] = useState<FirestoreRecord[]>([]);
	const [analyses, setAnalyses] = useState<FirestoreRecord[]>([]);
	const [inspections, setInspections] = useState<FirestoreRecord[]>([]);
	const [landSurveys, setLandSurveys] = useState<FirestoreRecord[]>([]);
	const [saggd, setSaggd] = useState<SaggdData | null>(null);
	const [baseline, setBaseline] = useState<BaselineData | null>(null);
	const [loading, setLoading] = useState(true);
	const saggdUrl = process.env.NEXT_PUBLIC_SAGGD_APPS_SCRIPT_URL || '';
	const baselineUrl = process.env.NEXT_PUBLIC_BASELINE_APPS_SCRIPT_URL || '';

	useEffect(() => {
		const collections = [
			['petani', setFarmers],
			['analisaUsaha', setAnalyses],
			['inspeksiICS', setInspections],
			['dataLahan', setLandSurveys],
		] as const;
		const unsubscribers = collections.map(([name, setter]) => onSnapshot(collection(db, name), (snapshot) => setter(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })) as FirestoreRecord[]), (error) => console.error(`Gagal memuat ${name}:`, error)));
		setLoading(false);
		return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
	}, []);

	useEffect(() => {
		const loadRemote = async () => {
			const requests = await Promise.allSettled([saggdUrl ? fetch(saggdUrl).then((response) => response.json()) : Promise.reject(new Error('SAGGD URL kosong')), baselineUrl ? fetch(baselineUrl).then((response) => response.json()) : Promise.reject(new Error('Baseline URL kosong'))]);
			if (requests[0].status === 'fulfilled' && requests[0].value?.status === 'success') setSaggd(requests[0].value.data as SaggdData);
			if (requests[1].status === 'fulfilled') setBaseline(requests[1].value?.data as BaselineData);
		};
		void loadRemote();
	}, [baselineUrl, saggdUrl]);

	const latestActivity = useMemo(() => [...inspections.map((item) => ({ ...item, label: 'Inspeksi ICS', detail: item.inspektur || 'Petugas Lapang ICS' })), ...analyses.map((item) => ({ ...item, label: 'Analisa Usaha', detail: item.namaPetugas || 'Petugas belum dicatat' })), ...landSurveys.map((item) => ({ ...item, label: 'Data & Lahan', detail: item.namaPetugas || 'Petugas belum dicatat' }))].sort((a, b) => recordTime(b.createdAt) - recordTime(a.createdAt)).slice(0, 6), [analyses, inspections, landSurveys]);
	const cards = [
		{ label: 'Petani terdaftar', value: farmers.length, icon: Users, color: 'text-emerald-700', bg: 'bg-emerald-50' },
		{ label: 'Inspeksi ICS', value: inspections.length, icon: ClipboardCheck, color: 'text-amber-700', bg: 'bg-amber-50' },
		{ label: 'Analisa Usaha', value: analyses.length, icon: BarChart3, color: 'text-blue-700', bg: 'bg-blue-50' },
		{ label: 'Data & Lahan', value: landSurveys.length, icon: MapPinned, color: 'text-sky-700', bg: 'bg-sky-50' },
	];
	const quickLinks = [
		['/dashboard/appoli', 'Dashboard Appoli', 'Kelola petani, lahan, dan seluruh dokumen', Leaf],
		['/dashboard/baseline', 'Baseline', 'Pantau responden dan status sertifikasi', FileText],
		['/dashboard/saggd', 'SAGGD', 'Analisis kegiatan dan pembiayaan', Activity],
	] as const;

	return <main className="mx-auto max-w-7xl space-y-8 pb-10"><section className="relative overflow-hidden rounded-2xl bg-slate-950 p-7 text-white shadow-xl sm:p-10"><div className="relative z-10 max-w-2xl"><p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">SIM-API / Pusat Monitoring</p><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Selamat datang di ruang kerja data petani.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Pantau data lapangan, dokumen sertifikasi, kegiatan, dan tindak lanjut dalam satu tempat.</p></div><div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[36px] border-emerald-500/20" /><div className="absolute bottom-[-100px] right-32 h-56 w-56 rounded-full border-[24px] border-sky-400/10" /></section>
		<section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(({ label, value, icon: Icon, color, bg }) => <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-3xl font-black text-slate-900">{loading ? <Loader2 className="h-6 w-6 animate-spin text-slate-400" /> : formatNumber(value)}</p></div><div className={`rounded-xl p-3 ${bg} ${color}`}><Icon className="h-6 w-6" /></div></div>)}</section>
		<section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]"><div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><h2 className="text-lg font-bold text-slate-900">Aktivitas terbaru</h2><p className="mt-1 text-xs text-slate-500">Perubahan terakhir dari formulir Appoli</p></div><Link href="/dashboard/appoli" className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">Buka data <ArrowRight className="h-4 w-4" /></Link></div><div className="divide-y divide-slate-100">{latestActivity.length === 0 ? <p className="p-6 text-sm text-slate-500">Belum ada aktivitas tersimpan.</p> : latestActivity.map((item) => <div key={`${item.label}-${item.id}`} className="flex items-center gap-4 p-4"><span className="rounded-lg bg-slate-100 p-2 text-slate-600"><CheckCircle2 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-800">{item.namaPetani || 'Data tanpa nama petani'}</p><p className="text-xs text-slate-500">{item.label} · {item.detail}</p></div><time className="text-xs text-slate-400">{item.tanggal || (item.createdAt ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'short' }).format(recordTime(item.createdAt)) : '-')}</time></div>)}</div></div><div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Ringkasan sumber data</h2><div className="mt-5 space-y-4"><Summary label="Kegiatan SAGGD" value={formatNumber(saggd?.kpi?.totalKegiatan || 0)} status={saggd ? 'Tersinkron' : 'Menunggu data'} /><Summary label="Peserta SAGGD" value={formatNumber(saggd?.kpi?.totalPeserta || 0)} status={saggd ? 'Tersinkron' : 'Menunggu data'} /><Summary label="Responden Baseline" value={formatNumber(baseline?.kpis?.respondents || 0)} status={baseline ? 'Tersinkron' : 'Menunggu data'} /><Summary label="Organisasi SAGGD" value={formatNumber(saggd?.kpi?.totalOrganisasi || 0)} status={saggd ? 'Tersinkron' : 'Menunggu data'} /></div></div></section>
		<section><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Navigasi kerja</p><h2 className="mt-1 text-2xl font-black text-slate-900">Pilih modul yang ingin dipantau</h2></div></div><div className="grid gap-4 md:grid-cols-3">{quickLinks.map(([href, title, description, Icon]) => <Link key={href} href={href} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"><div className="flex items-start justify-between"><span className="rounded-lg bg-emerald-50 p-3 text-emerald-700"><Icon className="h-5 w-5" /></span><ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:text-emerald-600" /></div><h3 className="mt-5 font-bold text-slate-900">{title}</h3><p className="mt-1 text-sm leading-5 text-slate-500">{description}</p></Link>)}</div></section>
	</main>;
}

function Summary({ label, value, status }: { label: string; value: string; status: string }) { return <div className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0"><div><p className="text-sm font-semibold text-slate-700">{label}</p><p className="mt-1 text-xs text-slate-400">{status}</p></div><p className="text-xl font-black text-slate-900">{value}</p></div>; }
