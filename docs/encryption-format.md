# Spesifikasi Format Berkas Kontainer Biner (EXAMENC Binary Format)

## 1. Ikhtisar Format

Berkas biner kontainer `EXAMENC` (dengan ekstensi `.examenc`) adalah kontainer biner berversi yang dirancang khusus untuk membungkus berkas Packet Tracer (.pka) terenkripsi secara aman, mandiri, dan tahan terhadap manipulasi data (*tamper-proof*).

Kontainer menggunakan format biner terstruktur *Big-Endian (Network Byte Order)* dengan dukungan penuh *Authenticated Encryption with Associated Data (AEAD)*.

## 2. Struktur Tata Letak Biner (Binary Layout)

Kontainer terdiri dari tiga segmen utama:
1. **Fixed Header (Panjang Tetap - 88 bytes)**
2. **Variable Segment (Metadata Terotentikasi & Wrapped Key)**
3. **Encrypted Payload Segment (Ciphertext & Auth Tag)**

### 2.1 Diagram Tata Letak Biner

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                      Magic Bytes (0x4558414D)                 | 'E' 'X' 'A' 'M'
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                      Magic Bytes (0x454E4301)                 | 'E' 'N' 'C' 0x01
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Format Version       |     Algorithm Identifier      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                       Key Identifier (UUID)                   + 16 Bytes
|                           (128-bit)                           |
+                                                               +
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                   Initialization Vector (Nonce)               + 12 Bytes
|                             (96-bit)                          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                      Wrapped DEK Length                       | 4 Bytes (uint32)
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                      Original File Size                       + 8 Bytes (uint64)
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       Metadata Length                         | 4 Bytes (uint32)
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                      Payload Length (Bytes)                   + 8 Bytes (uint64)
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                     Wrapped DEK Data (Variable)               | N Bytes
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|             Authenticated Metadata JSON (Variable)            | M Bytes
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                   Encrypted Payload (Ciphertext)              + P Bytes
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                     Authentication Tag                        + 16 Bytes (128-bit)
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

## 3. Rincian Bidang Header (Field Specifications)

| Nama Bidang | Offset | Tipe Data | Ukuran (Bytes) | Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| **Magic Bytes** | 0 | Byte Array | 8 | Karakter ASCII `EXAMENC` diikuti byte rilis format `0x01` (`0x4558414D454E4301`). |
| **Format Version** | 8 | uint16 Big-Endian | 2 | Versi format kontainer (Versi saat ini = `1`). |
| **Algorithm ID** | 10 | uint16 Big-Endian | 2 | Pengenal algoritma enkripsi. `0x0001` = AES-256-GCM. |
| **Key Identifier** | 12 | Byte Array | 16 | UUIDv4 biner dari Master Key atau Session Key yang dipakai membungkus DEK. |
| **Nonce (IV)** | 28 | Byte Array | 12 | 96-bit CSPRNG Initialization Vector untuk AES-GCM. |
| **Wrapped DEK Length**| 40 | uint32 Big-Endian | 4 | Panjang biner dari Data Encryption Key yang terbungkus. Biasanya 48 byte. |
| **Original File Size**| 44 | uint64 Big-Endian | 8 | Ukuran asli berkas `.pka` sebelum dienkripsi (dalam byte). |
| **Metadata Length** | 52 | uint32 Big-Endian | 4 | Panjang karakter string JSON UTF-8 dari Authenticated Metadata. |
| **Payload Length** | 56 | uint64 Big-Endian | 8 | Panjang ciphertext berkas terenkripsi (dalam byte). |
| **Wrapped DEK** | 64 | Byte Array | Variable | Byte terenkripsi dari Data Encryption Key. |
| **Authenticated Metadata** | 64 + W | String UTF-8 | Variable | JSON metadata terautentikasi (NIM, Session ID, Timestamp, Checksum). |
| **Ciphertext Payload** | 64 + W + M | Byte Array | Variable | Muatan berkas .pka yang telah terenkripsi. |
| **Auth Tag** | Akhir Berkas | Byte Array | 16 | Tag otentikasi GCM 128-bit untuk memvalidasi integritas data dan metadata. |

## 4. Validasi Keamanan dan Deteksi Kerusakan (Corruption Detection)

Saat membaca berkas `.examenc`, parser menerapkan aturan validasi ketat:
1. **Magic Bytes Check**: Berkas langsung ditolak jika 8 byte pertama tidak cocok dengan `EXAMENC\x01`.
2. **Version Check**: Hanya versi `1` yang didukung saat ini; versi yang tidak dikenal ditolak dengan aman.
3. **Algorithm Check**: Hanya algoritma `0x0001` (AES-256-GCM) yang diterima.
4. **Size Sanity Check**: Total ukuran berkas fisik harus sama persis dengan `Header Size (64) + Wrapped DEK Length + Metadata Length + Payload Length + Tag Length (16)`. Jika terdapat selisih satu byte saja, berkas dianggap rusak atau terpotong (*truncated*).
5. **Authenticated Data Binding**: String Authenticated Metadata diteruskan sebagai `additionalData` pada saat verifikasi tag AES-GCM. Jika penyerang mengubah satu huruf pun di metadata (misal: mengganti NIM), operasi dekripsi akan gagal seketika sebelum memori dialokasikan.
