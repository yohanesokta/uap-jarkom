# Panduan Penerapan (Deployment), Kompilasi Aplikasi, dan Publikasi Soal

Panduan ini menjelaskan langkah-demi-langkah operasional untuk:

1. Menerapkan infrastruktur backend (Cloudflare Workers, D1 Database, R2 Object Storage).
2. Mempublikasikan Web Management Dashboard ke Cloudflare Pages.
3. Mengompilasi dan mendistribusikan Exam Client Desktop (Linux, Windows, macOS).
4. Menerbitkan dan mengamankan soal ujian Cisco Packet Tracer (.pka) hingga pengunduhan hasil jawaban mahasiswa.

---

## 1. Prasyarat Lingkungan & Alat (Prerequisites)

Pastikan peralatan berikut telah terpasang pada komputer administrator/pengembang:

- **Node.js**: Versi 20+ LTS dan npm
- **Wrangler CLI**: Pasang secara global atau gunakan via npx (`npm install -g wrangler`)
- **Flutter SDK**: Versi 3.20+ (Channel stable) dengan dukungan desktop Linux/Windows/macOS
- **OpenSSL**: Untuk membangkitkan Master Secret Key 256-bit
- **Akun Cloudflare**: Dengan akses ke Cloudflare Workers, Cloudflare D1, dan Cloudflare R2

---

## 2. Penerapan Infrastruktur Backend (Cloudflare Workers API)

### 2.1 Login ke Cloudflare via Wrangler

```bash
npx wrangler login
```

### 2.2 Membuat R2 Storage Bucket

Buat bucket penyimpanan objek untuk menyimpan berkas soal dan jawaban terenkripsi:

```bash
npx wrangler r2 bucket create exam-storage-bucket
```

### 2.3 Membuat Basis Data Cloudflare D1

Buat database relasional D1:

```bash
npx wrangler d1 create exam-database
```

_Catatan_: Wrangler akan menampilkan `database_id`. Buka berkas [wrangler.toml](file:///home/yohanesokta/Dokumen/code/PKA_ENCRIPT/workers/api/wrangler.toml) dan sesuaikan nilainya:

```toml
[[d1_databases]]
binding = "DB"
database_name = "exam-database"
database_id = "<DATABASE_ID_DARI_CLOUDFLARE>"
migrations_dir = "migrations"
```

### 2.4 Membangkitkan & Menyimpan Master Secret Key

Kunci master enkripsi sistem (MEK) wajib disimpan pada Workers Secrets. Bangkitkan 32-byte acak heksadesimal (256-bit):

```bash
# Bangkitkan kunci heksadesimal 64 karakter
openssl rand -hex 32
```

Simpan kunci tersebut sebagai secret di Cloudflare Worker:

```bash
cd workers/api
npx wrangler secret put MASTER_KEY_SECRET
# Masukkan nilai hex hasil openssl ketika diminta
```

### 2.5 Menjalankan Migrasi Skema Basis Data D1

Terapkan skema tabel relasional ([0001_initial_schema.sql](file:///home/yohanesokta/Dokumen/code/PKA_ENCRIPT/workers/api/migrations/0001_initial_schema.sql)) ke peladen Cloudflare:

```bash
cd workers/api
npx wrangler d1 execute exam-database --remote --file=migrations/0001_initial_schema.sql
```

### 2.6 Menerapkan (Deploy) Worker API

```bash
cd workers/api
npm install
npm run deploy
```

Setelah deploy selesai, salin URL publik Worker yang diberikan oleh Cloudflare (contoh: `https://packet-tracer-exam-api.<subdomain>.workers.dev`).

---

## 3. Publikasi Web Admin Management Dashboard

### 3.1 Konfigurasi Alamat API Backend

Buka direktori `apps/dashboard` dan buat berkas `.env.production`:

```bash
cd apps/dashboard
echo "VITE_API_BASE_URL=https://packet-tracer-exam-api.<subdomain>.workers.dev" > .env.production
```

### 3.2 Membangun Aplikasi Web

```bash
cd apps/dashboard
npm install
npm run build
```

Hasil build produksi yang dioptimalkan akan berada pada direktori `apps/dashboard/dist/`.

### 3.3 Deploy ke Cloudflare Pages

Deploy direktori `dist` ke Cloudflare Pages secara langsung:

```bash
cd apps/dashboard
npx wrangler pages deploy dist --project-name=packet-tracer-dashboard
```

Buka URL Cloudflare Pages yang dihasilkan untuk mengakses dasbor dosen.

---

## 4. Kompilasi & Distribusi Aplikasi Desktop Siswa (Flutter)

Sebelum melakukan kompilasi rilis, pastikan konfigurasi alamat server default pada [app_constants.dart](file:///home/yohanesokta/Dokumen/code/PKA_ENCRIPT/apps/desktop/lib/core/constants/app_constants.dart) telah diarahkan ke URL produksi Worker:

```dart
static const String defaultApiBaseUrl = 'https://packet-tracer-exam-api.<subdomain>.workers.dev';
```

### 4.1 Kompilasi untuk Linux

Jalankan perintah kompilasi release:

```bash
cd apps/desktop
flutter build linux --release
```

Biner dan pustaka pendukung akan dihasilkan di:
`apps/desktop/build/linux/x64/release/bundle/`

**Pengemasan Arsip Distribusi Linux**:

```bash
cd apps/desktop/build/linux/x64/release
tar -czvf PacketTracerExamClient-Linux.tar.gz bundle/
```

### 4.2 Kompilasi untuk Microsoft Windows

Jalankan perintah kompilasi pada perangkat Windows:

```bash
cd apps/desktop
flutter build windows --release
```

Biner akan dihasilkan di:
`apps/desktop/build/windows/x64/runner/Release/`

**Pengemasan Arsip Distribusi Windows**:
Kompres seluruh folder `Release/` menjadi berkas `PacketTracerExamClient-Windows.zip` atau gunakan _Inno Setup Compiler_ untuk membuat installer `.exe`.

### 4.3 Kompilasi untuk Apple macOS

Jalankan perintah kompilasi pada perangkat macOS:

```bash
cd apps/desktop
flutter build macos --release
```

Aplikasi akan dihasilkan di:
`apps/desktop/build/macos/Build/Products/Release/desktop.app`

### 4.4 Otomatisasi Kompilasi & Rilis via GitHub Actions (Rekomendasi)

Telah disediakan alur kerja otomatis pada [.github/workflows/build-desktop.yml](file:///.github/workflows/build-desktop.yml) yang mengompilasi ketiga platform sekaligus dan menghasilkan paket siap pakai:

1. **Microsoft Windows (Release Zip Bundle)**:
   - Dikompilasi menggunakan `flutter build windows --release`.
   - Seluruh berkas rilis (`desktop.exe`, pustaka `.dll`, dan folder `data/`) dikompresi ke dalam berkas ZIP siap pakai.
   - Administrator dapat mendistribusikannya langsung atau mengonfigurasi installer (seperti Inno Setup atau NSIS) secara mandiri.
   - Hasil berkas: `PacketTracerExamClient-Windows.zip`.

2. **Linux (AppImage Portable)**:
   - Dikemas menggunakan `appimagetool` resmi dengan struktur `AppDir`.
   - Mengikutsertakan skrip loader `AppRun`, pustaka Flutter GTK3, serta ikon desktop.
   - Portable dan dapat dijalankan langsung di Ubuntu, Debian, Fedora, Arch Linux tanpa instalasi.
   - Hasil berkas: `PacketTracerExamClient-Linux-x86_64.AppImage`.

3. **Apple macOS (.dmg Disk Image)**:
   - Dikemas ke dalam format image disk terkompresi UDZO (`hdiutil`).
   - Menyertakan bundel aplikasi `Packet Tracer Exam Client.app` dan symlink drag-and-drop ke direktori `/Applications`.
   - Hasil berkas: `PacketTracerExamClient-macOS.dmg`.

**Cara Menjalankan Alur Kerja GitHub Actions**:
- **Manual**: Masuk ke tab **Actions** di repositori GitHub, pilih **Build Flutter Desktop Applications**, lalu klik **Run workflow**.
- **Otomatis via Git Tag**: Buat dan push tag rilis untuk memicu kompilasi serta membuat GitHub Release otomatis:
  ```bash
  git tag v1.0.0
  git push origin v1.0.0
  ```
  GitHub Release akan dibuat secara otomatis dan memuat ketiga installer siap unduh bagi mahasiswa.

---

## 5. Prosedur Penerbitan dan Pengelolaan Soal Ujian (SOP Dosen)

### Langkah 1: Persiapan Berkas Soal di Cisco Packet Tracer

1. Buka Cisco Packet Tracer dan susun topologi jaringan ujian.
2. Gunakan fitur _Activity Wizard_ Packet Tracer jika ingin menetapkan skor otomatis atau penguncian konfigurasi awal.
3. Simpan berkas dengan ekstensi standar `.pka` (contoh: `Praktikum_Routing_OSPF.pka`).

### Langkah 2: Pendaftaran Kelompok Kelas

1. Buka Web Admin Management Dashboard di browser.
2. Masuk ke tab **Kelompok Kelas**.
3. Klik tombol **Tambah Kelas Baru**.
4. Masukkan Kode Kelas (contoh: `TI-3A`) dan Nama Kelas.
5. Klik **Simpan Kelas**.

### Langkah 3: Menerbitkan & Mengenkripsi Soal Ujian

1. Masuk ke tab **Mata Ujian**.
2. Klik tombol **Buat Ujian Baru**.
3. Isi data formulir:
   - **Judul Ujian**: Contoh: `Ujian Tengah Semester Praktikum Jaringan Komputer`.
   - **Deskripsi**: Petunjuk pengerjaan bagi peserta ujian.
   - **Kelompok Kelas**: Pilih kelas yang berhak mengikuti ujian ini.
   - **Durasi (Menit)**: Contoh: `90`.
   - **Berkas Soal (.pka)**: Unggah berkas `Praktikum_Routing_OSPF.pka`.
4. Klik **Buat Ujian**.
5. Sistem secara otomatis melakukan:
   - Pembangkitan Data Encryption Key (DEK) acak 256-bit.
   - Enkripsi berkas menggunakan AES-256-GCM.
   - Pembungkusan DEK menggunakan Master Key di Cloudflare Secrets.
   - Penyimpanan kontainer `.examenc` ke Cloudflare R2.
   - Pembangkitan otomatis **Kode Akses Ujian (Exam Code)** (contoh: `EXAM-A89B2C`).

### Langkah 4: Pelaksanaan Ujian oleh Siswa

1. Bagikan aplikasi Exam Client kepada mahasiswa (atau pasang di komputer laboratorium).
2. Tampilkan Kode Akses Ujian (misal: di proyektor laboratorium saat jam ujian dimulai).
3. Mahasiswa membuka Exam Client dan mengisikan:
   - NIM
   - Nama Lengkap
   - Kode Kelas (contoh: `TI-3A`)
   - Kode Akses Ujian
4. Exam Client memvalidasi sesi, mengunduh kontainer terenkripsi, mendekripsi soal ke workspace sementara berizin 0700, dan membuka aplikasi Cisco Packet Tracer secara otomatis.

### Langkah 5: Rotasi Kode Akses Ujian (Pencegahan Kebocoran)

Jika sesi ujian untuk kelompok kelas tertentu telah selesai atau terdapat indikasi kode tersebar ke kelas lain:

1. Masuk ke tab **Mata Ujian**.
2. Temukan ujian terkait dan klik tombol **Rotasi Kode**.
3. Kode lama akan dicabut (_revoked_) seketika dan kode baru akan aktif.

### Langkah 6: Mengunduh dan Menilai Hasil Pengerjaan Mahasiswa

1. Segera setelah mahasiswa menutup Packet Tracer, berkas jawaban dienkripsi dan diunggah otomatis ke Cloudflare R2.
2. Dosen membuka tab **Submisi Mahasiswa** pada Dashboard.
3. Tabel akan menampilkan daftar jawaban masuk lengkap dengan NIM, Nama Mahasiswa, Ukuran Berkas, Status Verifikasi, dan Checksum SHA-256.
4. Klik tombol **Unduh .PKA** pada baris mahasiswa terkait:
   - Server Cloudflare Worker secara aman membuka kunci jawaban mahasiswa dari R2.
   - Berkas `.pka` asli yang siap dinilai di Packet Tracer diunduh langsung ke komputer dosen.
5. Gunakan tombol **Ekspor Metadata CSV** untuk merekapitulasi presensi pengumpulan seluruh mahasiswa.

---

## 6. Prosedur Darurat & Pemulihan (Disaster Recovery)

Jika laboratorium mengalami gangguan jaringan internet mendadak:

1. Siswa **tidak perlu mengulang ujian**. Berkas jawaban telah tersimpan di direktori cadangan lokal dengan enkripsi AES-256-GCM ([.examenc](file:///home/yohanesokta/Dokumen/code/PKA_ENCRIPT/docs/recovery.md)).
2. Setelah koneksi kembali normal:
   - Siswa dapat membuka kembali Exam Client dan mengklik **Buka Layar Pemulihan Cadangan Lokal**.
   - Klik **Unggah Ulang** pada berkas cadangan terkait.
3. Alternatif pengawas: Berkas `.examenc` dari folder cadangan perangkat dapat disalin ke flashdisk oleh pengawas dan tetap aman karena terenkripsi penuh.
