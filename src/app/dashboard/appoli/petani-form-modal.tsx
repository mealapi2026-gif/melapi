'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Loader2, Save, X } from 'lucide-react';
import { db } from '../../../../lib/firebase';

type Lahan = { statusLahan: string; alamatLahan: string; luasLahan: string; komoditas: string };
type PetaniForm = { idPetani: string; namaPetani: string; alamatPetani: string; noHp: string; kelompokTani: string; komoditasUtama: string; lahanUtama: Lahan; lahan2: Lahan };

const lahanAwal: Lahan = { statusLahan: 'Milik Sendiri', alamatLahan: '', luasLahan: '', komoditas: '' };
const buatFormAwal = (): PetaniForm => ({
  idPetani: `PTN-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
  namaPetani: '', alamatPetani: '', noHp: '', kelompokTani: '', komoditasUtama: 'Padi Organik',
  lahanUtama: { ...lahanAwal }, lahan2: { ...lahanAwal },
});
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500';

function LahanFields({ title, formKey, required, form, onChange }: { title: string; formKey: 'lahanUtama' | 'lahan2'; required?: boolean; form: PetaniForm; onChange: (key: 'lahanUtama' | 'lahan2', field: keyof Lahan, value: string) => void }) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <legend className="px-1 text-sm font-bold text-slate-800">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Status Lahan<select value={form[formKey].statusLahan} onChange={(event) => onChange(formKey, 'statusLahan', event.target.value)} className={`${inputClass} mt-1`}><option>Milik Sendiri</option><option>Sewa</option><option>Bagi Hasil / Sakap</option><option>Menumpang</option></select></label>
        <label className="text-sm font-medium text-slate-700">Luas Lahan<input value={form[formKey].luasLahan} onChange={(event) => onChange(formKey, 'luasLahan', event.target.value)} placeholder="Contoh: 0.5 Ha" required={required} className={`${inputClass} mt-1`} /></label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Komoditas<input value={form[formKey].komoditas} onChange={(event) => onChange(formKey, 'komoditas', event.target.value)} required={required} className={`${inputClass} mt-1`} /></label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Lokasi Lahan<input value={form[formKey].alamatLahan} onChange={(event) => onChange(formKey, 'alamatLahan', event.target.value)} required={required} className={`${inputClass} mt-1`} /></label>
      </div>
    </fieldset>
  );
}

export default function PetaniFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState<PetaniForm>(buatFormAwal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const update = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const updateLahan = (key: 'lahanUtama' | 'lahan2', field: keyof Lahan, value: string) => {
    setForm((previous) => ({ ...previous, [key]: { ...previous[key], [field]: value } }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const reference = doc(db, 'petani', form.idPetani.trim());
      const existing = await getDoc(reference);
      await setDoc(reference, {
        ...form,
        idPetani: form.idPetani.trim(),
        ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setForm(buatFormAwal());
      onClose();
    } catch (submissionError) {
      console.error('Gagal menyimpan data petani:', submissionError);
      setError('Data gagal disimpan. Periksa koneksi dan hak akses Firestore.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="form-petani-title" onMouseDown={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div><h2 id="form-petani-title" className="text-xl font-bold text-slate-900">Input Profil Petani</h2><p className="text-sm text-slate-500">Lengkapi identitas dan informasi lahan petani.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Tutup form"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-5 p-5">
          <fieldset className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4"><legend className="px-1 text-sm font-bold text-slate-800">Identitas Petani</legend><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">ID Petani<input name="idPetani" value={form.idPetani} onChange={update} required className={`${inputClass} mt-1 font-mono`} /></label>
            <label className="text-sm font-medium text-slate-700">Nama Petani<input name="namaPetani" value={form.namaPetani} onChange={update} required className={`${inputClass} mt-1`} /></label>
            <label className="text-sm font-medium text-slate-700">No. HP / WhatsApp<input name="noHp" value={form.noHp} onChange={update} required className={`${inputClass} mt-1`} /></label>
            <label className="text-sm font-medium text-slate-700">Kelompok Tani<input name="kelompokTani" value={form.kelompokTani} onChange={update} required className={`${inputClass} mt-1`} /></label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Komoditas Utama<input name="komoditasUtama" value={form.komoditasUtama} onChange={update} required className={`${inputClass} mt-1`} /></label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Alamat Petani<textarea name="alamatPetani" value={form.alamatPetani} onChange={update} required rows={2} className={`${inputClass} mt-1`} /></label>
          </div></fieldset>
          <LahanFields title="Lahan Utama" formKey="lahanUtama" required form={form} onChange={updateLahan} />
          <LahanFields title="Lahan Tambahan (Opsional)" formKey="lahan2" form={form} onChange={updateLahan} />
          {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Batal</button><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-70">{saving ? <Loader2 className="w-4 animate-spin" /> : <Save className="w-4" />}{saving ? 'Menyimpan...' : 'Simpan Data'}</button></div>
        </form>
      </div>
    </div>
  );
}
