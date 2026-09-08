import { NextRequest, NextResponse } from 'next/server';
import { getAdminServices } from '../../../../../lib/firebase-admin';

export const runtime = 'nodejs';

const allowedCollections = new Set(['petani', 'analisaUsaha', 'inspeksiICS', 'dataLahan']);
const appoliApiUrl = 'https://appoli-eta.vercel.app/api/integration/monitoring';

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    const idToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';
    if (!idToken) return NextResponse.json({ error: 'Token autentikasi tidak ditemukan.' }, { status: 401 });

    const { adminAuth } = getAdminServices();
    await adminAuth.verifyIdToken(idToken);

    const collection = request.nextUrl.searchParams.get('collection') || 'petani';
    if (!allowedCollections.has(collection)) {
      return NextResponse.json({ error: 'Koleksi Appoli tidak diizinkan.' }, { status: 400 });
    }

    const query = new URLSearchParams({
      collection,
      limit: request.nextUrl.searchParams.get('limit') || '50',
    });
    const cursor = request.nextUrl.searchParams.get('cursor');
    if (cursor) query.set('cursor', cursor);

    const response = await fetch(`${appoliApiUrl}?${query.toString()}`, {
      headers: { 'x-monitoring-secret': process.env.APPOLI_MONITORING_API_SECRET || '' },
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({ error: 'Respons Appoli tidak valid.' }));

    return NextResponse.json(result, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Gagal mengambil data Appoli untuk monitoring:', error);
    return NextResponse.json({ error: 'Data Appoli tidak dapat diambil.' }, { status: 500 });
  }
}
