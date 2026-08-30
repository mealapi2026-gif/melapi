"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  Download,
  Loader2,
  MapPinned,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { toJpeg, toPng, toSvg } from "html-to-image";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import logoSimApi from "../../../../public/images/logo-sim-api.png";

type CountItem = { label: string; value: number };
type Summary = {
  count: number;
  mean: number;
  median: number;
  min: number;
  max: number;
};
type ProductMetric = { commodity: string; yieldPerHa: Summary };
type EconomyMetric = {
  commodity: string;
  cost: Summary;
  income: Summary;
  margin: Summary;
  roi: Summary;
};
type MapPoint = {
  lat: number;
  lng: number;
  province: string;
  commodity: string;
  farmerName: string;
};
type Dashboard = {
  total: number;
  kpis: {
    respondents: number;
    averageLandArea: number;
    averageYield: number;
    certified: number;
  };
};
type Options = {
  provinces: string[];
  commodities: string[];
  districts: string[];
  subdistricts: string[];
  villages: string[];
};
type SurveyTable = {
  headers: string[];
  rows: { id: string; cells: string[] }[];
  total: number;
};
type SurveyDetail = {
  farmerName: string;
  enumerator: string;
  fields: { label: string; value: string }[];
  photos?: { label: string; fileId: string }[];
};
type Analytics = {
  trends?: { day: string; responses: number }[];
  statistics?: { landArea?: Summary; yieldKg?: Summary };
  productivity?: ProductMetric[];
  economics?: EconomyMetric[];
  outliers?: { count?: number; lowerBound?: number; upperBound?: number };
  quality?: {
    uniqueResponses?: number;
    duplicateResponses?: number;
    missingCoordinates?: number;
    missingIdentity?: number;
    coordinateCoverage?: number;
    certificationRate?: number;
    economicCoverage?: number;
    columnMapping?: {
      unresolved?: string[];
      resolved?: number;
      required?: number;
    };
  };
  agroecology?: {
    stage?: CountItem[];
    organicInputs?: CountItem[];
    chemicalFertilizer?: CountItem[];
    chemicalPesticide?: CountItem[];
    seedSources?: CountItem[];
    companionPlants?: CountItem[];
    soilWaterConservation?: CountItem[];
    pestControl?: CountItem[];
    wasteReuse?: CountItem[];
    bufferProtection?: CountItem[];
    ecosystemProtection?: CountItem[];
    agroecologyInterest?: CountItem[];
  };
  profile?: { maritalStatus?: CountItem[]; cooperativeMembership?: CountItem[] };
  land?: { contaminationRisks?: CountItem[] };
  commodity?: {
    main?: CountItem[];
    varieties?: CountItem[];
    farmingPatterns?: CountItem[];
    plantingMethods?: CountItem[];
    agroecologyStage?: CountItem[];
  };
  farmManagement?: { recordKeeping?: CountItem[]; qualityStandards?: CountItem[] };
  results?: {
    performance?: CountItem[];
    increase?: CountItem[];
    decrease?: CountItem[];
    suggestionsCount?: number;
  };
  market?: { salesChannels?: CountItem[]; certification?: CountItem[] };
  support?: { cooperative?: CountItem[]; government?: CountItem[] };
  financialLiteracy?: {
    levels?: CountItem[];
    savingHabits?: CountItem[];
    savingLocations?: CountItem[];
    capitalSources?: CountItem[];
  };
  monitoring?: {
    provinces?: CountItem[];
    districts?: CountItem[];
    subdistricts?: CountItem[];
    villages?: CountItem[];
    commodities?: CountItem[];
    gender?: CountItem[];
    education?: CountItem[];
    youth?: CountItem[];
    landStatus?: CountItem[];
    waterSources?: CountItem[];
  };
  risks?: CountItem[];
  resilience?: {
    overall?: number;
    level?: string;
    dimensions?: { label: string; score: number }[];
    distribution?: CountItem[];
  };
  insights?: string[];
};

const endpoint = process.env.NEXT_PUBLIC_BASELINE_APPS_SCRIPT_URL;
const number = (value: number, digits = 0) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(
    value || 0,
  );
const money = (value: number) => `Rp${number(value)}`;
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#039;",
        '"': "&quot;",
      })[char] || char,
  );

async function api<T>(
  action: string,
  params: Record<string, string> = {},
): Promise<T> {
  if (!endpoint)
    throw new Error("NEXT_PUBLIC_BASELINE_APPS_SCRIPT_URL belum diatur.");
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch(
    `${endpoint}${endpoint.includes("?") ? "&" : "?"}${query}`,
    { cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok || result.status !== "success")
    throw new Error(result.message || "Data Baseline gagal dimuat.");
  return result.data as T;
}

export default function BaselinePage() {
  const [options, setOptions] = useState<Options>({
    provinces: [],
    commodities: [],
    districts: [],
    subdistricts: [],
    villages: [],
  });
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [village, setVillage] = useState("");
  const [commodity, setCommodity] = useState("");
  const [page, setPage] = useState(0);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [mapPoints, setMapPoints] = useState<MapPoint[]>([]);
  const [table, setTable] = useState<SurveyTable | null>(null);
  const [detail, setDetail] = useState<SurveyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<
    { id: string; role: "user" | "assistant"; content: string }[]
  >([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Saya siap membantu meringkas data dashboard. Coba tanya soal jumlah responden, komoditas utama, anomali data, atau prioritas program.",
    },
  ]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [activeSection, setActiveSection] = useState("ringkasan");
  const dataRequestRef = useRef(0);
  const optionsRequestRef = useRef(0);
  const filters = useCallback(
    () => ({ province, district, subdistrict, village, commodity }),
    [province, district, subdistrict, village, commodity],
  );
  const load = useCallback(async () => {
    const requestId = ++dataRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const current = filters();
      const [nextDashboard, nextAnalytics, nextMapPoints, nextTable] =
        await Promise.all([
          api<Dashboard>("dashboard", current),
          api<Analytics>("analytics", current),
          api<MapPoint[]>("map", current),
          api<SurveyTable>("table", {
            ...current,
            page: String(page),
            pageSize: "20",
          }),
        ]);
      if (requestId !== dataRequestRef.current) return;
      setDashboard(nextDashboard);
      setAnalytics(nextAnalytics);
      setMapPoints(nextMapPoints);
      setTable(nextTable);
    } catch (cause) {
      if (requestId !== dataRequestRef.current) return;
      setError(
        cause instanceof Error ? cause.message : "Data Baseline gagal dimuat.",
      );
    } finally {
      if (requestId === dataRequestRef.current) setLoading(false);
    }
  }, [filters, page]);
  useEffect(() => {
    const requestId = ++optionsRequestRef.current;
    setOptionsLoading(true);
    Promise.resolve().then(async () => {
      try {
        const nextOptions = await api<Options>("options", {
          province,
          district,
          subdistrict,
        });
        if (requestId === optionsRequestRef.current) setOptions(nextOptions);
      } catch (cause) {
        if (requestId !== optionsRequestRef.current) return;
        setError(
          cause instanceof Error ? cause.message : "Filter gagal dimuat.",
        );
      } finally {
        if (requestId === optionsRequestRef.current) setOptionsLoading(false);
      }
    });
  }, [province, district, subdistrict]);
  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);
  const openDetail = async (id: string) => {
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await api<SurveyDetail>("detail", { id }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Detail gagal dimuat.");
    } finally {
      setDetailLoading(false);
    }
  };
  const quality = analytics?.quality;
  const productivity = analytics?.productivity ?? [];
  const economics = analytics?.economics ?? [];
  const resilience = analytics?.resilience ?? {
    overall: 0,
    level: "Belum ada data",
    dimensions: [],
    distribution: [],
  };
  const activeFilterCount = [province, district, subdistrict, village, commodity].filter(Boolean).length;
  const priorityRisk = analytics?.risks?.[0]?.label || "Belum ada risiko terpetakan";
  const weakestDimensions = [...(resilience.dimensions ?? [])]
    .sort((left, right) => left.score - right.score)
    .slice(0, 2)
    .map((item) => item.label)
    .join(" dan ") || "data belum lengkap";
  const dashboardSections = [
    ["ringkasan", "Ringkasan"], ["profil", "Profil"], ["lahan", "Lahan"],
    ["komoditas", "Komoditas"], ["budidaya", "Budidaya"], ["usaha", "Usaha"],
    ["ketahanan", "Ketahanan"], ["tindak-lanjut", "Tindak lanjut"],
  ];
  const askAssistant = useCallback(
    async (question: string) => {
      const clean = question.trim();
      if (!clean || assistantLoading) return;
      setAssistantMessages((messages) => [
        ...messages,
        { id: `user-${Date.now()}`, role: "user", content: clean },
      ]);
      setAssistantInput("");
      setAssistantLoading(true);
      const payload = {
        question: clean,
        filters: {
          province: province || "",
          district: district || "",
          subdistrict: subdistrict || "",
          village: village || "",
          commodity: commodity || "",
        },
        dashboard: {
          respondents: dashboard?.kpis.respondents ?? 0,
          certified: dashboard?.kpis.certified ?? 0,
          averageLandArea: dashboard?.kpis.averageLandArea ?? 0,
          averageYield: dashboard?.kpis.averageYield ?? 0,
        },
        analytics: {
          coordinateCoverage: quality?.coordinateCoverage ?? 0,
          economicCoverage: quality?.economicCoverage ?? 0,
          certificationRate: quality?.certificationRate ?? 0,
          missingCoordinates: quality?.missingCoordinates ?? 0,
          missingIdentity: quality?.missingIdentity ?? 0,
          topCommodity: analytics?.monitoring?.commodities?.[0],
          topRisk: analytics?.risks?.[0],
          topProvince: analytics?.monitoring?.provinces?.[0],
          topDistrict: analytics?.monitoring?.districts?.[0],
        },
      };
      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await response.json()) as {
          answer?: string;
          error?: string;
        };
        const answer =
          result.answer ||
          result.error ||
          "Gemini belum mengirim jawaban. Silakan coba lagi.";
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: `assistant-${Date.now() + 1}`,
            role: "assistant",
            content: answer,
          },
        ]);
      } catch {
        setAssistantMessages((messages) => [
          ...messages,
          {
            id: `assistant-${Date.now() + 2}`,
            role: "assistant",
            content:
              "Saya mengalami gangguan saat mengambil jawaban. Silakan coba lagi.",
          },
        ]);
      } finally {
        setAssistantLoading(false);
      }
    },
    [
      analytics,
      assistantLoading,
      commodity,
      dashboard,
      district,
      province,
      quality,
    ],
  );
  const kpis: [string, string, string, typeof Users][] = [
    [
      "Respons unik",
      number(dashboard?.kpis.respondents ?? 0),
      "Hasil deduplikasi respons",
      Users,
    ],
    [
      "Cakupan geotag",
      `${number(quality?.coordinateCoverage ?? 0, 1)}%`,
      `${number(quality?.missingCoordinates ?? 0)} respons tanpa GPS`,
      MapPinned,
    ],
    [
      "Data ekonomi valid",
      `${number(quality?.economicCoverage ?? 0, 1)}%`,
      "Biaya dan pendapatan terisi",
      BarChart3,
    ],
    [
      "Sertifikasi aktif",
      `${number(quality?.certificationRate ?? 0, 1)}%`,
      `${number(dashboard?.kpis.certified ?? 0)} responden tersertifikasi`,
      BarChart3,
    ],
  ];
  return (
    <main
      className="baseline-report mx-auto max-w-7xl space-y-7 p-5 sm:p-8"
      aria-busy={loading || optionsLoading}
    >
      {(loading || optionsLoading) && <DataLoadingOverlay />}
      <header className="flex flex-col justify-between gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-800 to-emerald-900 p-6 text-white shadow-xl shadow-slate-950/15 sm:flex-row sm:items-center sm:p-8">
        <div>
          <p className="text-xs font-bold tracking-[.2em] text-emerald-200">
            SIM-API · BASELINE ANALYTICS
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Hasil Survey Baseline Petani Tahun 2026
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Dasbor analitik untuk melihat cakupan, kondisi usaha tani, risiko,
            praktik agroekologi, dan kualitas data secara terpadu.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold backdrop-blur hover:bg-white/25 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Perbarui data
        </button>
      </header>
      {error && (
        <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-3 xl:items-end">
        <Filter
          label="Provinsi"
          value={province}
          onChange={(value) => {
            setProvince(value);
            setDistrict("");
            setSubdistrict("");
            setVillage("");
            setPage(0);
          }}
          values={options.provinces}
          empty="Semua provinsi"
        />
        <Filter
          label="Kabupaten"
          value={district}
          onChange={(value) => {
            setDistrict(value);
            setSubdistrict("");
            setVillage("");
            setPage(0);
          }}
          values={options.districts}
          empty="Semua kabupaten"
        />
        <Filter
          label="Kecamatan"
          value={subdistrict}
          onChange={(value) => {
            setSubdistrict(value);
            setVillage("");
            setPage(0);
          }}
          values={options.subdistricts}
          empty="Semua kecamatan"
        />
        <Filter
          label="Desa / Kelurahan"
          value={village}
          onChange={(value) => {
            setVillage(value);
            setPage(0);
          }}
          values={options.villages}
          empty="Semua desa / kelurahan"
        />
        <Filter
          label="Komoditas"
          value={commodity}
          onChange={(value) => {
            setCommodity(value);
            setPage(0);
          }}
          values={options.commodities}
          empty="Semua komoditas"
        />
        <button
          type="button"
          onClick={() => {
            setProvince("");
            setDistrict("");
            setSubdistrict("");
            setVillage("");
            setCommodity("");
            setPage(0);
          }}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          Reset filter
        </button>
      </section>
      <nav
        aria-label="Navigasi bagian dashboard"
        className="-mx-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white px-2 py-2 shadow-sm"
      >
        <div className="flex min-w-max items-center gap-1">
          {dashboardSections.map(([target, label]) => (
            <button
              key={target}
              type="button"
              onClick={() => setActiveSection(target)}
              aria-pressed={activeSection === target}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                activeSection === target
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      {activeSection === "ringkasan" && (
      <section id="ringkasan" className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Ringkasan eksekutif</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">Prioritas monitoring berdasarkan filter aktif</h2>
          </div>
          <span className="text-sm text-slate-500">{activeFilterCount ? `${activeFilterCount} filter aktif` : "Seluruh respons"}</span>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <article className="rounded-2xl border border-white bg-white/90 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Ketahanan usaha</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{number(resilience.overall ?? 0)}</p>
            <p className="mt-1 text-sm font-semibold text-emerald-700">{resilience.level || "Belum ada data"} · Fokus: {weakestDimensions}</p>
          </article>
          <article className="rounded-2xl border border-white bg-white/90 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Risiko prioritas</p>
            <p className="mt-2 text-base font-bold leading-6 text-slate-900">{priorityRisk}</p>
            <p className="mt-1 text-sm text-slate-500">Risiko dengan respons terbanyak pada cakupan saat ini.</p>
          </article>
          <article className="rounded-2xl border border-white bg-white/90 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Kesiapan data</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{number(quality?.economicCoverage ?? 0, 1)}%</p>
            <p className="mt-1 text-sm text-slate-500">Data ekonomi valid · GPS {number(quality?.coordinateCoverage ?? 0, 1)}%</p>
          </article>
        </div>
      </section>
      )}
      {activeSection === "profil" && (
      <section id="profil" className="space-y-5">
        <CategoryTitle
          number="1"
          title="Profil Petani"
          text="Karakteristik petani dan rumah tangga: gender, pendidikan, status perkawinan, keanggotaan koperasi, serta keterlibatan pemuda."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(([label, value, note, Icon]) => (
            <article
              key={label}
              className="group rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {label}
                </p>
                <Icon className="h-5 w-5 text-emerald-600" />
              </div>
              <strong className="mt-4 block text-3xl tracking-tight text-slate-900">
                {value}
              </strong>
              <p className="mt-2 text-xs text-slate-500">{note}</p>
            </article>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <Distribution
            title="Profil Gender"
            items={analytics?.monitoring?.gender}
            chart="donut"
          />
          <Distribution
            title="Pendidikan Terakhir"
            items={analytics?.monitoring?.education}
          />
          <Distribution
            title="Keterlibatan Pemuda"
            items={analytics?.monitoring?.youth}
            chart="donut"
          />
          <Distribution
            title="Status Perkawinan"
            items={analytics?.profile?.maritalStatus}
            chart="donut"
          />
          <Distribution
            title="Keanggotaan Koperasi"
            items={analytics?.profile?.cooperativeMembership}
            chart="donut"
          />
        </div>
        <article
          data-chart
          className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <SectionTitle
              title="Tren Pengisian Survei"
              text="Jumlah respons per hari, maksimal tujuh tanggal pengisian terbaru."
            />
            <DownloadChartButton title="Tren Pengisian Survei" />
          </div>
          <div className="mt-4 h-72">
            {analytics?.trends?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="responses"
                    name="Respons"
                    stroke="#059669"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    animationDuration={650}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty />
            )}
          </div>
        </article>
      </section>
      )}
      {activeSection === "lahan" && (
      <section id="lahan" className="space-y-5">
        <CategoryTitle
          number="2"
          title="Informasi Lahan / Unit Usaha"
          text="Sebaran wilayah, lokasi geotag, luas, status penguasaan lahan, sumber air, dan risiko pencemaran."
        />
        <div className="grid gap-5 xl:grid-cols-3">
          <LeafletMap points={mapPoints} />
          <article className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <SectionTitle
              title="Ringkasan Lahan"
              text="Statistik luas lahan dari respons yang terisi valid."
            />
            <div className="mt-4 space-y-4 text-sm">
              <Metric
                label="Median luas lahan"
                value={`${number((analytics?.statistics?.landArea?.median ?? 0) / 10000, 2)} ha`}
              />
              <Metric
                label="Rentang luas lahan"
                value={`${number((analytics?.statistics?.landArea?.min ?? 0) / 10000, 2)}–${number((analytics?.statistics?.landArea?.max ?? 0) / 10000, 2)} ha`}
              />
            </div>
          </article>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <Distribution
            title="Sebaran Provinsi"
            items={analytics?.monitoring?.provinces}
          />
          <Distribution
            title="Sebaran Kabupaten"
            items={analytics?.monitoring?.districts}
          />
          <Distribution
            title="Sebaran Kecamatan"
            items={analytics?.monitoring?.subdistricts}
          />
          <Distribution
            title="Sebaran Desa / Kelurahan"
            items={analytics?.monitoring?.villages}
          />
          <Distribution
            title="Kepemilikan Lahan"
            items={analytics?.monitoring?.landStatus}
          />
          <Distribution
            title="Sumber Air Utama"
            items={analytics?.monitoring?.waterSources}
          />
          <Distribution
            title="Risiko Pencemaran Lahan"
            items={analytics?.land?.contaminationRisks}
          />
        </div>
      </section>
      )}
      {activeSection === "komoditas" && (
      <section id="komoditas" className="space-y-5">
        <CategoryTitle
          number="3"
          title="Informasi Komoditas"
          text="Komoditas utama, pola usaha tani, metode tanam, dan tahap penerapan agroekologi sesuai bagian Informasi Komoditas pada kuesioner."
        />
        <div className="grid gap-5 xl:grid-cols-3">
          <ChartCard
            title="Produktivitas per Komoditas"
            text="Rata-rata hasil panen per hektare dari respons dengan data valid."
          >
            <BarChart
              data={productivity.map((item) => ({
                komoditas: item.commodity,
                produktivitas: Math.round(item.yieldPerHa.mean),
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="komoditas" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => `${number(Number(value))} kg/ha`}
              />
              <Bar
                dataKey="produktivitas"
                name="Produktivitas"
                fill="#059669"
                radius={[5, 5, 0, 0]}
                animationDuration={650}
              />
            </BarChart>
          </ChartCard>
          <article className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <SectionTitle
              title="Ringkasan Hasil Panen"
              text="Nilai hasil panen dari respons yang terisi valid."
            />
            <div className="mt-4 space-y-4 text-sm">
              <Metric
                label="Median hasil panen"
                value={`${number(analytics?.statistics?.yieldKg?.median ?? 0)} kg`}
              />
              <Metric
                label="Rentang hasil panen"
                value={`${number(analytics?.statistics?.yieldKg?.min ?? 0)}–${number(analytics?.statistics?.yieldKg?.max ?? 0)} kg`}
              />
            </div>
          </article>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <Distribution
            title="Komoditas Utama"
            items={analytics?.commodity?.main}
            chart="donut"
          />
          <Distribution
            title="Varietas Komoditas"
            items={analytics?.commodity?.varieties}
          />
          <Distribution
            title="Pola Usaha Tani"
            items={analytics?.commodity?.farmingPatterns}
          />
          <Distribution
            title="Metode Tanam"
            items={analytics?.commodity?.plantingMethods}
          />
          <Distribution
            title="Tahap Praktik Agroekologi"
            items={analytics?.commodity?.agroecologyStage}
            chart="donut"
          />
        </div>
      </section>
      )}
      {activeSection === "budidaya" && (
      <section id="budidaya">
        <details className="group rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 marker:content-none">
            <CategoryTitle
              number="4"
              title="Praktik Budidaya & Agroekologi"
              text="Penggunaan input, pengelolaan lahan dan air, pengendalian hama, perlindungan ekosistem, serta minat menerapkan agroekologi."
            />
            <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180" />
          </summary>
          <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <Distribution
            title="Input Organik"
            items={analytics?.agroecology?.organicInputs}
          />
          <Distribution
            title="Pengurangan Pupuk Kimia"
            items={analytics?.agroecology?.chemicalFertilizer}
          />
          <Distribution
            title="Pengurangan Pestisida"
            items={analytics?.agroecology?.chemicalPesticide}
          />
          <Distribution
            title="Asal Benih / Bibit"
            items={analytics?.agroecology?.seedSources}
          />
          <Distribution
            title="Tanaman Pendamping / Refugia"
            items={analytics?.agroecology?.companionPlants}
            chart="donut"
          />
          <Distribution
            title="Konservasi Tanah dan Air"
            items={analytics?.agroecology?.soilWaterConservation}
          />
          <Distribution
            title="Pengendalian Hama"
            items={analytics?.agroecology?.pestControl}
          />
          <Distribution
            title="Pemanfaatan Limbah Organik"
            items={analytics?.agroecology?.wasteReuse}
            chart="donut"
          />
          <Distribution
            title="Perlindungan Batas Lahan"
            items={analytics?.agroecology?.bufferProtection}
            chart="donut"
          />
          <Distribution
            title="Perlindungan Ekosistem"
            items={analytics?.agroecology?.ecosystemProtection}
          />
          <Distribution
            title="Minat Agroekologi"
            items={analytics?.agroecology?.agroecologyInterest}
            chart="donut"
          />
          </div>
        </details>
      </section>
      )}
      {activeSection === "usaha" && (
      <section id="usaha">
        <details className="group rounded-3xl border border-slate-200/70 bg-white p-5 shadow-sm">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 marker:content-none">
            <CategoryTitle
              number="5"
              title="Tata Usaha Tani"
              text="Hasil panen, pencatatan usaha, biaya-pendapatan, pembiayaan, pemasaran, mutu, sertifikasi, dan dukungan usaha."
            />
            <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180" />
          </summary>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <ChartCard
            title="Biaya dan Pendapatan"
            text="Perbandingan rata-rata per komoditas."
          >
            <BarChart
              data={economics.map((item) => ({
                komoditas: item.commodity,
                biaya: item.cost.mean,
                pendapatan: item.income.mean,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="komoditas" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Legend />
              <Bar
                dataKey="biaya"
                name="Biaya"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                animationDuration={650}
              />
              <Bar
                dataKey="pendapatan"
                name="Pendapatan"
                fill="#2563eb"
                radius={[4, 4, 0, 0]}
                animationDuration={650}
              />
            </BarChart>
          </ChartCard>
          <article className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <SectionTitle
              title="Ringkasan Hasil Panen"
              text="Pertanyaan 8.1: rata-rata hasil panen dalam satu musim."
            />
            <div className="mt-4 space-y-4 text-sm">
              <Metric
                label="Median hasil panen"
                value={`${number(analytics?.statistics?.yieldKg?.median ?? 0)} kg`}
              />
              <Metric
                label="Rentang hasil panen"
                value={`${number(analytics?.statistics?.yieldKg?.min ?? 0)}–${number(analytics?.statistics?.yieldKg?.max ?? 0)} kg`}
              />
            </div>
          </article>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <Distribution
            title="Tingkat Literasi Keuangan"
            items={analytics?.financialLiteracy?.levels}
            chart="donut"
            subtitle="Indikator dari kebiasaan dan tempat menabung; bukan asesmen formal."
          />
          <Distribution
            title="Kebiasaan Menabung"
            items={analytics?.financialLiteracy?.savingHabits}
            chart="donut"
          />
          <Distribution
            title="Tempat Menabung"
            items={analytics?.financialLiteracy?.savingLocations}
          />
          <Distribution
            title="Sumber Modal Usaha"
            items={analytics?.financialLiteracy?.capitalSources}
            chart="donut"
          />
          <Distribution
            title="Saluran Penjualan"
            items={analytics?.market?.salesChannels}
          />
          <Distribution
            title="Status Sertifikasi"
            items={analytics?.market?.certification}
            chart="donut"
          />
          <Distribution
            title="Dukungan Koperasi"
            items={analytics?.support?.cooperative}
          />
          <Distribution
            title="Dukungan Pemerintah"
            items={analytics?.support?.government}
          />
          <Distribution
            title="Pencatatan Usaha Tani"
            items={analytics?.farmManagement?.recordKeeping}
            chart="donut"
          />
          <Distribution
            title="Standar Mutu Produk"
            items={analytics?.farmManagement?.qualityStandards}
            chart="donut"
          />
          </div>
        </details>
      </section>
      )}
      {activeSection === "ketahanan" && (
      <section id="ketahanan" className="space-y-5">
        <CategoryTitle
          number="6"
          title="Tingkat Ketahanan Usaha Tani"
          text="Skor gabungan dari produktivitas, ekonomi, praktik agroekologi, dukungan, dan tingkat risiko usaha yang saat ini terukur."
        />
        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <article
            data-chart
            className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <SectionTitle
                title="Profil Ketahanan Usaha Tani"
                text="Skor 0–100 pada setiap dimensi untuk membaca profil ketahanan usaha secara visual."
              />
              <DownloadChartButton title="Profil Ketahanan Usaha Tani" />
            </div>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-4xl font-black tracking-tight text-slate-900">
                  {number(resilience.overall ?? 0)}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  {resilience.level || "Belum ada data"}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
                  (resilience.overall ?? 0) >= 70
                    ? "bg-emerald-100 text-emerald-700"
                    : (resilience.overall ?? 0) >= 40
                      ? "bg-amber-100 text-amber-700"
                      : "bg-rose-100 text-rose-700"
                }`}
              >
                {(resilience.overall ?? 0) >= 70
                  ? "Tahan"
                  : (resilience.overall ?? 0) >= 40
                    ? "Cukup"
                    : "Rentan"}
              </span>
            </div>
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Status Utama
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">Indeks Ketahanan</span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                    (resilience.overall ?? 0) >= 70
                      ? "bg-emerald-100 text-emerald-700"
                      : (resilience.overall ?? 0) >= 40
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {(resilience.overall ?? 0) >= 70
                    ? "Tahan"
                    : (resilience.overall ?? 0) >= 40
                      ? "Cukup"
                      : "Rentan"}
                </span>
              </div>
            </div>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  data={resilience.dimensions ?? []}
                  outerRadius="70%"
                  margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                >
                  <PolarGrid stroke="#dfe7ee" />
                  <PolarAngleAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#334155" }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tickCount={6}
                    tickFormatter={(value) => `${value}%`}
                    tick={{ fontSize: 10, fill: "#475569" }}
                  />
                  <Tooltip formatter={(value) => `${number(Number(value), 0)}%`} />
                  <Radar
                    name="Ketahanan"
                    dataKey="score"
                    stroke={
                      (resilience.overall ?? 0) >= 70
                        ? "#10b981"
                        : (resilience.overall ?? 0) >= 40
                          ? "#f59e0b"
                          : "#ef4444"
                    }
                    fill={
                      (resilience.overall ?? 0) >= 70
                        ? "#10b981"
                        : (resilience.overall ?? 0) >= 40
                          ? "#f59e0b"
                          : "#ef4444"
                    }
                    fillOpacity={0.35}
                    animationDuration={650}
                  >
                    <LabelList
                      dataKey="score"
                      position="top"
                      formatter={(value) => {
                        const numeric = Number(Array.isArray(value) ? value.join("") : value ?? 0);
                        return `${number(numeric, 0)}%`;
                      }}
                      style={{ fill: "#0f172a", fontSize: 10, fontWeight: 700 }}
                    />
                  </Radar>
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Tahan (≥70)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Cukup (40–69)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-rose-700">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                {"Rentan (<40)"}
              </span>
            </div>
            <div className="mt-5 rounded-lg border-l-4 border-slate-300 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                Interpretasi
              </p>
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                <p>
                  {(resilience.overall ?? 0) >= 70
                    ? "✓ Wilayah ini memiliki ketahanan usaha tani yang kuat. Sistem produksi, keuangan, dan dukungan sosial sudah solid untuk menghadapi tantangan."
                    : (resilience.overall ?? 0) >= 40
                      ? "◐ Ketahanan cukup, namun ada aspek yang perlu diperkuat—terutama dalam produktivitas, akses pasar, atau dukungan kelembagaan."
                      : "⚠ Ketahanan masih rentan. Diperlukan intervensi khusus pada produktivitas, diversifikasi pendapatan, atau penguatan agroekologi."}
                </p>
                <p className="text-slate-600">
                  {`Fokus pengembangan: `}
                  {(() => {
                    const dimensions = [...(resilience.dimensions ?? [])].sort(
                      (a, b) => (a.score ?? 0) - (b.score ?? 0)
                    );
                    const lowest = dimensions.slice(0, 2).map((d) => d.label).join(", ");
                    return lowest || "data tidak lengkap";
                  })()}
                </p>
              </div>
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <SectionTitle
              title="Distribusi Tingkat Ketahanan"
              text="Klasifikasi responden berdasarkan skor gabungan untuk mengidentifikasi kelompok rentan, cukup, dan tahan."
            />
            <div className="mt-5 space-y-4">
              {(resilience.distribution ?? []).map((item) => {
                const maxValue = Math.max(
                  1,
                  ...(resilience.distribution ?? []).map((entry) => entry.value),
                );
                const width = `${((item.value ?? 0) / maxValue) * 100}%`;
                return (
                  <div key={item.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700">{item.label}</span>
                      <span className="text-slate-500">{number(item.value ?? 0)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          item.label === "Tahan"
                            ? "bg-emerald-500"
                            : item.label === "Cukup"
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </div>
      </section>
      )}
      {activeSection === "tindak-lanjut" && (
        <>
      <section id="tindak-lanjut" className="space-y-5">
        <CategoryTitle
          number="7"
          title="Hasil, Risiko, dan Tindak Lanjut"
          text="Perubahan hasil usaha, risiko utama, saran petani, kualitas data, dan daftar respons untuk proses tindak lanjut."
        />
        <div className="grid gap-5 xl:grid-cols-3">
          <article className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <SectionTitle
              title="Kualitas & Validasi"
              text="Indikator untuk tindak lanjut enumerasi."
            />
            <div className="mt-4 space-y-4 text-sm">
              <Metric
                label="Respons duplikat"
                value={number(quality?.duplicateResponses ?? 0)}
              />
              <Metric
                label="Koordinat belum tersedia"
                value={number(quality?.missingCoordinates ?? 0)}
              />
              <Metric
                label="Identitas belum lengkap"
                value={number(quality?.missingIdentity ?? 0)}
              />
              <Metric
                label="Outlier produktivitas"
                value={number(analytics?.outliers?.count ?? 0)}
              />
              <Metric
                label="Saran / harapan terisi"
                value={number(analytics?.results?.suggestionsCount ?? 0)}
              />
              <Metric
                label="Kolom penting belum terbaca"
                value={number(quality?.columnMapping?.unresolved?.length ?? 0)}
              />
              {!!quality?.columnMapping?.unresolved?.length && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                  Periksa header: {quality.columnMapping.unresolved.join(", ")}.
                </p>
              )}
            </div>
          </article>
          <article className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 xl:col-span-2">
            <SectionTitle
              title="Temuan Otomatis"
              text="Sorotan awal untuk monitoring program."
            />
            <div className="mt-4 space-y-3">
              {analytics?.insights?.length ? (
                analytics.insights.map((item) => (
                  <p
                    key={item}
                    className="border-l-2 border-emerald-500 pl-3 text-sm leading-6 text-slate-600"
                  >
                    {item}
                  </p>
                ))
              ) : (
                <Empty />
              )}
            </div>
          </article>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <Distribution
            title="Kondisi Hasil Usaha"
            items={analytics?.results?.performance}
            chart="donut"
          />
          <Distribution
            title="Persentase Peningkatan Hasil"
            items={analytics?.results?.increase}
            chart="donut"
          />
          <Distribution
            title="Persentase Penurunan Hasil"
            items={analytics?.results?.decrease}
            chart="donut"
          />
          <Distribution title="Risiko Utama" items={analytics?.risks} />
          <section className="rounded-2xl border border-slate-200/60 bg-white shadow-sm 2xl:col-span-2">
            <div className="border-b border-slate-100 p-5">
              <SectionTitle
                title="Produktivitas, Margin, dan ROI"
                text="Ringkasan per komoditas; tinjau outlier sebelum dipakai sebagai dasar keputusan."
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-slate-50 uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Komoditas</th>
                    <th className="px-5 py-3">N Produktivitas</th>
                    <th className="px-5 py-3">Rata-rata kg/ha</th>
                    <th className="px-5 py-3">N Ekonomi</th>
                    <th className="px-5 py-3">Margin</th>
                    <th className="px-5 py-3">ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productivity.map((item) => {
                    const economy = economics.find(
                      (value) => value.commodity === item.commodity,
                    );
                    return (
                      <tr key={item.commodity}>
                        <td className="px-5 py-3 font-bold text-slate-700">
                          {item.commodity}
                        </td>
                        <td className="px-5 py-3">
                          {number(item.yieldPerHa.count)}
                        </td>
                        <td className="px-5 py-3">
                          {number(item.yieldPerHa.mean)}
                        </td>
                        <td className="px-5 py-3">
                          {number(economy?.income.count ?? 0)}
                        </td>
                        <td className="px-5 py-3">
                          {economy ? money(economy.margin.mean) : "—"}
                        </td>
                        <td className="px-5 py-3">
                          {economy ? `${number(economy.roi.mean, 1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
      <section className="space-y-5">
        <CategoryTitle
          number="6"
          title="Tindak Lanjut Data Survei"
          text="Gunakan daftar respons untuk pemeriksaan lanjutan dan melihat dokumentasi setiap pendataan."
        />
        <section className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <SectionTitle
              title="Data Survei Terbaru"
              text={`Menampilkan ${number((table?.rows ?? []).length)} dari ${number(table?.total ?? 0)} respons sesuai filter.`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-slate-50 uppercase tracking-wider text-slate-400">
                <tr>
                  {(table?.headers ?? []).map((header) => (
                    <th key={header} className="px-5 py-3">
                      {header}
                    </th>
                  ))}
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(table?.rows ?? []).map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    {row.cells.map((cell, index) => (
                      <td
                        key={`${row.id}-${index}`}
                        className="max-w-48 truncate px-5 py-3 text-slate-600"
                      >
                        {cell || "—"}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openDetail(row.id)}
                        className="font-bold text-emerald-700 hover:text-emerald-900"
                      >
                        Lihat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-slate-100 p-4">
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Sebelumnya
            </button>
            <span className="text-sm text-slate-500">
              Halaman {page + 1} dari{" "}
              {Math.max(1, Math.ceil((table?.total ?? 0) / 20))}
            </span>
            <button
              type="button"
              disabled={loading || (page + 1) * 20 >= (table?.total ?? 0)}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Berikutnya →
            </button>
          </div>
        </section>
      </section>
        </>
      )}
      {(detailLoading || detail) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {detail?.farmerName || "Memuat detail…"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Petugas: {detail?.enumerator || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="text-sm font-bold text-slate-500"
              >
                Tutup
              </button>
            </div>
            {detailLoading ? (
              <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-emerald-600" />
            ) : (
              <>
                <dl className="grid gap-x-6 sm:grid-cols-2">
                  {(detail?.fields ?? []).map((field, index) => (
                    <div
                      key={`${field.label}-${index}-${String(field.value ?? "").slice(0, 12)}`}
                      className="border-b border-slate-100 py-3"
                    >
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {field.label}
                      </dt>
                      <dd className="mt-1 text-sm text-slate-700">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <DetailPhotos photos={detail?.photos ?? []} />
              </>
            )}
          </div>
        </div>
      )}
      <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => setAssistantOpen((value) => !value)}
          aria-expanded={assistantOpen}
          className="group mb-3 ml-auto flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-slate-950/25 transition hover:-translate-y-0.5 hover:bg-emerald-700"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/20">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300 transition group-hover:rotate-12" />
          </span>
          {assistantOpen ? "Tutup AI" : "Buka AI"}
        </button>
        {assistantOpen && (
          <div className="w-[calc(100vw-2rem)] max-w-[390px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-950/20 ring-1 ring-black/5">
            <div className="relative overflow-hidden bg-slate-950 px-5 py-4 text-white">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/25 via-transparent to-cyan-400/10" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-400/15 ring-1 ring-emerald-300/30">
                    <Sparkles className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-300">
                      AI Assistant
                    </p>
                    <h3 className="mt-0.5 text-base font-bold">
                      Dashboard Insight
                    </h3>
                  </div>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_theme(colors.emerald.400)]" />
                  Online
                </span>
              </div>
            </div>
            <div className="max-h-[380px] min-h-[180px] space-y-3 overflow-y-auto bg-slate-50/70 p-4">
              {assistantMessages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${message.role === "assistant" ? "rounded-tl-md border border-slate-200/80 bg-white text-slate-700" : "ml-auto rounded-tr-md bg-emerald-600 text-white shadow-emerald-600/10"}`}
                >
                  <AssistantAnswer content={message.content} />
                </div>
              ))}
              {assistantLoading && (
                <div className="flex max-w-[88%] items-center gap-2 rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-3.5 py-3 text-xs font-medium text-slate-500 shadow-sm">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50">
                    <Sparkles className="h-3 w-3 text-emerald-600" />
                  </span>
                  <span>AI sedang menyusun jawaban</span>
                  <span className="flex gap-1" aria-label="AI sedang memproses">
                    <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-.3s]" />
                    <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-.15s]" />
                    <i className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
                  </span>
                </div>
              )}
            </div>
            <div className="border-t border-slate-200/80 bg-white p-3.5">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {["Ringkas data", "Cek anomali", "Rekomendasi"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={assistantLoading}
                    onClick={() => void askAssistant(item)}
                    className="rounded-full border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 transition-within:border-emerald-400">
                <input
                  value={assistantInput}
                  disabled={assistantLoading}
                  onChange={(event) => setAssistantInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter")
                      void askAssistant(assistantInput);
                  }}
                  placeholder={
                    assistantLoading
                      ? "Menunggu jawaban AI..."
                      : "Tanya data dashboard..."
                  }
                  className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-wait"
                />
                <button
                  type="button"
                  disabled={assistantLoading || !assistantInput.trim()}
                  onClick={() => void askAssistant(assistantInput)}
                  aria-label="Kirim pertanyaan"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <span className="text-base leading-none">↑</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Filter({
  label,
  value,
  onChange,
  values,
  empty,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  values: string[];
  empty: string;
}) {
  return (
    <label className="grid min-w-[180px] flex-1 gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
      {label}
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-2xl border border-slate-200 bg-white/90 px-3.5 py-2.5 pr-10 text-sm font-medium normal-case text-slate-700 shadow-sm transition duration-200 hover:border-emerald-300 hover:shadow-md focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100"
        >
          <option value="">{empty}</option>
          {values.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <path
              d="M5.5 7.5L10 12l4.5-4.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </label>
  );
}
function CategoryTitle({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div
      aria-label={`Kategori ${number}: ${title}`}
      className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-5 py-5 shadow-sm"
    >
      <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-emerald-200/40 blur-2xl" />
      <div className="absolute bottom-0 left-0 h-1 w-24 bg-gradient-to-r from-emerald-600 to-teal-400" />
      <div className="relative">
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700 shadow-sm">
          Kategori Baseline
        </span>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {text}
        </p>
      </div>
    </div>
  );
}
function renderAssistantInline(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}
function AssistantAnswer({ content }: { content: string }) {
  const normalized = content
    .replace(
      /\s*\*\*(Ringkasan|Fakta utama|Rekomendasi)\*\*\s*/gi,
      "\n\n**$1**\n",
    )
    .replace(/\s+-\s+/g, "\n- ");
  return (
    <div className="space-y-2">
      {normalized.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={`space-${index}`} className="h-1" />;
        if (/^\*\*(Ringkasan|Fakta utama|Rekomendasi)\*\*$/i.test(trimmed))
          return (
            <h4
              key={index}
              className="pt-1 text-xs font-bold uppercase tracking-wide text-emerald-700"
            >
              {renderAssistantInline(trimmed)}
            </h4>
          );
        if (trimmed.startsWith("- "))
          return (
            <div key={index} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <p>{renderAssistantInline(trimmed.slice(2))}</p>
            </div>
          );
        return <p key={index}>{renderAssistantInline(trimmed)}</p>;
      })}
    </div>
  );
}
function SectionTitle({ title, text }: { title: string; text: string }) {
  return (
    <>
      <h2 className="font-bold text-slate-800">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
      <span className="text-slate-500">{label}</span>
      <strong className="text-slate-800">{value}</strong>
    </div>
  );
}
function Empty() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      Belum ada data untuk filter ini.
    </div>
  );
}
type ChartFormat = "png" | "jpg" | "svg";
function chartFileName(title: string, format: ChartFormat) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.${format}`;
}
function saveChartFile(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
}
async function withLeafletStylesDisabled<T>(
  callback: () => Promise<T>,
): Promise<T> {
  const links = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"][href*="leaflet.css"], link[data-leaflet-css="true"]',
    ),
  );
  const originalParents = links.map((link) => ({
    link,
    parent: link.parentNode,
  }));
  links.forEach((link) => link.remove());
  try {
    return await callback();
  } finally {
    originalParents.forEach(({ link, parent }) => {
      if (parent) parent.appendChild(link);
    });
  }
}
async function downloadChart(
  button: HTMLButtonElement,
  title: string,
  format: ChartFormat,
) {
  const chart = button.closest<HTMLElement>("[data-chart]");
  if (!chart) return;
  const options = {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    filter: (node: HTMLElement) =>
      !node ||
      typeof node.getAttribute !== "function" ||
      node.getAttribute("data-export-control") !== "true",
  };
  const image = await withLeafletStylesDisabled(async () => {
    return format === "png"
      ? await toPng(chart, options)
      : format === "jpg"
        ? await toJpeg(chart, { ...options, quality: 0.95 })
        : await toSvg(chart, options);
  });
  saveChartFile(image, chartFileName(title, format));
}
function DownloadChartButton({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async (button: HTMLButtonElement, format: ChartFormat) => {
    setSaving(true);
    try {
      await downloadChart(button, title, format);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };
  return (
    <div data-export-control="true" className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={`Unduh ${title}`}
        aria-label={`Unduh ${title}`}
        aria-expanded={open}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700"
      >
        <Download className={`h-4 w-4 ${saving ? "animate-pulse" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-28 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg">
          <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Unduh
          </p>
          {(["png", "jpg", "svg"] as ChartFormat[]).map((format) => (
            <button
              key={format}
              type="button"
              disabled={saving}
              onClick={(event) => void save(event.currentTarget, format)}
              className="block w-full px-3 py-2 text-sm font-medium uppercase text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50"
            >
              {format}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function ChartCard({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <article
      data-chart
      className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <SectionTitle title={title} text={text} />
        <DownloadChartButton title={title} />
      </div>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </article>
  );
}
const PALETTE = [
  "#059669",
  "#2563eb",
  "#9333ea",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#0891b2",
  "#4f46e5",
  "#65a30d",
  "#dc2626",
];
function Distribution({
  title,
  items,
  chart = "bar",
  subtitle,
}: {
  title: string;
  items?: CountItem[];
  chart?: "bar" | "donut";
  subtitle?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const all = items ?? [];
  const visible = showAll ? all : all.slice(0, 6);
  const total = all.reduce((sum, item) => sum + item.value, 0);
  const data = visible.map((item) => {
    const percentage = total ? (item.value / total) * 100 : 0;
    return {
      ...item,
      percentage,
      detail: `${number(item.value)} · ${number(percentage, 1)}%`,
      shortLabel:
        item.label.length > 24 ? `${item.label.slice(0, 24)}…` : item.label,
    };
  });
  const height =
    chart === "donut"
      ? 290
      : Math.max(240, Math.min(560, data.length * 42 + 38));
  const tooltip = (
    value: unknown,
    _: unknown,
    payload: { payload?: { percentage?: number } },
  ) => [
    `${number(Number(value))} respons (${number(payload?.payload?.percentage ?? 0, 1)}%)`,
    "Jumlah",
  ];
  return (
    <article
      data-chart
      className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {subtitle || `Total jawaban: ${number(total)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {all.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
            >
              {showAll ? "Ringkas" : `Lihat semua (${all.length})`}
            </button>
          )}
          <DownloadChartButton title={title} />
        </div>
      </div>
      <div className="mt-4" style={{ height }}>
        {data.length ? (
          chart === "donut" ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="48%"
                  outerRadius="72%"
                  paddingAngle={3}
                  animationDuration={650}
                  labelLine={false}
                  label={({ percent }) => `${number((percent || 0) * 100, 0)}%`}
                >
                  {data.map((item, index) => (
                    <Cell
                      key={item.label}
                      fill={PALETTE[index % PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={tooltip} />
                <Legend
                  verticalAlign="bottom"
                  height={58}
                  formatter={(value) => (
                    <span className="text-xs text-slate-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 2, right: 68, left: 4, bottom: 2 }}
              >
                <CartesianGrid horizontal={false} stroke="#eef2f7" />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="category"
                  dataKey="shortLabel"
                  width={112}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  formatter={tooltip}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.label || ""
                  }
                />
                <Bar
                  dataKey="value"
                  name="Respons"
                  radius={[0, 5, 5, 0]}
                  animationDuration={650}
                >
                  {data.map((item, index) => (
                    <Cell
                      key={item.label}
                      fill={PALETTE[index % PALETTE.length]}
                    />
                  ))}
                  <LabelList
                    dataKey="detail"
                    position="right"
                    fill="#475569"
                    fontSize={10}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        ) : (
          <Empty />
        )}
      </div>
    </article>
  );
}

function DetailPhotos({
  photos,
}: {
  photos: { label: string; fileId: string }[];
}) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let active = true;
    Promise.all(
      photos.map(async (photo) => {
        try {
          return [
            photo.fileId,
            await api<string>("photo", { fileId: photo.fileId }),
          ] as const;
        } catch {
          return [photo.fileId, ""] as const;
        }
      }),
    ).then((results) => {
      if (!active) return;
      const next: Record<string, string> = {};
      const errors: Record<string, boolean> = {};
      results.forEach(([id, data]) => {
        if (data) next[id] = data;
        else errors[id] = true;
      });
      setImages(next);
      setFailed(errors);
    });
    return () => {
      active = false;
    };
  }, [photos]);
  if (!photos.length) return null;
  return (
    <section className="mt-6 border-t border-slate-100 pt-5">
      <h3 className="text-sm font-bold text-slate-800">Foto Dokumentasi</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {photos.map((photo) => (
          <figure
            key={photo.fileId}
            className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          >
            <div className="aspect-[4/3] bg-slate-100">
              {images[photo.fileId] ? (
                <img
                  src={images[photo.fileId]}
                  alt={photo.label}
                  className="h-full w-full object-cover"
                />
              ) : failed[photo.fileId] ? (
                <div className="grid h-full place-items-center p-4 text-center text-xs text-slate-500">
                  Foto tidak dapat dimuat.
                </div>
              ) : (
                <Loader2 className="m-auto h-full w-5 animate-spin text-emerald-600" />
              )}
            </div>
            <figcaption className="p-3 text-xs text-slate-600">
              {photo.label}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function DataLoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/35 px-5 pt-28 backdrop-blur-[3px] sm:pt-40"
      role="status"
      aria-live="polite"
      aria-label="Memuat data dashboard"
    >
      <div className="w-full max-w-sm rounded-3xl border border-white/70 bg-white/95 p-8 text-center shadow-2xl shadow-slate-950/20">
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-emerald-100 border-t-emerald-600 motion-reduce:animate-none" />
          <span className="absolute inset-2 animate-pulse rounded-full bg-emerald-50 motion-reduce:animate-none" />
          <Image
            src={logoSimApi}
            alt="Logo SIM-API"
            className="relative h-14 w-auto object-contain"
            priority
          />
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
          SIM-API · Baseline
        </p>
        <h2 className="mt-2 text-xl font-black text-slate-900">
          Menyiapkan data Anda
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Dashboard, analitik, dan peta sedang disinkronkan.
        </p>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

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
    if (!document.querySelector("[data-leaflet-css]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.crossOrigin = "anonymous";
      link.dataset.leafletCss = "true";
      document.head.appendChild(link);
    }
    const script =
      document.querySelector<HTMLScriptElement>("[data-leaflet-js]") ||
      document.createElement("script");
    script.dataset.leafletJs = "true";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () =>
      resolve((window as unknown as { L: LeafletRuntime }).L);
    script.onerror = () => reject(new Error("Peta tidak dapat dimuat."));
    if (!script.parentNode) document.body.appendChild(script);
  });
}
function LeafletMap({ points }: { points: MapPoint[] }) {
  const node = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: LeafletMapInstance | undefined;
    let canceled = false;
    loadLeaflet()
      .then((L) => {
        if (canceled || !node.current) return;
        map = L.map(node.current, { zoomControl: true }).setView(
          [-2.5, 118],
          4,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map);
        const colors: Record<string, string> = {
          Padi: "#10b981",
          Kopi: "#a16207",
          Kakao: "#7c3f00",
        };
        const valid = points.filter(
          (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
        );
        valid.forEach((point) =>
          L.circleMarker([point.lat, point.lng], {
            radius: 7,
            color: "#ffffff",
            weight: 2,
            fillColor: colors[point.commodity] || "#2563eb",
            fillOpacity: 0.9,
          })
            .bindPopup(
              `<strong>${escapeHtml(point.farmerName)}</strong><br/>${escapeHtml(point.province)}<br/>${escapeHtml(point.commodity)}`,
            )
            .addTo(map),
        );
        if (valid.length)
          map.fitBounds(
            valid.map((point) => [point.lat, point.lng]),
            { padding: [28, 28], maxZoom: 11 },
          );
      })
      .catch(() => undefined);
    return () => {
      canceled = true;
      map?.remove();
    };
  }, [points]);
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div>
          <SectionTitle
            title="Peta Sebaran Responden"
            text="Peta GPS interaktif; klik marker untuk melihat nama petani, wilayah, dan komoditas."
          />
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          {number(points.length)} titik geotag
        </span>
      </div>
      <div ref={node} className="h-[370px] w-full bg-slate-100" />
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 p-4 text-xs text-slate-500">
        <span>
          <i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Padi
        </span>
        <span>
          <i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-700" />
          Kopi
        </span>
        <span>
          <i className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-900" />
          Kakao
        </span>
        <span className="ml-auto">Sumber: koordinat GPS respons Baseline</span>
      </div>
    </article>
  );
}
