'use client';

import { useState } from 'react';
import { ExternalLink, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';

export default function BaselinePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [key, setKey] = useState(0); // Digunakan untuk reload iframe

  // Masukkan URL Google Apps Script Web App Anda di sini atau via .env.local
  const APPS_SCRIPT_URL = 
    process.env.NEXT_PUBLIC_BASELINE_APPS_SCRIPT_URL || 
    'https://script.google.com/macros/s/AKfycbxYOUR_SCRIPT_ID_HERE/exec';

  const handleRefresh = () => {
    setIsLoading(true);
    setKey((prev) => prev + 1); // Memaksa iframe reload
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-[calc(100vh-140px)] flex flex-col animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Data Baseline Petani</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3 h-3" /> Live Integration
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Akses dan kelola formulir/sistem Baseline langsung dari Google Apps Script.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 rounded-xl text-xs font-semibold transition-all shadow-sm"
            title="Reload Web App"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <a
            href={APPS_SCRIPT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold transition-all shadow-md shadow-emerald-600/20"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buka Layar Penuh
          </a>
        </div>
      </div>

      {/* Frame Container - Premium Canvas */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden relative">
        
        {/* Skeleton / Loading State */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-700">Memuat Sistem Baseline...</p>
              <p className="text-xs text-slate-400 mt-0.5">Menghubungkan ke Google Apps Script Server</p>
            </div>
          </div>
        )}

        {/* Integrated Web App iFrame */}
        <iframe
          key={key}
          src={APPS_SCRIPT_URL}
          className="w-full h-full border-0"
          onLoad={() => setIsLoading(false)}
          title="Baseline Google Apps Script Web App"
          allow="geolocation; microphone; camera; clipboard-write;"
        />
      </div>

    </div>
  );
}