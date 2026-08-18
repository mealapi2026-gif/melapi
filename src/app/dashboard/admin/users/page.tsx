'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trash2, UserPlus, Shield, CheckSquare, Square, Edit2, X, Loader2 } from 'lucide-react';
import { deleteApp, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, updateProfile, type UserCredential } from 'firebase/auth';
import { app } from '../../../../../lib/firebase';
import { getStoredUsers, MENU_CONFIG, saveUsers, type UserAccessProfile, updateUserProfileInFirestore, deleteUserProfileFromFirestore } from '../../../../../lib/user-access';

const AVAILABLE_MENUS = MENU_CONFIG.map((menu) => menu.label);

type EditingUser = UserAccessProfile | null;

export default function AdminUserManagement() {
  const [users, setUsers] = useState<UserAccessProfile[]>([]);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedMenus, setSelectedMenus] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<EditingUser>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSelectedMenus, setEditSelectedMenus] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    setUsers(getStoredUsers());
  }, []);

  useEffect(() => {
    saveUsers(users);
  }, [users]);

  const toggleMenuAccess = (menu: string) => {
    setSelectedMenus((prev) =>
      prev.includes(menu)
        ? prev.filter((m) => m !== menu)
        : [...prev, menu]
    );
  };

  const toggleEditMenuAccess = (menu: string) => {
    setEditSelectedMenus((prev) =>
      prev.includes(menu)
        ? prev.filter((m) => m !== menu)
        : [...prev, menu]
    );
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newPassword) {
      alert('Mohon lengkapi Nama, Email, dan Password!');
      return;
    }

    if (newPassword.length < 6) {
      alert('Password minimal 6 karakter!');
      return;
    }

    if (selectedMenus.length === 0) {
      alert('Mohon pilih minimal satu menu untuk user!');
      return;
    }

    setIsLoading(true);
    try {
      // Buat user dengan instance Auth terpisah agar sesi admin utama tidak berubah.
      const secondaryApp = initializeApp(app.options, `user-creation-${crypto.randomUUID()}`);
      const secondaryAuth = getAuth(secondaryApp);
      let firebaseUser: UserCredential;
      try {
        firebaseUser = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
        await updateProfile(firebaseUser.user, {
          displayName: newName,
        });
      } finally {
        await deleteApp(secondaryApp);
      }

      // Simpan profil dan hak menu user baru.
      const accessibleMenuKeys = MENU_CONFIG.filter((menu) => selectedMenus.includes(menu.label)).map((menu) => menu.key);
      
      const newUser: UserAccessProfile = {
        id: firebaseUser.user.uid,
        name: newName,
        email: newEmail,
        username: newEmail.split('@')[0],
        uid: firebaseUser.user.uid,
        role: 'user',
        accessibleMenus: accessibleMenuKeys,
      };

      // Step 4: Sync to Firestore BEFORE clearing form
      await updateUserProfileInFirestore(newUser);

      // Step 5: Save to local state and localStorage
      setUsers((prev) => [...prev, newUser]);

      // Step 6: Clear form
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setSelectedMenus([]);

      alert('User berhasil ditambahkan. Sesi admin tetap aktif.');
    } catch (error: unknown) {
      console.error('Error adding user:', error);
      let errorMessage = 'Gagal menambahkan user.';
      const errorCode = typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
      
      if (errorCode === 'auth/email-already-in-use') {
        errorMessage = 'Email sudah terdaftar. Gunakan email yang berbeda.';
      } else if (errorCode === 'auth/invalid-email') {
        errorMessage = 'Format email tidak valid.';
      } else if (errorCode === 'auth/weak-password') {
        errorMessage = 'Password terlalu lemah. Gunakan minimal 6 karakter.';
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = (user: UserAccessProfile) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditSelectedMenus(
      MENU_CONFIG.filter((menu) => user.accessibleMenus.includes(menu.key)).map((menu) => menu.label)
    );
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editName || !editEmail) {
      alert('Mohon lengkapi Nama dan Email!');
      return;
    }

    setIsLoading(true);
    try {
      const updatedUser: UserAccessProfile = {
        ...editingUser,
        name: editName,
        email: editEmail,
        accessibleMenus: MENU_CONFIG.filter((menu) => editSelectedMenus.includes(menu.label)).map((menu) => menu.key),
      };

      setUsers((prev) =>
        prev.map((user) => (user.id === editingUser.id ? updatedUser : user))
      );

      // Sync to Firestore jika user memiliki UID
      if (updatedUser.uid) {
        await updateUserProfileInFirestore(updatedUser);
      }

      setEditingUser(null);
      alert('User berhasil diperbarui!');
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Gagal memperbarui user.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string, uid?: string) => {
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus user ${name}?`);
    if (confirmDelete) {
      setIsLoading(true);
      try {
        setUsers((prev) => prev.filter((user) => user.id !== id));

        // Mark as deleted in Firestore
        if (uid) {
          await deleteUserProfileFromFirestore(uid);
        }

        alert('User berhasil dihapus!');
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Gagal menghapus user.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const roleSummary = useMemo(
    () => ({
      admin: users.filter((user) => user.role === 'admin').length,
      user: users.filter((user) => user.role === 'user').length,
    }),
    [users]
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-8 my-6">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 border-b border-slate-300 pb-4">
        <div className="p-3 bg-emerald-100 rounded-lg text-emerald-700">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Akses & Pengguna</h1>
          <p className="text-sm text-slate-500">Tambah, hapus, edit, dan atur hak akses menu untuk staf / pengguna.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Admin</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{roleSummary.admin}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">User</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{roleSummary.user}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* --- KOLOM KIRI: FORM TAMBAH USER --- */}
        <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            Tambah User Baru
          </h2>
          
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Lengkap</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Cth: Budi Santoso"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email / Username</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Cth: budi@appoli.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                placeholder="Minimal 6 karakter"
              />
            </div>

            {/* CHECKBOX HAK AKSES MENU */}
            <div className="pt-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Hak Akses Menu (Bisa Diakses) {selectedMenus.length > 0 && <span className="text-emerald-600">✓ {selectedMenus.length} menu dipilih</span>}
              </label>
              <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-48 overflow-y-auto">
                {AVAILABLE_MENUS.map((menu) => (
                  <label key={menu} className="flex items-center gap-2 cursor-pointer group">
                    <div onClick={() => toggleMenuAccess(menu)}>
                      {selectedMenus.includes(menu) ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400 group-hover:text-emerald-500" />
                      )}
                    </div>
                    <span className="text-sm text-slate-700 select-none" onClick={() => toggleMenuAccess(menu)}>
                      {menu}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Catatan: hanya admin yang bisa membuka halaman ini dan mengatur menu yang tersedia untuk user.
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold py-2 px-4 rounded-lg transition-colors mt-4 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan User'
              )}
            </button>
          </form>
        </div>

        {/* --- KOLOM KANAN: DAFTAR USER --- */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">Daftar Pengguna Aktif</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-5 py-3">Nama & Email</th>
                  <th className="px-5 py-3">Akses Menu</th>
                  <th className="px-5 py-3 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                      Belum ada data user.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.accessibleMenus.length > 0 ? (
                            user.accessibleMenus.map((menuKey) => {
                              const menu = MENU_CONFIG.find((item) => item.key === menuKey);
                              return (
                                <span key={menuKey} className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded-full">
                                  {menu?.label ?? menuKey}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-rose-500 font-semibold italic">Tidak ada akses</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center flex justify-center gap-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.name, user.uid)}
                          disabled={isLoading}
                          className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Hapus User"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-600" />
                Edit User
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Nama"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="Email"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Hak Akses Menu</label>
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-48 overflow-y-auto">
                  {AVAILABLE_MENUS.map((menu) => (
                    <label key={menu} className="flex items-center gap-2 cursor-pointer group">
                      <div onClick={() => toggleEditMenuAccess(menu)}>
                        {editSelectedMenus.includes(menu) ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400 group-hover:text-emerald-500" />
                        )}
                      </div>
                      <span className="text-sm text-slate-700 select-none" onClick={() => toggleEditMenuAccess(menu)}>
                        {menu}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Perubahan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
