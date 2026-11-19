# Packet Tracer Examination Management System

Sistem manajemen dan pengamanan ujian praktikum jaringan berbasis Cisco Packet Tracer (.pka) lintas platform dengan enkripsi simetris terotentikasi (AES-256-GCM), pengawasan proses otomatis, persistensi cadangan lokal, antarmuka klien desktop bergaya GNOME (Flutter Desktop), dasbor administrasi terinspirasi Vercel (React + Tailwind CSS), serta backend berbasis Cloudflare Workers, R2, dan D1.

## Struktur Repositori

```
.
├── apps/
│   ├── desktop/             # Aplikasi Siswa Flutter Desktop (Linux, Windows, macOS)
│   └── dashboard/           # Dasbor Web Admin Dosen (Vite + React 19 + Tailwind CSS)
├── workers/
│   └── api/                 # Cloudflare Workers REST API, D1 Migrations, R2
├── packages/
│   └── exam-format/         # Pustaka Kontainer Biner Kriptografi EXAMENC
├── docs/                    # Dokumentasi Teknis Lengkap Sistem
│   ├── architecture.md
│   ├── security.md
│   ├── cryptography.md
│   ├── encryption-format.md
│   ├── api-reference.md
│   ├── database-schema.md
│   ├── desktop-integration.md
│   ├── packet-tracer-integration.md
│   ├── deployment.md
│   ├── development.md
│   ├── recovery.md
│   └── threat-model.md
├── package.json
├── DEPLOY_DAN_PUBLISH.md    # Panduan Lengkap Deploy, Kompilasi & SOP Publikasi Soal
└── README.md
```

## Cara Menjalankan & Menguji Proyek

### 1. Format Kontainer Kriptografi (`packages/exam-format`)
```bash
cd packages/exam-format
npm install
npm test
npm run build
```

### 2. Backend Cloudflare Workers API (`workers/api`)
```bash
cd workers/api
npm install
npm test
# Menjalankan dev server lokal Cloudflare
npx wrangler dev
```

### 3. Exam Client Desktop (`apps/desktop`)
```bash
cd apps/desktop
flutter pub get
flutter test
flutter run -d linux
```

### 4. Admin Management Dashboard (`apps/dashboard`)
```bash
cd apps/dashboard
npm install
npm run build
npm run dev
```

## Spesifikasi Kriptografi

- Algoritma Enkripsi Utama: AES-256-GCM (Panjang kunci 256-bit, Nonce CSPRNG 96-bit, Auth Tag 128-bit)
- Format Kontainer Biner: `EXAMENC` versi 1 (Big-Endian Network Byte Order)
- Integritas & Anti-Tampering: Checksum SHA-256 dan Additional Authenticated Data (AAD)
- Kunci Induk (Master Secret): Disimpan eksklusif pada Cloudflare Workers Secrets tanpa pernah diekspos ke klien
- Format Berkas Cadangan Lokal: `.examenc` tersimpan di ruang penyimpanan aman perangkat mahasiswa
