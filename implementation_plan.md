# Viral Clip Analysis Pipeline

Menambahkan pipeline analisis viral clip ke project YouTube Transcriber yang sudah ada. Setelah transcript berhasil diperoleh, user dapat mengklik tombol "Analyze Viral Clips" yang akan memanggil Gemini API (server-side) untuk mengidentifikasi TOP 3 potensi viral clip.

## Analisis Project Existing

### Alur transcript saat ini
```
page.tsx
  → handleUrlSubmit → GET /api/languages → setLanguages, status='language-selection'
  → handleConfirmLanguage → GET /api/transcript → setSegments, status='ready'
  → TranscriptViewer (videoId, segments, languageCode)
```

### Format data transcript existing
`segments` adalah array `TranscriptSegment[]`:
```ts
{ text: string; offset: number; duration: number; lang?: string }
```
`offset` adalah waktu dalam **seconds** (float). Contoh: `offset: 24.5` → `[00:24]`.

### Styling existing
- Dark theme dengan CSS variables (bg-primary, accent-purple, dll.)
- CSS Modules per komponen
- Font: Inter + JetBrains Mono
- Animasi: fade-in, slide-up, gradient-shift

---

## Proposed Changes

### Dependency Baru

#### [MODIFY] package.json
Tambahkan `@google/genai` (Google GenAI SDK untuk Node.js):
```
@google/genai: ^1.x
```

---

### Types

#### [MODIFY] [types.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/lib/types.ts)
Tambahkan interface baru:
- `ViralCategory` — union type 8 kategori
- `ViralClip` — struktur per clip
- `ViralAnalysisResult` — overall summary + clips
- `AnalyzeRequest` — request body
- `AnalyzeResponse` — API response
- Tambahkan `'analyzing' | 'analysis-ready' | 'analysis-error'` ke `AppStatus`

---

### Backend

#### [NEW] [route.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/api/analyze/route.ts)
`POST /api/analyze`

Pipeline:
1. Parse & validasi request body (`transcript` string)
2. Normalisasi transcript: convert `TranscriptSegment[]` ke format `[MM:SS] text`
3. Call Gemini `gemini-2.5-flash` dengan system prompt lengkap (identik dengan Python prototype)
4. Parse JSON response
5. Validate JSON: semua required fields, score 0–100, end_time > start_time, duration 15–90s
6. Return `AnalyzeResponse`

Error handling:
- 400: transcript kosong atau terlalu panjang (>500KB)
- 500: Gemini error, JSON invalid, missing fields, invalid timestamps
- 503: API key tidak tersedia

---

### Frontend Components

#### [NEW] [ViralClips.tsx](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/components/viral-clips/ViralClips.tsx)
Component baru dengan state machine:
- `idle` → tombol "Analyze Viral Clips" 
- `loading` → animasi loading dengan teks "Menganalisis transcript..."
- `ready` → tampilkan TOP 3 hasil
- `error` → pesan error + tombol "Try Again"

#### [NEW] [ViralClips.module.css](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/components/viral-clips/ViralClips.module.css)
CSS Module yang mengikuti design system existing (CSS variables yang sama).

---

### Page Integration

#### [MODIFY] [page.tsx](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/page.tsx)
- Import `ViralClips` component
- Setelah `status === 'ready'` dan `segments.length > 0`, tampilkan `<ViralClips>` di bawah `<TranscriptViewer>`
- Pass `segments` sebagai prop (tidak perlu mengubah TranscriptViewer)

---

## UI Design

```
[ TranscriptViewer (existing, tidak berubah) ]

─────────────────────────────────────────────

[ 🔥 Analyze Viral Clips Button ]

(setelah klik)

[ ⚡ Menganalisis transcript... ]
[ 🔍 Mencari momen paling berpotensi viral... ]

(setelah selesai)

[ Overall Summary ]

┌──────────────────────────────────────────┐
│ #1  ████████████████████░░ 95/100        │
│ HOOK • PRACTICAL_VALUE                   │
│ Judul Clip                               │
│ 00:30 → 01:15  •  45s                   │
│                                          │
│ Hook: "..."                              │
│ Summary: "..."                           │
│ Why Viral: "..."                         │
│                                          │
│ Strengths: ✓ ... ✓ ...                  │
│ Weaknesses: ⚠ ...                       │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ #2  91/100  ...                          │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ #3  87/100  ...                          │
└──────────────────────────────────────────┘
```

---

## Environment Variable

```env
GEMINI_API_KEY=your_api_key_here
```

Hanya diakses di server-side (`app/api/analyze/route.ts`). **Tidak pernah** menggunakan `NEXT_PUBLIC_`.

---

## Verification Plan

### Automated
- `npm run build` — tidak ada TypeScript error
- `npm run lint` — tidak ada ESLint error

### Manual
- Test dengan video YouTube nyata
- Verifikasi API key tidak muncul di response browser (Network tab)
- Verifikasi loading state muncul selama analisis
- Verifikasi error handling (transcript kosong, API key invalid)
