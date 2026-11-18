# Referensi REST API (Cloudflare Workers API Reference)

Base URL: `https://api-exam.internal/api/v1`

Seluruh request dan response menggunakan format `application/json`, kecuali saat pengunggahan atau pengunduhan binary container stream (`application/octet-stream`).

---

## 1. Modul Otentikasi & Sesi Mahasiswa

### 1.1 Validasi Kode Ujian & Inisialisasi Sesi
- **Endpoint**: `POST /api/v1/exam/validate`
- **Deskripsi**: Memvalidasi identitas mahasiswa, kelas, serta ketersediaan kode ujian. Menerbitkan sesi baru jika valid.
- **Request Body**:
  ```json
  {
    "nim": "210001001",
    "studentName": "Ahmad Dani",
    "classCode": "TI-3A",
    "examCode": "EXAM-NET-2026"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "sess_8f9e0a1b2c3d4e5f",
      "sessionToken": "tok_9918237461823461a87b",
      "examId": "exam_7718293041",
      "examTitle": "Ujian Praktikum Jaringan Komputer Lanjut",
      "durationMinutes": 120,
      "expiresAt": "2026-11-18T18:00:00Z"
    }
  }
  ```
- **Response Error (400 / 403 / 404)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_EXAM_CODE",
      "message": "Kode ujian tidak ditemukan atau telah kedaluwarsa"
    }
  }
  ```

### 1.2 Status Sesi Mahasiswa
- **Endpoint**: `GET /api/v1/sessions/:sessionId`
- **Header**: `Authorization: Bearer <sessionToken>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "sess_8f9e0a1b2c3d4e5f",
      "status": "ACTIVE",
      "remainingSeconds": 6840
    }
  }
  ```

### 1.3 Heartbeat Sesi
- **Endpoint**: `POST /api/v1/sessions/:sessionId/heartbeat`
- **Header**: `Authorization: Bearer <sessionToken>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "acknowledged": true,
      "serverTime": "2026-11-18T16:15:00Z"
    }
  }
  ```

### 1.4 Penutupan Sesi
- **Endpoint**: `POST /api/v1/sessions/:sessionId/close`
- **Header**: `Authorization: Bearer <sessionToken>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "sess_8f9e0a1b2c3d4e5f",
      "closedAt": "2026-11-18T17:30:00Z"
    }
  }
  ```

---

## 2. Modul Distribusi Soal Ujian

### 2.1 Manifest Soal Ujian
- **Endpoint**: `GET /api/v1/exams/:examId/manifest`
- **Header**: `Authorization: Bearer <sessionToken>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "examId": "exam_7718293041",
      "fileSize": 1048576,
      "formatVersion": 1,
      "algorithm": "AES-256-GCM"
    }
  }
  ```

### 2.2 Unduh Berkas Soal Terenkripsi & Kunci Sesi
- **Endpoint**: `POST /api/v1/exams/:examId/download`
- **Header**: `Authorization: Bearer <sessionToken>`
- **Request Body**:
  ```json
  {
    "sessionId": "sess_8f9e0a1b2c3d4e5f"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "sessionKey": "a98f12c8...32bytesHex",
      "containerBase64": "RVhBTUVOQwE..."
    }
  }
  ```

---

## 3. Modul Submisi Jawaban Mahasiswa

### 3.1 Inisialisasi Submisi
- **Endpoint**: `POST /api/v1/submissions/init`
- **Header**: `Authorization: Bearer <sessionToken>`
- **Request Body**:
  ```json
  {
    "sessionId": "sess_8f9e0a1b2c3d4e5f",
    "examId": "exam_7718293041",
    "sha256Original": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "fileSizeBytes": 1058200
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "submissionId": "sub_99a8b7c6d5e4",
      "uploadEndpoint": "/api/v1/submissions/sub_99a8b7c6d5e4/upload"
    }
  }
  ```

### 3.2 Unggah Kontainer Jawaban Terenkripsi
- **Endpoint**: `PUT /api/v1/submissions/:submissionId/upload`
- **Header**: `Authorization: Bearer <sessionToken>`, `Content-Type: application/octet-stream`
- **Request Body**: Binary Stream berkas `.examenc`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "receivedBytes": 1058200,
      "r2StorageKey": "submissions/exam_7718293041/sub_99a8b7c6d5e4.examenc"
    }
  }
  ```

### 3.3 Verifikasi & Penyelesaian Submisi
- **Endpoint**: `POST /api/v1/submissions/:submissionId/complete`
- **Header**: `Authorization: Bearer <sessionToken>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "submissionId": "sub_99a8b7c6d5e4",
      "status": "COMPLETED",
      "verifiedChecksum": true,
      "completedAt": "2026-11-18T17:35:10Z"
    }
  }
  ```

---

## 4. Modul Administrasi (Admin & Dosen)

Seluruh endpoint admin membutuhkan Header: `Authorization: Bearer <adminToken>`.

### 4.1 Manajemen Mata Ujian
- `POST /api/v1/admin/exams`: Membuat mata ujian baru dan mengunggah berkas `.pka` asli (enkripsi server otomatis).
- `GET /api/v1/admin/exams`: Daftar seluruh mata ujian beserta status aktif dan kelas terafiliasi.
- `GET /api/v1/admin/exams/:examId`: Detail mata ujian.
- `PUT /api/v1/admin/exams/:examId`: Memperbarui metadata mata ujian (judul, jadwal, batas waktu).
- `DELETE /api/v1/admin/exams/:examId`: Menghapus ujian (soft-delete).
- `POST /api/v1/admin/exams/:examId/rotate-code`: Membangkitkan kode ujian baru dan menonaktifkan kode lama secara instan.

### 4.2 Manajemen Kelas
- `GET /api/v1/admin/classes`: Mengambil daftar kelas terdaftar.
- `POST /api/v1/admin/classes`: Menambahkan kelas baru.

### 4.3 Manajemen Submisi Jawaban
- `GET /api/v1/admin/submissions`: Menampilkan riwayat submisi siswa dengan filter kelas dan ujian.
- `GET /api/v1/admin/submissions/:submissionId`: Detail submisi tertentu.
- `GET /api/v1/admin/submissions/:submissionId/download`: Mendekripsi jawaban siswa di server dan mengunduh berkas `.pka` asli terverifikasi.
- `POST /api/v1/admin/exams/:examId/export-zip`: Mengumpulkan seluruh jawaban mahasiswa dalam satu kelas, mendekripsi secara aman di peladen, dan mengemasnya dalam berkas `.zip`.

### 4.4 Audit Trail
- `GET /api/v1/admin/audit-logs`: Log riwayat aktivitas sistem untuk forensik dan kepatuhan.
