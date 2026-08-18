'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { Leaf, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { auth } from '../../../lib/firebase';
import { syncUserProfileToFirestore } from '../../../lib/user-access';
import { getUserEmailByUsernameOrEmail } from '../../../lib/auth-utils';

export default function LoginPage() {
  const router = useRouter();

  const [credential, setCredential] = useState(''); // Email atau Username
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthReady(true);
      if (user) {
        router.replace('/dashboard');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!credential || !password) {
      setError('Harap isi email/username dan kata sandi Anda.');
      setIsLoading(false);
      return;
    }

    try {
      // Lookup email dari username jika input bukan email
      let emailToUse: string;
      try {
        const lookedUpEmail = await getUserEmailByUsernameOrEmail(credential);
        if (!lookedUpEmail) {
          setError('Username atau email tidak ditemukan dalam sistem.');
          setIsLoading(false);
          return;
        }
        emailToUse = lookedUpEmail;
      } catch (lookupError) {
        setError(lookupError instanceof Error ? lookupError.message : 'Gagal memproses login');
        setIsLoading(false);
        return;
      }

      // Signin dengan Firebase menggunakan email yang ditemukan
      const result = await signInWithEmailAndPassword(auth, emailToUse, password);
      await syncUserProfileToFirestore({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
      });
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal masuk. Periksa kembali username/email dan kata sandi Anda.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Memeriksa status login...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-slate-50 font-sans text-slate-900">
      
      {/* Sisi Kiri - Hero Banner & Branding (Hanya muncul di layar sedang & besar) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-emerald-950 flex-col justify-between p-12 overflow-hidden">
        {/* Background Gradient & Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 opacity-90" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/30">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">
            Agri<span className="text-emerald-400">Sense</span>
          </span>
        </div>

        {/* Highlight Text */}
        <div className="relative z-10 my-auto max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Sistem Monitoring Pertanian Terpadu
          </div>
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Kelola & Monitor Hasil Tani Lebih Presisi
          </h1>
          <p className="text-slate-300 text-base leading-relaxed">
            Platform analitik pertanian berbasis data untuk mendukung transparansi, efisiensi biaya produksi, dan kepatuhan standar sertifikasi organik APPOLI & ICS.
          </p>

          <div className="pt-4 space-y-3">
            {[
              'Integrasi Sistem Data Lahan & Profil Petani',
              'Kalkulasi Otomatis Analisa Biaya & Laba Rugi',
              'Checklist Kepatuhan Standard Regulasi ICS'
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-slate-200 text-sm font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <div className="relative z-10 text-xs text-slate-400">
          © {new Date().getFullYear()} AgriSense Monitoring. Hak Cipta Dilindungi Undang-Undang.
        </div>
      </div>

      {/* Sisi Kanan - Form Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          
          {/* Mobile Logo Branding */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-md">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-800 tracking-tight">
              Agri<span className="text-emerald-600">Sense</span>
            </span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Selamat Datang Kembali
            </h2>
            <p className="text-slate-500 text-sm mt-2">
              Silakan masukkan akun Anda untuk mengakses sistem dashboard.
            </p>
          </div>

          {/* Alert Error */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Input Email atau Username */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email atau Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder="admin@agrisense.id atau username_anda"
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>
            </div>

            {/* Input Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">
                  Kata Sandi
                </label>
                <a href="#" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                  Lupa kata sandi?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="remember-me" className="ml-2.5 block text-sm text-slate-600 font-medium cursor-pointer">
                Ingat saya di perangkat ini
              </label>
            </div>

            {/* Tombol Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Bantuan Support */}
          <div className="pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Kendala saat masuk? Hubungi{' '}
              <a href="#" className="font-semibold text-emerald-600 hover:underline">
                Tim Dukungan Sistem
              </a>
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}