'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  LineChart, 
  Search,
  Users,           // Icon untuk Profil Petani
  Calculator,      // Icon untuk Analisa Usaha
  ClipboardCheck,  // Icon untuk Inspeksi ICS
  Map              // Icon untuk Data Lahan
} from 'lucide-react';
import logoSimApi from '../../../public/images/logo-sim-api.png';

export default function DashboardSidebar() {
  const pathname = usePathname();

  // Fungsi pembantu untuk menentukan menu aktif
  const isActive = (path: string) => pathname === path;

  return (
    <>
      {/* Sidebar - Premium White */}
      <aside className="w-72 bg-white border-r border-slate-200/60 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 h-screen">
        <div className="h-24 flex items-center px-8 shrink-0">
          <div className="flex items-center gap-3">
            <Image src={logoSimApi} alt="Logo Aliansi Petani Indonesia" preload className="h-12 w-auto object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">SIM-<span className="text-emerald-600">API</span></h1>
              <p className="text-[10px] font-medium text-slate-500">Aliansi Petani Indondesia</p>
            </div>
          </div>
        </div>

        {/* Tambahkan overflow-y-auto agar bisa di-scroll jika menu terlalu panjang */}
        <nav className="flex-1 px-5 py-6 space-y-2 overflow-y-auto">
          {/* --- MENU UTAMA --- */}
          <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Menu Utama</p>
          
          <Link href="/dashboard" className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive('/dashboard') ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
            <LayoutDashboard className={`w-5 h-5 ${isActive('/dashboard') ? 'text-emerald-600' : 'text-slate-400'}`} />
            DASHBOARD
          </Link>
          
          <Link href="/dashboard/baseline" className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive('/dashboard/baseline') ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
            <Search className={`w-5 h-5 ${isActive('/dashboard/baseline') ? 'text-emerald-600' : 'text-slate-400'}`} />
            BASELINE
          </Link>
          
          <Link href="/dashboard/saggd" className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive('/dashboard/saggd') ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
            <LineChart className={`w-5 h-5 ${isActive('/dashboard/saggd') ? 'text-emerald-600' : 'text-slate-400'}`} />
            SAGGD
          </Link>

          {/* --- MENU APPOLI --- */}
          <div className="pt-6">
            <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Modul Appoli</p>
            
            <Link href="/dashboard/appoli" className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive('/dashboard/appoli') ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <LayoutDashboard className={`w-5 h-5 ${isActive('/dashboard/appoli') ? 'text-emerald-600' : 'text-slate-400'}`} />
              DASHBOARD APPOLI
            </Link>

            <Link href="/dashboard/appoli/profil-petani" className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive('/dashboard/appoli/profil-petani') ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Users className={`w-5 h-5 ${isActive('/dashboard/appoli/profil-petani') ? 'text-emerald-600' : 'text-slate-400'}`} />
              PROFIL PETANI
            </Link>

            <Link href="/dashboard/appoli/analisa-usaha" className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive('/dashboard/appoli/analisa-usaha') ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Calculator className={`w-5 h-5 ${isActive('/dashboard/appoli/analisa-usaha') ? 'text-emerald-600' : 'text-slate-400'}`} />
              ANALISA USAHA
            </Link>

            <Link href="/dashboard/appoli/inspeksi-ics" className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive('/dashboard/appoli/inspeksi-ics') ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <ClipboardCheck className={`w-5 h-5 ${isActive('/dashboard/appoli/inspeksi-ics') ? 'text-emerald-600' : 'text-slate-400'}`} />
              INSPEKSI ICS
            </Link>

            <Link href="/dashboard/appoli/data-lahan" className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive('/dashboard/appoli/data-lahan') ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
              <Map className={`w-5 h-5 ${isActive('/dashboard/appoli/data-lahan') ? 'text-emerald-600' : 'text-slate-400'}`} />
              DATA & LAHAN
            </Link>

            <Link 
    href="/dashboard/admin/users" 
    className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors"
  >
    <Users className="w-5 h-5" />
    <span className="font-medium">Manajemen User</span>
  </Link>
          </div>
        </nav>

        {/* User Profile Snippet di bawah Sidebar */}
        <div className="p-5 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold shadow-sm">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">Admin Pusat</p>
              <p className="text-xs text-slate-500 truncate">Administrator SIM-API</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
