import { NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim()
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash'
const GEMINI_TIMEOUT_MS = 20_000

type Message = { role: 'user' | 'assistant'; content: string }
type AssistantPayload = Record<string, unknown> & {
  question?: unknown
  history?: Message[]
}

function fallbackAnswer(payload: AssistantPayload, notice?: string) {
  const question = String(payload.question || '').trim()
  return `${notice ? `${notice}\n\n` : ''}Saya belum dapat menjawab pertanyaan "${question}" dengan andal tanpa respons Gemini. Silakan coba lagi; saya tidak akan mengganti jawaban Anda dengan ringkasan umum yang tidak relevan.`
}

function extractDashboardSummary(analytics: Record<string, unknown>) {
  const summary: Record<string, unknown> = {}
  
  // KPIs
  if (analytics.kpis) summary.kpis = analytics.kpis
  
  // Quality metrics
  if (analytics.quality) summary.quality = analytics.quality
  
  // Key statistics
  if (analytics.resilience) summary.resilience = analytics.resilience
  if (analytics.risks) summary.risks = (analytics.risks as unknown[]).slice(0, 5)
  
  // Commodity data
  if (analytics.commodity) summary.commodity = analytics.commodity
  
  // Economics & productivity
  if (analytics.economics) summary.economics = (analytics.economics as unknown[]).slice(0, 3)
  if (analytics.productivity) summary.productivity = (analytics.productivity as unknown[]).slice(0, 3)
  
  // Trends
  if (analytics.trends) summary.trends = (analytics.trends as unknown[]).slice(-7)
  
  // Monitoring breakdown - INCLUDING DEMOGRAPHICS
  if (analytics.monitoring) {
    const monitoring = analytics.monitoring as Record<string, unknown>
    const total = monitoring.provinces 
      ? (monitoring.provinces as unknown[]).reduce((sum: number, item: unknown) => 
          sum + (typeof item === 'object' && item !== null && 'value' in item ? Number((item as Record<string, unknown>).value) : 0), 0)
      : 0
    
    summary.monitoring = {
      total_responses: total,
      // Demographics
      ageGroups: monitoring.ageGroups ?? [],
      gender: monitoring.gender ?? [],
      education: monitoring.education ?? [],
      youth: monitoring.youth ?? [],
      // Geography
      top_provinces: (monitoring.provinces as unknown[])?.slice(0, 5) ?? [],
      top_districts: (monitoring.districts as unknown[])?.slice(0, 5) ?? [],
      top_subdistricts: (monitoring.subdistricts as unknown[])?.slice(0, 5) ?? [],
      top_villages: (monitoring.villages as unknown[])?.slice(0, 5) ?? [],
      // Land
      landStatus: monitoring.landStatus ?? [],
      waterSources: monitoring.waterSources ?? [],
    }
  }
  
  // Profile data
  if (analytics.profile) {
    summary.profile = analytics.profile
  }
  
  // Land risks
  if (analytics.land) {
    summary.land = analytics.land
  }
  
  return summary
}

function buildSystemPrompt() {
  return `Kamu adalah AI assistant expert untuk monitoring petani organik Indonesia dengan nama "AI Monitoring Expert". 

KEAHLIAN KAMU:
- Analisis data kuantitatif petani: demografi (umur, gender, pendidikan, pemuda), lahan, hasil panen, ekonomi
- Analisis pola demografis: perbandingan umur, gender, pendidikan, status perkawinan, keanggotaan koperasi
- Identifikasi tren dan anomali dalam data monitoring
- Memberikan rekomendasi strategis berbasis data untuk peningkatan ketahanan usaha tani
- Memahami konteks pertanian organik dan sertifikasi ICS
- Expert dalam interpretasi statistik dan KPI pertanian

DATA DEMOGRAFIS YANG SELALU TERSEDIA:
- ageGroups: Distribusi kelompok umur (contoh: 18-25, 26-35, 36-50, dst)
- gender: Profil gender (laki-laki/perempuan)
- education: Pendidikan terakhir (SD, SMP, SMA, Diploma, S1, dst)
- youth: Keterlibatan pemuda
- maritalStatus: Status perkawinan
- cooperativeMembership: Keanggotaan koperasi

PRINSIP KOMUNIKASI:
1. SELALU gunakan data spesifik dari dashboard - jangan generalisasi atau asumsi
2. Jawab pertanyaan dengan LANGSUNG dan KONKRET - bukan intro panjang
3. Gunakan bahasa profesional namun tetap aksesbel untuk praktisi lapangan
4. Untuk setiap claim, sertakan sumber data dan perbandingan (naik/turun berapa %, target vs aktual, dll)
5. Jika ada insight penting tapi data kurang, katakan "berdasarkan data terbatas, estimasi kami..." bukan "tidak ada data"
6. Beri rekomendasi actionable - apa, bagaimana, dan mengapa

FORMAT RESPONS (FLEKSIBEL - pilih yang paling sesuai):
- Jika pertanyaan sederhana: jawab 1-2 paragraf dengan angka spesifik
- Jika pertanyaan kompleks: buka dengan insight utama, lalu breakdown dengan data, tutup dengan rekomendasi
- Jika butuh perbandingan: gunakan tabel mental atau poin-poin (jangan tabel ASCII)
- Jika ada warning/risiko: highlight dengan tegas dan sertakan aksi mitigasi

CONTOH RESPONS YANG POWERFUL:
❌ "Data menunjukkan 45% responden adalah perempuan"
✅ "45% responden adalah perempuan (trend naik 12% dari periode lalu), terutama di Boyolali (58%), menunjukkan peluang peningkatan adopsi teknik organik di kelompok perempuan"

JANGAN:
- Menolak menjawab karena "data kurang"
- Menjawab di luar konteks monitoring pertani
- Mengatakan "saya AI jadi..." atau referensi diri yang tidak perlu
- Format rigid dengan heading yang sama untuk semua pertanyaan
- Jawab panjang (max 250 kata) kecuali diminta detail mendalam`
}

function buildPrompt(question: string, payload: Record<string, unknown>) {
  const filters = payload.filters as Record<string, string> | undefined
  const dashboard = payload.dashboard as Record<string, number> | undefined
  const analyticsRaw = payload.analytics as Record<string, unknown> | undefined
  const analytics = analyticsRaw ? extractDashboardSummary(analyticsRaw) : {}

  const contextData = {
    filters: filters ?? {},
    dashboard: dashboard ?? {},
    analytics: analytics ?? {},
  }

  return `DATA DASHBOARD SAAT INI:
${JSON.stringify(contextData, null, 2)}

Pertanyaan: "${question}"`
}

function buildMessages(question: string, payload: Record<string, unknown>, history?: Message[]) {
  const systemPrompt = buildSystemPrompt()
  
  // If no history, include system prompt with first question
  if (!history || history.length === 0) {
    return [
      {
        role: 'user' as const,
        parts: [{ text: `${systemPrompt}\n\n${buildPrompt(question, payload)}` }],
      },
    ]
  }
  
  // With history, reconstruct conversation
  const messages = history.map((msg) => ({
    role: msg.role as 'user' | 'model',
    parts: [{ text: msg.content }],
  }))
  
  // Add new question
  messages.push({
    role: 'user' as const,
    parts: [{ text: buildPrompt(question, payload) }],
  })
  
  return messages
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

    const history = payload.history as Message[] | undefined
    const messages = buildMessages(question, payload, history)

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY,
      },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        contents: messages,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
          topP: 0.9,
          topK: 40,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let providerMessage = errorText
      try {
        const errorData = JSON.parse(errorText) as { error?: { message?: string } }
        providerMessage = errorData.error?.message || errorText
      } catch { /* Keep the raw response */ }
      const message = response.status === 503
        ? 'Layanan Gemini sedang sibuk. Silakan coba lagi dalam beberapa saat.'
        : response.status === 429
          ? 'Batas penggunaan Gemini sedang tercapai. Silakan coba lagi nanti.'
          : response.status === 401 || response.status === 403
            ? 'API key Gemini tidak diterima. Periksa GEMINI_API_KEY di environment.'
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
        answer: fallbackAnswer(payload, 'Gemini membutuhkan waktu terlalu lama.'),
      })
    }
    console.error('Assistant error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan saat meminta AI.' }, { status: 500 })
  }
}
