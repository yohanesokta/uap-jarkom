# Model Ancaman dan Analisis Risiko Keamanan (Threat Model)

## 1. Metodologi Analisis

Model ancaman ini menggunakan kerangka kerja **STRIDE** (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) untuk mengidentifikasi vektor serangan pada arsitektur sistem ujian Packet Tracer.

---

## 2. Analisis Vektor Ancaman (STRIDE Analysis)

| Kategori Ancaman | Deskripsi Skenario Serangan | Dampak | Mekanisme Mitigasi Sistem |
| :--- | :--- | :--- | :--- |
| **Spoofing (Pemalsuan)** | Mahasiswa A menggunakan NIM Mahasiswa B bersama kode ujian untuk mengerjakan ujian orang lain. | Tinggi | Kode ujian diikat ke kelas mahasiswa. Sesi ujian mencatat alamat IP, platform perangkat, dan timestamp. Token otentikasi ditandatangani dan diverifikasi oleh peladen D1. |
| **Tampering (Manipulasi)** | Mahasiswa mencegat berkas `.examenc` saat transit atau mengubah isi berkas cadangan lokal sebelum diunggah. | Sangat Tinggi | Format `EXAMENC` dilindungi *Authenticated Encryption (AES-256-GCM)* dengan authentication tag 128-bit. Segala modifikasi pada ciphertext atau metadata terotentikasi akan menyebabkan dekripsi gagal. |
| **Repudiation (Penyangkalan)** | Mahasiswa mengklaim telah mengumpulkan jawaban, namun mengaku sistem menghilangkan berkasnya. | Sedang | Sistem mencatat hash SHA-256 berkas sebelum enkripsi, menghasilkan resi digital unik, dan mencatat event penyelesaian di tabel `audit_logs` dan `submissions`. Cadangan lokal `.examenc` tersimpan di komputer siswa sebagai bukti forensik. |
| **Information Disclosure (Kebocoran Soal)** | Penyerang mencoba mengekstrak master secret atau mengunduh soal ujian sebelum waktu pengerjaan dimulai. | Kritis | Master Key disimpan pada Cloudflare Workers Secrets. R2 Object Storage tidak memiliki akses publik. Kunci dekripsi hanya diberikan pada sesi valid saat waktu ujian aktif. |
| **Information Disclosure (Inspeksi Plaintext Lokal)** | Mahasiswa memeriksa direktori sementara saat Packet Tracer terbuka untuk menyalin berkas `.pka` soal. | Sedang-Tinggi | *Catatan Desain*: Karena Packet Tracer adalah aplikasi desktop lokal, berkas `.pka` harus berada di disk sementara. Mitigasi: folder berizin `0700`, nama acak, pembersihan instan saat proses ditutup, dan rekomendasi arsitektur masa depan via remote virtual workspace. |
| **Denial of Service (DoS)** | Pengiriman request berulang ke endpoint validasi atau pengunggahan berkas besar untuk membebani backend. | Sedang | Cloudflare Workers dilengkapi batas laju request (*Rate Limiting*), validasi ukuran payload maksimum (maksimal 50MB untuk file .pka), dan validasi skema masukan. |
| **Elevation of Privilege** | Mahasiswa mencoba mengakses endpoint admin atau mengunduh jawaban mahasiswa lain. | Kritis | Endpoint admin memerlukan Bearer token admin yang divalidasi secara independen. Setiap permintaan unduhan jawaban memverifikasi relasi hak akses dosen terhadap kelas terkait. |

---

## 3. Batasan Teknis dan Rekomendasi Jangka Panjang

### 3.1 Realitas Berkas Plaintext pada Perangkat Klien
Karena Cisco Packet Tracer proprietary dan tidak memiliki library parser mandiri di memori, berkas fisik `.pka` wajib didekripsi sementara pada sistem berkas klien.
- **Tingkat Risiko**: Pengguna dengan hak akses root/administrator lokal secara teoritis dapat menyalin berkas sementara selama proses Packet Tracer sedang berjalan.
- **Rekomendasi Arsitektur Masa Depan**:
  Untuk ujian berkategori kerahasiaan militer atau sertifikasi ketat, arsitektur dapat ditingkatkan ke **Remote Execution / Virtual Desktop Infrastructure (VDI)**, di mana Packet Tracer dijalankan dalam container virtual di cloud (misalnya berbasis WebRTC / Guacamole / Kasm Workspaces), sehingga tidak ada bit berkas `.pka` yang pernah mengalir ke komputer fisik mahasiswa.
