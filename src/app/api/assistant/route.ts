import { NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim()
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite'
const GEMINI_TIMEOUT_MS = 10_000
type AssistantPayload = Record<string, unknown> & {
  question?: unknown
}

function fallbackAnswer(payload: AssistantPayload, notice?: string) {
  const question = String(payload.question || '').trim()
  return `${notice ? `${notice}\n\n` : ''}Saya belum dapat menjawab pertanyaan “${question}” dengan andal tanpa respons Gemini. Silakan coba lagi; saya tidak akan mengganti jawaban Anda dengan ringkasan umum yang tidak relevan.`
}

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
Jawab pertanyaan pengguna secara langsung dalam bahasa Indonesia, ringkas, jelas, dan berbasis angka.
Hanya gunakan fakta yang relevan dengan pertanyaan; jangan mengganti jawaban dengan ringkasan dashboard umum.
Jika data untuk menjawab pertanyaan tidak tersedia, katakan dengan jujur data apa yang kurang.
Gunakan format teks berikut secara persis:
**Jawaban**
Jawaban langsung untuk pertanyaan pengguna.

**Data pendukung**
- Maksimal tiga fakta yang mendukung jawaban.

**Langkah berikutnya**
- Satu tindakan yang relevan, atau tulis “Tidak ada tindak lanjut khusus.”
Jangan menulis heading dan bullet pada baris yang sama. Jangan gunakan tabel.

Data dashboard:
${compact}`
}

export async function POST(request: Request) {
  let payload: AssistantPayload = {}
  try {
    payload = await request.json() as AssistantPayload
    const question = String(payload.question || '').trim()
    if (!question) {
      return NextResponse.json({ error: 'Pertanyaan tidak boleh kosong.' }, { status: 400 })
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ answer: fallbackAnswer(payload, 'AI belum terhubung karena GEMINI_API_KEY belum dikonfigurasi.') })
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        contents: [{
          parts: [{ text: buildPrompt(question, payload) }],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 350,
        },
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
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return NextResponse.json({
        answer: fallbackAnswer(payload, 'Gemini membutuhkan waktu terlalu lama; berikut ringkasan cepat dari data dashboard.'),
      })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan saat meminta AI.' }, { status: 500 })
  }
}
