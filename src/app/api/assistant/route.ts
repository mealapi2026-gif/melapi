import { NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim()

function buildPrompt(question: string, payload: Record<string, unknown>) {
  const filters = payload.filters as Record<string, string> | undefined
  const dashboard = payload.dashboard as Record<string, number> | undefined
  const analytics = payload.analytics as Record<string, unknown> | undefined
  const compact = JSON.stringify({
    question,
    filters: filters ?? {},
    dashboard: dashboard ?? {},
    analytics: analytics ?? {},
  })

  return `Kamu adalah AI assistant untuk dashboard monitoring petani.
Gunakan data berikut sebagai sumber utama dan jangan menebak.
Jawab dalam bahasa Indonesia dan sangat ringkas, jelas, dan berbasis angka.
Jika data tidak lengkap, katakan dengan jujur bahwa data tidak cukup.
Gunakan format teks berikut secara persis:
**Ringkasan**
Satu paragraf singkat.

**Fakta utama**
- Fakta pertama.
- Fakta kedua.
- Fakta ketiga.

**Rekomendasi**
- Rekomendasi pertama.
- Rekomendasi kedua.
Jangan menulis heading dan bullet pada baris yang sama. Jangan gunakan tabel.

Data dashboard:
${compact}`
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const question = String(payload.question || '').trim()
    if (!question) {
      return NextResponse.json({ error: 'Pertanyaan tidak boleh kosong.' }, { status: 400 })
    }

    if (!GEMINI_API_KEY) {
      const fallback = `Saya tidak terhubung ke model LLM saat ini, tetapi berdasarkan data dashboard yang aktif:
- responden: ${Number(payload.dashboard?.respondents ?? 0)}
- cakupan geotag: ${Number(payload.analytics?.coordinateCoverage ?? 0).toFixed(1)}%
- data ekonomi valid: ${Number(payload.analytics?.economicCoverage ?? 0).toFixed(1)}%
- sertifikasi aktif: ${Number(payload.analytics?.certificationRate ?? 0).toFixed(1)}%

Prioritas utama: validasi koordinat dan kelengkapan data ekonomi sebelum analisis lanjut.`
      return NextResponse.json({ answer: fallback })
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: buildPrompt(question, payload) }],
        }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let providerMessage = errorText
      try {
        const errorData = JSON.parse(errorText) as { error?: { message?: string } }
        providerMessage = errorData.error?.message || errorText
      } catch { /* Keep the raw response when Gemini does not return JSON. */ }
      const message = response.status === 503
        ? 'Layanan Gemini sedang sibuk. Silakan coba lagi dalam beberapa saat.'
        : response.status === 429
          ? 'Batas penggunaan Gemini sedang tercapai. Silakan coba lagi nanti.'
          : response.status === 401 || response.status === 403
            ? 'API key Gemini tidak diterima. Periksa GEMINI_API_KEY di .env.local.'
            : `Gemini gagal memproses permintaan (${response.status}): ${providerMessage}`
      return NextResponse.json({ error: message }, { status: response.status })
    }

    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]; promptFeedback?: { blockReason?: string } }
    const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim()
    if (!answer) {
      const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || 'respons Gemini kosong'
      return NextResponse.json({ error: `Gemini tidak mengirim jawaban teks (${reason}). Silakan coba pertanyaan lain.` }, { status: 502 })
    }
    return NextResponse.json({ answer })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan saat meminta AI.' }, { status: 500 })
  }
}
