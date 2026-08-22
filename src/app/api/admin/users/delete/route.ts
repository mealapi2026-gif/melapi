import { NextResponse } from 'next/server';
import { getAdminServices } from '../../../../../../lib/firebase-admin';

const ADMIN_EMAIL = 'dionyyr@gmail.com';
const ADMIN_UID = 'Zm6IBgsvXkO9pBRmJlKbJ3YicnA3';

export async function POST(request: Request) {
  try {
    const { adminAuth, adminDb } = getAdminServices();
    const authorization = request.headers.get('authorization');
    const idToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    if (!idToken) {
      return NextResponse.json({ error: 'Token admin tidak ditemukan.' }, { status: 401 });
    }

    const requester = await adminAuth.verifyIdToken(idToken);
    const requesterProfile = await adminDb.collection('users').doc(requester.uid).get();
    const isAdmin = requester.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      || requester.uid === ADMIN_UID
      || requesterProfile.data()?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses hanya untuk admin.' }, { status: 403 });
    }

    const body = await request.json() as { uid?: string };
    const uid = body.uid?.trim();
    if (!uid) {
      return NextResponse.json({ error: 'UID user wajib diisi.' }, { status: 400 });
    }
    if (uid === requester.uid) {
      return NextResponse.json({ error: 'Akun admin yang sedang digunakan tidak dapat dihapus.' }, { status: 400 });
    }

    await adminAuth.deleteUser(uid);
    await adminDb.collection('users').doc(uid).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
    if (code === 'auth/user-not-found') {
      return NextResponse.json({ error: 'Akun Auth tidak ditemukan. Profil Firestore tidak dihapus otomatis.' }, { status: 404 });
    }
    console.error('Admin user deletion failed:', error);
    return NextResponse.json({ error: 'Gagal menghapus akun Firebase dan profil Firestore.' }, { status: 500 });
  }
}
