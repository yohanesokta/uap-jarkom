# Panduan Pengembangan (Development Guide)

## 1. Lingkungan Pengembangan Lokal

Repositori ini disusun sebagai monorepo modular dengan struktur:
- `packages/exam-format`: Pustaka parser/encoder format biner `.examenc`.
- `workers/api`: Layanan Cloudflare Workers REST API.
- `apps/dashboard`: Antarmuka manajemen dosen berbasis web.
- `apps/desktop`: Aplikasi ujian siswa berbasis Flutter desktop.

### 1.1 Persiapan Awal
Pastikan peralatan berikut telah terpasang pada komputer pengembang:
- Node.js versi 20+ dan npm
- Flutter SDK (channel stable)
- Linux C++ compiler (`clang`, `cmake`, `ninja`, `pkg-config`, `libgtk-3-dev`) untuk kompilasi Flutter desktop di Linux

Jalankan instalasi dependensi di tingkat akar:
```bash
npm install
```

---

## 2. Menjalankan Komponen Pengembangan

### 2.1 Backend API Lokal (Wrangler Dev)
Jalankan backend dengan simulasi D1 dan R2 lokal:
```bash
cd workers/api
npm install
npx wrangler d1 execute exam-database --local --file=migrations/0001_initial_schema.sql
npm run dev
```
Peladen API lokal akan berjalan pada `http://127.0.0.1:8787`.

### 2.2 Web Dashboard Lokal
```bash
cd apps/dashboard
npm install
npm run dev
```
Dasbor akan terbuka pada `http://127.0.0.1:5173`.

### 2.3 Exam Client Desktop Lokal
```bash
cd apps/desktop
flutter pub get
flutter run -d linux
```

---

## 3. Menjalankan Pengujian Otomatis (Automated Testing)

Sesuai aturan ketat proyek, operasi kriptografi dan alur bisnis penting wajib memiliki unit test dan integration test:

```bash
# Uji unit format biner kontainer kriptografi
cd packages/exam-format
npm test

# Uji unit backend worker & crypto
cd ../../workers/api
npm test

# Uji unit Flutter Desktop client
cd ../../apps/desktop
flutter test
```

## 4. Standar Kode Bersih
1. Tidak ada baris komentar di dalam berkas kode sumber. Seluruh kode harus jelas secara mandiri (*self-documenting*) melalui penamaan fungsi, variabel, dan kelas yang deskriptif.
2. Penanganan galat (*error handling*) harus eksplisit tanpa blok kosong (*no empty catch blocks*).
3. Pengetikan ketat (*strict typing*) aktif di TypeScript dan Dart.
