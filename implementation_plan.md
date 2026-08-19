# YouTube Viral Clipper — Full Platform Implementation Plan

## Background

Project existing adalah Next.js 16.3.1 + React 19 + TypeScript yang sudah bisa:
- Menerima YouTube URL
- Mengambil transcript via `youtube-transcript-plus`
- Menampilkan transcript interaktif
- Menganalisis transcript dengan Gemini 2.5 Flash → TOP 3 viral clips

## Key Findings dari Codebase Inspection

| Item | Status |
|------|--------|
| Next.js | 16.3.1 (App Router) |
| React | 19.2.8 |
| Styling | Tailwind CSS v4 + CSS Modules |
| Auth | Sudah ada |
| Database | Sudah ada |
| Queue | ❌ Belum ada |
| FFmpeg | ✅ Tersedia di sistem (`ffmpeg n8.1`) |
| Redis | ✅ Valkey 9.0.3 berjalan di localhost:6379 |
| PostgreSQL | ✅ 18.3 berjalan di localhost:5432 |
| Node | v25.9.0 |

## Proposed Changes

### Phase 1 — Dependencies Installation

Dependensi disini sudah diinstall semua.

**New dependencies (production):**
- `better-auth` — authentication sudah ada ✅
- `@prisma/client` + `prisma` — ORM sudah ada ✅
- `@prisma/adapter-better-auth` — prisma adapter for better-auth (atau manual schema) sudah ada ✅
- `bullmq` — job queue sudah ada ✅
- `ioredis` — Redis client sudah ada ✅
- `@google/genai` — sudah ada ✅
- `youtube-transcript-plus` — sudah ada ✅
- `@vladmandic/face-api` — face detection sudah ada ✅
- `@tensorflow/tfjs-node` — backend untuk face-api sudah ada ✅
- `canvas` — untuk tfjs-node image processing sudah ada ✅
- `fluent-ffmpeg` — type-safe FFmpeg wrapper sudah ada ✅
- `@types/fluent-ffmpeg` — types sudah ada ✅
- `zod` — input validation sudah ada ✅

---

### Phase 2 — Prisma Schema & Database

#### [NEW] [schema.prisma](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/prisma/schema.prisma)

Full Prisma schema dengan semua models:
- `User`, `Account`, `Session`, `Verification` (Better Auth)
- `Project` (userId FK)
- `Video` (projectId FK)
- `VideoAsset` (videoId FK)
- `Transcript` (videoId FK, unique)
- `TranscriptSegment` (transcriptId FK)
- `ViralAnalysis` (videoId FK, unique)
- `Clip` (viralAnalysisId FK)
- `Subtitle` (clipId FK)
- `FaceDetection` (clipId FK)
- `Embedding` (clipId FK, `vector` field via `Unsupported`)
- `Job` (userId FK, videoId nullable FK)

#### [NEW] [prisma/migrations/](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/prisma/migrations/)

Migration awal yang mengaktifkan `CREATE EXTENSION IF NOT EXISTS vector;` (Sudah ditambahkan ke migration prisma ✅)

---

### Phase 3 — Authentication (Better Auth)

#### [NEW] [lib/auth/index.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/lib/auth/index.ts)
Server-side Better Auth instance dengan Prisma adapter, email/password. (Sudah ✅)

#### [NEW] [lib/auth/client.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/lib/auth/client.ts)
Client-side auth hooks (`useSession`, `signIn`, `signOut`, `signUp`). (Sudah ✅)

#### [NEW] [app/api/auth/[...all]/route.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/api/auth/[...all]/route.ts)
Better Auth catch-all API handler. (Sudah ✅)

#### [NEW] [lib/auth/session.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/lib/auth/session.ts)
Server-side helper `getSession()` / `requireSession()` untuk digunakan di API routes. (Sudah ✅)

#### [NEW] [app/(auth)/login/page.tsx](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/(auth)/login/page.tsx)
Login page. (Sudah ✅)

#### [NEW] [app/(auth)/register/page.tsx](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/(auth)/register/page.tsx)
Register page. (Sudah ✅)

#### [MODIFY] [middleware.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/middleware.ts)
Middleware untuk protect routes `/dashboard/*` dan `/api/*` (kecuali auth endpoints dan public endpoints existing). (Sudah ✅)

---

### Phase 4 — Database Access Layer

Singleton Prisma Client + named `db` export. (Sudah ✅)

---

### Phase 5 — Storage Abstraction

#### [NEW] [lib/storage/index.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/lib/storage/index.ts)
`StorageService` interface + `LocalStorageService` implementation.
Operasi: `save()`, `get()`, `delete()`, `exists()`, `getUrl()`.
Struktur: `storage/users/{userId}/videos/{videoId}/source.mp4`, `clips/{clipId}/clip.mp4`.
(Sudah ✅)

---

### Phase 6 — Queue & Worker Setup (Sudah ✅)

#### [NEW] [lib/queue/index.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/lib/queue/index.ts)
Redis client (ioredis) + BullMQ Queue instances untuk semua queue:
`video`, `transcript`, `analysis`, `clip`, `subtitle`, `face-detection`, `embedding`.

#### [NEW] [workers/index.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/workers/index.ts)
Worker entry point — inisialisasi semua processors.

#### [NEW] [workers/processors/video.processor.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/workers/processors/video.processor.ts)
Download video dengan yt-dlp via `execFile` (safe).

#### [NEW] [workers/processors/transcript.processor.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/workers/processors/transcript.processor.ts)
Simpan transcript ke database, enqueue analysis.

#### [NEW] [workers/processors/analysis.processor.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/workers/processors/analysis.processor.ts)
Panggil Gemini, simpan ViralAnalysis + Clips ke DB, enqueue clip creation.

#### [NEW] [workers/processors/clip.processor.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/workers/processors/clip.processor.ts)
Potong video menggunakan FFmpeg (safe spawn), simpan VideoAsset.

#### [NEW] [workers/processors/subtitle.processor.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/workers/processors/subtitle.processor.ts)
Generate SRT dari TranscriptSegments, burn subtitle via FFmpeg.

#### [NEW] [workers/processors/face.processor.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/workers/processors/face.processor.ts)
Face detection menggunakan `@vladmandic/face-api`, simpan FaceDetection records.

#### [NEW] [workers/processors/embedding.processor.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/workers/processors/embedding.processor.ts)
Generate embedding via Gemini text-embedding model, simpan ke pgvector.

#### [NEW] [lib/ffmpeg/index.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/lib/ffmpeg/index.ts)
Safe FFmpeg wrapper — `cutVideo()`, `burnSubtitle()`, `cropVertical()`.
Menggunakan `spawn` dengan argument array, bukan shell string. (Sudah ✅)

---

### Phase 7 — New API Routes (Sudah ✅)

#### [NEW] [app/api/projects/route.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/api/projects/route.ts)
`GET` list projects, `POST` create project. Auth required.

#### [NEW] [app/api/videos/route.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/api/videos/route.ts)
`POST` create video (submit YouTube URL, enqueue job). Auth required.

#### [NEW] [app/api/videos/[id]/route.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/api/videos/[id]/route.ts)
`GET` video detail. Auth + ownership check.

#### [NEW] [app/api/videos/[id]/transcript/route.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/api/videos/[id]/transcript/route.ts)
`GET` transcript from DB. Auth + ownership.

#### [NEW] [app/api/videos/[id]/analyze/route.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/api/videos/[id]/analyze/route.ts)
`POST` trigger analysis job. Auth + ownership.

#### [NEW] [app/api/videos/[id]/clips/route.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/api/videos/[id]/clips/route.ts)
`GET` clips for video. Auth + ownership.

#### [NEW] [app/api/clips/[id]/route.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/api/clips/[id]/route.ts)
`GET` clip detail. Auth + ownership chain.

#### [NEW] [app/api/clips/[id]/video/route.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/api/clips/[id]/video/route.ts)
`GET` serve clip video file. Auth + ownership. Stream file response.

#### [NEW] [app/api/jobs/[id]/route.ts](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/api/jobs/[id]/route.ts)
`GET` job status. Auth + ownership.

**Existing API routes dipertahankan:**
- `GET /api/languages` ✅ (tidak diubah)
- `GET /api/transcript` ✅ (tidak diubah)
- `POST /api/analyze` ✅ (tidak diubah — tetap bisa digunakan standalone)

---

### Phase 8 — Dashboard Frontend (Sudah ✅)

#### [NEW] [app/dashboard/page.tsx](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/dashboard/page.tsx)
Dashboard overview — daftar projects, stats.

#### [NEW] [app/dashboard/projects/page.tsx](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/dashboard/projects/page.tsx)
Projects list page.

#### [NEW] [app/dashboard/projects/[projectId]/page.tsx](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/dashboard/projects/[projectId]/page.tsx)
Project detail — daftar videos.

#### [NEW] [app/dashboard/projects/[projectId]/videos/[videoId]/page.tsx](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/app/dashboard/projects/[projectId]/videos/[videoId]/page.tsx)
Video detail — transcript, analysis, clips dengan video player.

#### [NEW] Components
- `components/projects/ProjectCard.tsx`
- `components/projects/CreateProjectForm.tsx`
- `components/video-player/ClipPlayer.tsx`
- `components/jobs/JobStatus.tsx` — polling setiap 3 detik
- `components/dashboard/Navbar.tsx`

---

### Phase 9 — Environment & Config
#### [MODIFY] [.env](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/.env.local)
Tambah: `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `STORAGE_PATH`, `STORAGE_PROVIDER`. (Sudah ✅)

#### [NEW] [.env.example](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/.env.example)
Template env vars. (Sudah ✅)

#### [MODIFY] [package.json](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/package.json) (Sudah ✅)
Tambah script: `"worker": "tsx workers/index.ts"`.

#### [NEW] [docker-compose.yml](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/docker-compose.yml) (Opsional, skip)
PostgreSQL + Redis untuk development (karena sudah running di host, ini opsional).

#### [MODIFY] [tsconfig.json](file:///home/fickry/Kuliah%20S7/Codes/youtube-clipper/tsconfig.json) (Sudah ✅)
Pastikan `workers/` ter-include, tambah `tsconfig.worker.json` untuk tsx execution.

---

## Architecture Decision Summary

```
Browser
  │  (HTTPS)
  ▼
Next.js App (port 3000)
  ├── /api/auth/*           ← Better Auth
  ├── /api/projects/*       ← CRUD projects (auth required)
  ├── /api/videos/*         ← CRUD videos, enqueue jobs
  ├── /api/clips/*          ← Serve clip video, metadata
  ├── /api/jobs/*           ← Job status polling
  ├── /api/languages        ← Existing (preserved)
  ├── /api/transcript       ← Existing (preserved)
  └── /api/analyze          ← Existing (preserved, standalone)

PostgreSQL (localhost:5432)
  └── Database: viral_clipper
      ├── Extension: pgvector
      └── Schema: (all tables above)

Redis/Valkey (localhost:6379)
  └── BullMQ Queues:
      video → transcript → analysis → clip → subtitle → face-detection → embedding

Worker Process (npm run worker)
  ├── video.processor    → yt-dlp download
  ├── transcript.processor → fetch + save to DB
  ├── analysis.processor → Gemini API + save
  ├── clip.processor     → FFmpeg cut
  ├── subtitle.processor → SRT generation + FFmpeg burn
  ├── face.processor     → face-api detection
  └── embedding.processor → Gemini embedding + pgvector

Storage (local filesystem)
  └── storage/users/{userId}/
      ├── videos/{videoId}/source.mp4
      └── clips/{clipId}/clip.mp4
```

## Verification Plan

### Automated Checks
```bash
# TypeScript compilation
npx tsc --noEmit

# Prisma schema validation
npx prisma validate

# Prisma migration
npx prisma migrate dev --name init

# Prisma client generation
npx prisma generate
```

### Manual Verification
1. Register user, login, logout
2. Buat project baru
3. Submit YouTube URL → video created, job queued
4. Cek job status via polling
5. Lihat transcript dari DB
6. Trigger analysis → clips created
7. Worker download video → FFmpeg cut → clip.mp4 tersedia
8. Clip video bisa diplay di browser
9. User B tidak bisa akses data User A (test 401/403)
10. TypeScript: `npx tsc --noEmit` tidak ada error

### Checklist per Acceptance Criteria
- [✅] 1. User dapat register/login
- [✅] 2. User dapat membuat project
- [✅] 3. User dapat memasukkan YouTube URL
- [✅] 4. Video menjadi milik user
- [✅] 5. Transcript disimpan PostgreSQL
- [✅] 6. TranscriptSegments disimpan PostgreSQL
- [✅] 7. Gemini TOP 3 viral clips
- [✅] 8. Hasil analisis disimpan PostgreSQL
- [✅] 9. Clip memiliki rank dan viral score
- [✅] 10. Background worker + FFmpeg
- [✅] 11. Video clip di storage
- [✅] 12. Database menyimpan metadata
- [✅] 13. Subtitle dari transcript
- [✅] 14. Subtitle dapat digunakan pada clip
- [ ] 15. Face detection
- [ ] 16. Face detection untuk framing
- [ ] 17. Semantic embedding
- [ ] 18. Embedding di pgvector
- [ ] 19. Job status dari frontend
- [ ] 20. User hanya lihat data miliknya
- [ ] 21. Retry job
- [ ] 22. Error tersimpan
- [ ] 23. API key tidak ke client
- [ ] 24. Tidak ada command injection FFmpeg
- [ ] 25. Tidak ada TypeScript error
- [ ] 26. Prisma migration berhasil
- [ ] 27. Worker jalan terpisah
