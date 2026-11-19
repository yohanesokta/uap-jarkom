# Panduan Penerapan (Deployment Guide)

## 1. Persyaratan Lingkungan (Prerequisites)

Untuk menerapkan sistem ini ke lingkungan produksi, dibutuhkan komponen berikut:
1. Akun Cloudflare dengan layanan:
   - Cloudflare Workers (Paid plan / Standard plan).
   - Cloudflare D1 Database.
   - Cloudflare R2 Object Storage.
2. Node.js versi 20+ LTS dan npm / pnpm.
3. Wrangler CLI (`npm install -g wrangler`).
4. Flutter SDK 3.20+ untuk kompilasi biner aplikasi desktop (Windows, Linux, macOS).

---

## 2. Penerapan Backend (Cloudflare Workers)

### 2.1 Konfigurasi Sumber Daya Cloudflare
Buat bucket R2 dan database D1 melalui antarmuka perintah Wrangler:

```bash
# 1. Buat Bucket R2 untuk penyimpanan berkas ujian dan jawaban
npx wrangler r2 bucket create exam-storage-bucket

# 2. Buat Basis Data D1
npx wrangler d1 create exam-database
```

Salin nilai `database_id` yang dihasilkan ke berkas konfigurasi `wrangler.toml` di dalam direktori `workers/api/wrangler.toml`.

### 2.2 Inisialisasi Master Secret Key
Bangkitkan kunci enkripsi master berkekuatan 256-bit acak dalam bentuk heksadesimal dan simpan sebagai Worker Secret:

```bash
# Bangkitkan 32-byte kunci acak hex
openssl rand -hex 32

# Simpan sebagai secret pada Cloudflare Workers
npx wrangler secret put MASTER_KEY_SECRET --config workers/api/wrangler.toml
```

### 2.3 Menjalankan Migrasi Skema Basis Data D1
Terapkan skema tabel ke D1:

```bash
npx wrangler d1 execute exam-database --file=workers/api/migrations/0001_initial_schema.sql --remote
```

### 2.4 Menerapkan Worker ke Cloudflare
```bash
cd workers/api
npm install
npm run deploy
```

---

## 3. Penerapan Dashboard Web Admin (Cloudflare Pages)

Aplikasi dasbor admin dibangun sebagai aplikasi Single Page Application (SPA) berbasis Vite:

```bash
cd apps/dashboard
npm install
npm run build
npx wrangler pages deploy dist --project-name=packet-tracer-exam-dashboard
```

Pastikan variabel lingkungan disetel:
- `VITE_API_BASE_URL`: URL publik dari Cloudflare Worker API.

---

## 4. Kompilasi Klien Desktop (Exam Client)

### 4.1 Linux
```bash
cd apps/desktop
flutter build linux --release
# Output biner: build/linux/x64/release/bundle/
```

### 4.2 Windows
```bash
cd apps/desktop
flutter build windows --release
# Output biner: build/windows/x64/runner/Release/
```

### 4.3 macOS
```bash
cd apps/desktop
flutter build macos --release
# Output biner: build/macos/Build/Products/Release/
```

### 4.4 Otomatisasi Kompilasi via GitHub Actions
Berkas alur kerja [.github/workflows/build-desktop.yml](file:///.github/workflows/build-desktop.yml) menyediakan build otomatis untuk ketiga platform:
- **Windows**: Menggunakan 7-Zip Extra SFX (`7zSD.sfx`) dengan konfigurasi `InstallPath="%PROGRAMFILES%\PacketTracerExamClient"` dan auto-run `desktop.exe` dalam satu berkas `.exe` mandiri.
- **Linux**: Menggunakan `appimagetool` untuk mengemas bundel menjadi berkas portable `.AppImage`.
- **macOS**: Menggunakan `hdiutil` untuk membuat berkas installer `.dmg` dengan symlink ke direktori `/Applications`.
- **Rilis Otomatis**: Men-trigger pembuatan GitHub Release otomatis saat tag git `v*` di-push.
