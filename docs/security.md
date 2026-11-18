# Panduan Keamanan Sistem (Security Policy & Measures)

## 1. Prinsip Desain Keamanan

Sistem Manajemen Ujian Packet Tracer mengadopsi prinsip pertahanan berlapis (*Defense-in-Depth*) dan *Zero Trust Architecture* antara klien dan peladen. Seluruh rancangan keamanan didasarkan pada asumsi bahwa:
1. Lingkungan perangkat klien (komputer mahasiswa) berada di luar batas kendali fisik langsung dan berpotensi mengalami inspeksi atau modifikasi.
2. Jaringan komunikasi dapat mengalami degradasi, putus koneksi, atau intersepsi (*Untrusted Network*).
3. Kerahasiaan soal ujian dan integritas jawaban siswa merupakan prioritas mutlak yang tidak boleh dikompromikan.

## 2. Manajemen Kunci Kriptografi (Key Management)

### 2.1 Master Secret (KMS Cloudflare Secrets)
- Kunci master sistem (Master Encryption Key / MEK) disimpan secara eksklusif dalam environment variabel terenkripsi Cloudflare Workers Secrets (`MASTER_KEY_SECRET`).
- MEK berupa kunci simetris 256-bit berkualitas tinggi yang di-*generate* secara kriptografis melalui CSPRNG.
- MEK tidak pernah:
  - Disertakan dalam repositori Git atau berkas konfigurasi publik.
  - Dikirim ke browser administrator maupun aplikasi desktop mahasiswa.
  - Disimpan dalam metadata objek Cloudflare R2 atau basis data D1.

### 2.2 Hirarki Kunci (Key Hierarchy)
- **Master Encryption Key (MEK)**: Kunci induk 256-bit di Cloudflare Workers.
- **Key Derivation Function (HKDF)**: HKDF-SHA256 digunakan untuk menderivasi Purpose-Specific Key (misal: wrapping key untuk soal, wrapping key untuk jawaban).
- **Data Encryption Key (DEK)**: Setiap berkas ujian maupun berkas jawaban memiliki DEK acak 256-bit tersendiri yang unik dan sekali pakai (*ephemeral DEK*).
- **Session Decryption Key**: Kunci sementara yang diterbitkan server hanya kepada sesi siswa yang terverifikasi aktif, memiliki masa berlaku singkat (*short-lived*), dan dibatasi hanya untuk berkas ujian terkait.

## 3. Isolasi Berkas Lokal dan Siklus Hidup Plaintext

### 3.1 Realitas Eksekusi Cisco Packet Tracer
Cisco Packet Tracer membutuhkan berkas fisik `.pka` pada sistem berkas lokal agar dapat dibuka. Oleh karena itu, *plaintext* berkas soal harus ada di komputer mahasiswa selama sesi ujian berlangsung. Sistem tidak mengklaim enkripsi memori penuh, melainkan menerapkan mitigasi isolasi ketat:

1. **Direktori Sementara Terisolasi**:
   - Dibuat pada direktori sementara sistem operasi dengan nama berbasis UUID acak (`.exam_session_<uuid>`).
   - Izin akses POSIX disetel secara ketat ke `0700` (`rwx------`) pada Linux dan macOS, sehingga hanya akun pengguna aktif yang dapat membaca atau menulis.
   - Pada Windows, direktori dikonfigurasi dengan *Access Control List* (ACL) terbatas hanya untuk `CURRENT_USER`.
2. **Penghapusan Bersih (Safe Cleanup)**:
   - Segera setelah Packet Tracer ditutup dan berkas jawaban berhasil dienkripsi serta dicadangkan, berkas `.pka` plaintext dihapus secara permanen dari sistem berkas.
   - Menghindari berkas residu yang tertinggal pada recycle bin atau temporary cache.

## 4. Keamanan Autentikasi dan Otorisasi

### 4.1 Validasi Sesi Mahasiswa
- Token sesi (`session_token`) berupa string kriptografis acak berkekuatan tinggi (256-bit hex) dengan masa berlaku kedaluwarsa (*TTL*).
- Token sesi terikat secara ketat dengan:
  - NIM Mahasiswa.
  - ID Kelas.
  - ID Ujian.
  - Alamat IP dan User-Agent awal klien.
- Kode ujian (*Exam Code*) memiliki parameter:
  - Waktu mulai dan waktu berakhir (*time window*).
  - Batas maksimal jumlah penggunaan (*usage limit*).
  - Status aktif/nonaktif yang dapat diubah seketika oleh dosen.

### 4.2 Otorisasi Administrator
- Dasbor admin dilindungi dengan otentikasi berbasis token JWT / Bearer Token dengan hashing kata sandi berbasis Argon2 / PBKDF2.
- Pengunduhan berkas soal atau jawaban terdekripsi memerlukan hak akses tingkat admin yang diverifikasi di sisi peladen.
- R2 Bucket tidak pernah dibuka ke publik (*no public bucket read access*). Seluruh berkas hanya dapat diakses melalui Worker API terautentikasi.

## 5. Integritas Data & Anti-Penyangkalan (Non-Repudiation)

1. **AEAD (Authenticated Encryption with Associated Data)**:
   - Menggunakan AES-256-GCM dengan authentication tag 128-bit.
   - Metadata sesi (NIM, Session ID, Timestamp, Exam ID) disertakan sebagai *Additional Authenticated Data* (AAD). Jika penyerang memanipulasi metadata pada header berkas, proses dekripsi akan gagal karena kegagalan verifikasi tag.
2. **Verifikasi Checksum SHA-256**:
   - Client menghitung hash SHA-256 sebelum enkripsi dan mengirimkannya ke peladen.
   - Peladen memvalidasi hash setelah dekripsi verifikasi untuk menjamin tidak ada bit yang korup selama proses transmisi.
3. **Audit Logging**:
   - Seluruh aktivitas krusial (pembuatan soal, aktivasi kode, pembukaan sesi, pengunduhan berkas, submisi jawaban, dan dekripsi admin) dicatat dalam tabel `audit_logs` Cloudflare D1 yang tidak dapat diubah (*append-only*).
