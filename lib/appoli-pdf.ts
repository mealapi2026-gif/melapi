import { auth } from './firebase';

export type AppoliPdfCollection = 'analisaUsaha' | 'inspeksiICS' | 'dataLahan';

/**
 * Opens a server-generated PDF in a new tab. The tab is opened before the
 * async work starts so browsers do not block it as an unsolicited popup.
 */
export async function openAppoliPdf(collection: AppoliPdfCollection, id: string): Promise<void> {
  if (!id) throw new Error('ID dokumen PDF tidak tersedia.');

  const pdfWindow = window.open('', '_blank');
  if (!pdfWindow) throw new Error('Popup diblokir. Izinkan popup untuk membuka PDF.');
  pdfWindow.opener = null;
  pdfWindow.document.title = 'Menyiapkan PDF APPOLI...';

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 70_000);
  let objectUrl = '';

  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Sesi login berakhir. Silakan masuk kembali.');

    const response = await fetch(`/api/appoli/pdf?collection=${collection}&id=${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(detail?.error || 'PDF tidak dapat dibuat.');
    }

    objectUrl = URL.createObjectURL(await response.blob());
    pdfWindow.location.replace(objectUrl);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    pdfWindow.close();
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Pembuatan PDF terlalu lama. Silakan coba lagi.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
