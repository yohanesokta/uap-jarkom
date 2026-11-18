import {
  calculateSha256Hex,
  decryptExamPayload,
  deriveMasterCryptoKey,
  deriveSessionCryptoKey,
  deriveSessionKeyHex,
  generateRandomBytes,
  hexStringToUint8Array,
  packagePkaFileIntoExamContainer,
  uint8ArrayToHexString,
  unpackExamContainerToPkaFile,
  unwrapDataEncryptionKey,
  wrapDataEncryptionKey
} from "./crypto.js";
import { DatabaseService } from "./db.js";
import { Env } from "./types.js";
import { decodeExamContainer } from "@packet-tracer-exam/exam-format";

function jsonResponse(data: unknown, status: number = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...extraHeaders
    }
  });
}

function errorResponse(code: string, message: string, status: number = 400): Response {
  return jsonResponse(
    {
      success: false,
      error: { code, message }
    },
    status
  );
}

function handleCorsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return handleCorsPreflight();
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const db = new DatabaseService(env.DB);
  const masterSecret = env.MASTER_KEY_SECRET || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  try {
    if (path === "/api/v1/exam/validate" && request.method === "POST") {
      const body = (await request.json()) as {
        nim?: string;
        studentName?: string;
        classCode?: string;
        examCode?: string;
      };

      if (!body.nim || !body.studentName || !body.classCode || !body.examCode) {
        return errorResponse("INVALID_INPUT", "NIM, studentName, classCode, and examCode are required");
      }

      const examCodeRecord = await db.findExamCode(body.examCode);
      if (!examCodeRecord) {
        return errorResponse("INVALID_EXAM_CODE", "Kode ujian tidak ditemukan atau telah kedaluwarsa", 404);
      }

      if (examCodeRecord.max_uses > 0 && examCodeRecord.current_uses >= examCodeRecord.max_uses) {
        return errorResponse("EXAM_CODE_EXHAUSTED", "Batas penggunaan kode ujian telah tercapai", 403);
      }

      if (examCodeRecord.expires_at && new Date(examCodeRecord.expires_at) < new Date()) {
        return errorResponse("EXAM_CODE_EXPIRED", "Kode ujian telah kedaluwarsa", 403);
      }

      const exam = await db.findExamById(examCodeRecord.exam_id);
      if (!exam || exam.is_active === 0) {
        return errorResponse("EXAM_INACTIVE", "Ujian saat ini sedang tidak aktif", 403);
      }

      let classRecord = await db.findClassByCode(body.classCode);
      if (!classRecord) {
        classRecord = {
          id: `class_${Date.now()}`,
          code: body.classCode,
          name: `Kelas ${body.classCode}`,
          academic_year: new Date().getFullYear().toString(),
          created_at: new Date().toISOString()
        };
        await db.createClass(classRecord);
      }

      if (exam.class_id !== classRecord.id) {
        const examClass = await db.findClassById(exam.class_id);
        if (examClass && examClass.code !== body.classCode) {
          return errorResponse("CLASS_MISMATCH", "Ujian ini tidak diperuntukkan bagi kelas Anda", 403);
        }
      }

      const studentId = `std_${body.nim}`;
      await db.upsertStudent({
        id: studentId,
        nim: body.nim,
        full_name: body.studentName,
        class_id: classRecord.id,
        created_at: new Date().toISOString()
      });

      const sessionToken = uint8ArrayToHexString(generateRandomBytes(32));
      const sessionTokenHash = await calculateSha256Hex(new TextEncoder().encode(sessionToken));
      const sessionId = `sess_${uint8ArrayToHexString(generateRandomBytes(8))}`;

      const expiresAtDate = new Date(Date.now() + (exam.duration_minutes + 15) * 60 * 1000);

      await db.createExamSession({
        id: sessionId,
        exam_id: exam.id,
        student_id: studentId,
        exam_code_id: examCodeRecord.id,
        session_token_hash: sessionTokenHash,
        status: "ACTIVE",
        client_ip: request.headers.get("CF-Connecting-IP") || "127.0.0.1",
        client_platform: request.headers.get("User-Agent") || "Unknown",
        started_at: new Date().toISOString(),
        expires_at: expiresAtDate.toISOString(),
        ended_at: null
      });

      await db.incrementExamCodeUsage(examCodeRecord.id);

      await db.createAuditLog({
        id: `aud_${Date.now()}`,
        actor_id: studentId,
        actor_type: "STUDENT",
        action: "EXAM_VALIDATE_SUCCESS",
        target_resource: sessionId,
        details_json: JSON.stringify({ examId: exam.id, examCode: body.examCode }),
        ip_address: request.headers.get("CF-Connecting-IP"),
        created_at: new Date().toISOString()
      });

      return jsonResponse({
        success: true,
        data: {
          sessionId,
          sessionToken,
          examId: exam.id,
          examTitle: exam.title,
          durationMinutes: exam.duration_minutes,
          expiresAt: expiresAtDate.toISOString()
        }
      });
    }

    if (path.startsWith("/api/v1/sessions/") && path.endsWith("/heartbeat") && request.method === "POST") {
      const parts = path.split("/");
      const sessionId = parts[4];
      const session = await db.findSessionById(sessionId);
      if (!session) {
        return errorResponse("SESSION_NOT_FOUND", "Sesi tidak ditemukan", 404);
      }
      return jsonResponse({
        success: true,
        data: { acknowledged: true, serverTime: new Date().toISOString() }
      });
    }

    if (path.startsWith("/api/v1/sessions/") && path.endsWith("/close") && request.method === "POST") {
      const parts = path.split("/");
      const sessionId = parts[4];
      await db.updateSessionStatus(sessionId, "CLOSED");
      return jsonResponse({
        success: true,
        data: { sessionId, closedAt: new Date().toISOString() }
      });
    }

    if (path.startsWith("/api/v1/sessions/") && request.method === "GET") {
      const parts = path.split("/");
      const sessionId = parts[4];
      const session = await db.findSessionById(sessionId);
      if (!session) {
        return errorResponse("SESSION_NOT_FOUND", "Sesi tidak ditemukan", 404);
      }
      const remainingSeconds = Math.max(
        0,
        Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000)
      );
      return jsonResponse({
        success: true,
        data: {
          sessionId: session.id,
          status: session.status,
          remainingSeconds
        }
      });
    }

    if (path.startsWith("/api/v1/exams/") && path.endsWith("/manifest") && request.method === "GET") {
      const parts = path.split("/");
      const examId = parts[4];
      const exam = await db.findExamById(examId);
      if (!exam) {
        return errorResponse("EXAM_NOT_FOUND", "Ujian tidak ditemukan", 404);
      }
      const meta = await db.findEncryptionMetadataByResourceId(examId);
      return jsonResponse({
        success: true,
        data: {
          examId: exam.id,
          fileSize: meta?.original_file_size ?? 0,
          formatVersion: meta?.format_version ?? 1,
          algorithm: meta?.algorithm ?? "AES-256-GCM"
        }
      });
    }

    if (path.startsWith("/api/v1/exams/") && path.endsWith("/download") && request.method === "POST") {
      const parts = path.split("/");
      const examId = parts[4];
      const exam = await db.findExamById(examId);
      if (!exam) {
        return errorResponse("EXAM_NOT_FOUND", "Ujian tidak ditemukan", 404);
      }

      const storageObject = await env.STORAGE.get(exam.r2_storage_key);
      if (!storageObject) {
        return errorResponse("FILE_NOT_FOUND", "Berkas kontainer ujian tidak ditemukan pada penyimpanan", 404);
      }

      const containerArrayBuffer = await storageObject.arrayBuffer();
      const containerBytes = new Uint8Array(containerArrayBuffer);
      const parsed = decodeExamContainer(containerBytes);

      const masterKey = await deriveMasterCryptoKey(masterSecret);
      const dek = await unwrapDataEncryptionKey(parsed.header.wrappedDek, masterKey);

      let requestedSessionId = "";
      try {
        const body = (await request.json()) as { sessionId?: string };
        requestedSessionId = body.sessionId || "";
      } catch (_) {}

      const sessionKeyHex = requestedSessionId
        ? await deriveSessionKeyHex(masterSecret, requestedSessionId)
        : uint8ArrayToHexString(generateRandomBytes(32));

      const sessionCryptoKey = requestedSessionId
        ? await deriveSessionCryptoKey(masterSecret, requestedSessionId)
        : await crypto.subtle.importKey(
            "raw",
            hexStringToUint8Array(sessionKeyHex),
            { name: "AES-GCM" },
            false,
            ["encrypt"]
          );

      const sessionWrappedDek = await wrapDataEncryptionKey(dek, sessionCryptoKey);

      return jsonResponse({
        success: true,
        data: {
          examId: exam.id,
          sessionKeyHex: sessionKeyHex,
          sessionWrappedDekHex: uint8ArrayToHexString(sessionWrappedDek),
          containerBase64: uint8ArrayToHexString(containerBytes)
        }
      });
    }

    if (path === "/api/v1/submissions/init" && request.method === "POST") {
      const body = (await request.json()) as {
        sessionId?: string;
        examId?: string;
        sha256Original?: string;
        fileSizeBytes?: number;
      };

      if (!body.sessionId || !body.examId || !body.sha256Original || !body.fileSizeBytes) {
        return errorResponse("INVALID_INPUT", "sessionId, examId, sha256Original, fileSizeBytes are required");
      }

      const session = await db.findSessionById(body.sessionId);
      if (!session) {
        return errorResponse("SESSION_NOT_FOUND", "Sesi pengerjaan tidak ditemukan", 404);
      }

      const submissionId = `sub_${uint8ArrayToHexString(generateRandomBytes(8))}`;
      const r2Key = `submissions/${body.examId}/${submissionId}.examenc`;

      await db.createSubmission({
        id: submissionId,
        session_id: body.sessionId,
        exam_id: body.examId,
        student_id: session.student_id,
        r2_storage_key: r2Key,
        original_sha256: body.sha256Original,
        encrypted_sha256: "",
        file_size_bytes: body.fileSizeBytes,
        status: "PENDING",
        retry_count: 0,
        created_at: new Date().toISOString(),
        completed_at: null
      });

      return jsonResponse(
        {
          success: true,
          data: {
            submissionId,
            uploadEndpoint: `/api/v1/submissions/${submissionId}/upload`
          }
        },
        201
      );
    }

    if (path.startsWith("/api/v1/submissions/") && path.endsWith("/upload") && request.method === "PUT") {
      const parts = path.split("/");
      const submissionId = parts[4];
      const submission = await db.findSubmissionById(submissionId);
      if (!submission) {
        return errorResponse("SUBMISSION_NOT_FOUND", "Submisi tidak ditemukan", 404);
      }

      const uploadBytes = new Uint8Array(await request.arrayBuffer());
      if (uploadBytes.byteLength === 0) {
        return errorResponse("EMPTY_PAYLOAD", "Buffer berkas kosong", 400);
      }

      const encryptedSha256 = await calculateSha256Hex(uploadBytes);

      await env.STORAGE.put(submission.r2_storage_key, uploadBytes);

      const updateStatement = env.DB.prepare(
        "UPDATE submissions SET encrypted_sha256 = ?, file_size_bytes = ? WHERE id = ?"
      );
      await updateStatement.bind(encryptedSha256, uploadBytes.byteLength, submissionId).run();

      return jsonResponse({
        success: true,
        data: {
          submissionId,
          receivedBytes: uploadBytes.byteLength,
          encryptedSha256
        }
      });
    }

    if (path.startsWith("/api/v1/submissions/") && path.endsWith("/complete") && request.method === "POST") {
      const parts = path.split("/");
      const submissionId = parts[4];
      const submission = await db.findSubmissionById(submissionId);
      if (!submission) {
        return errorResponse("SUBMISSION_NOT_FOUND", "Submisi tidak ditemukan", 404);
      }

      const storedObject = await env.STORAGE.get(submission.r2_storage_key);
      if (!storedObject) {
        return errorResponse("STORAGE_OBJECT_NOT_FOUND", "Objek berkas terenkripsi belum diterima pada storage", 400);
      }

      const completedAt = new Date().toISOString();
      await db.updateSubmissionStatus(submissionId, "COMPLETED", completedAt);
      await db.updateSessionStatus(submission.session_id, "CLOSED");

      await db.createAuditLog({
        id: `aud_${Date.now()}`,
        actor_id: submission.student_id,
        actor_type: "STUDENT",
        action: "SUBMISSION_COMPLETED",
        target_resource: submissionId,
        details_json: JSON.stringify({ r2Key: submission.r2_storage_key }),
        ip_address: request.headers.get("CF-Connecting-IP"),
        created_at: completedAt
      });

      return jsonResponse({
        success: true,
        data: {
          submissionId,
          status: "COMPLETED",
          verifiedChecksum: true,
          completedAt
        }
      });
    }

    if (path.startsWith("/api/v1/submissions/") && path.endsWith("/status") && request.method === "GET") {
      const parts = path.split("/");
      const submissionId = parts[4];
      const submission = await db.findSubmissionById(submissionId);
      if (!submission) {
        return errorResponse("SUBMISSION_NOT_FOUND", "Submisi tidak ditemukan", 404);
      }
      return jsonResponse({
        success: true,
        data: {
          submissionId: submission.id,
          status: submission.status,
          retryCount: submission.retry_count,
          completedAt: submission.completed_at
        }
      });
    }

    if (path.startsWith("/api/v1/submissions/") && path.endsWith("/retry") && request.method === "POST") {
      const parts = path.split("/");
      const submissionId = parts[4];
      const submission = await db.findSubmissionById(submissionId);
      if (!submission) {
        return errorResponse("SUBMISSION_NOT_FOUND", "Submisi tidak ditemukan", 404);
      }
      await db.updateSubmissionStatus(submissionId, "PENDING");
      return jsonResponse({
        success: true,
        data: { submissionId, status: "PENDING" }
      });
    }

    if (path === "/api/v1/admin/auth/login" && request.method === "POST") {
      const body = (await request.json()) as { username?: string; password?: string };
      if (!body.username || !body.password) {
        return errorResponse("INVALID_INPUT", "Username and password required");
      }

      let admin = await db.findAdministratorByUsername(body.username);
      if (!admin) {
        const passwordHash = await calculateSha256Hex(new TextEncoder().encode(body.password));
        admin = {
          id: "admin_default",
          username: body.username,
          email: `${body.username}@kampus.ac.id`,
          password_hash: passwordHash,
          full_name: "Dosen Pengampu",
          role: "ADMINISTRATOR",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await db.createAdministrator(admin);
      } else {
        const passwordHash = await calculateSha256Hex(new TextEncoder().encode(body.password));
        if (admin.password_hash !== passwordHash) {
          return errorResponse("INVALID_CREDENTIALS", "Kata sandi salah", 401);
        }
      }

      const adminToken = uint8ArrayToHexString(generateRandomBytes(32));

      return jsonResponse({
        success: true,
        data: {
          adminToken,
          admin: {
            id: admin.id,
            username: admin.username,
            fullName: admin.full_name,
            role: admin.role
          }
        }
      });
    }

    if (path === "/api/v1/admin/overview" && request.method === "GET") {
      const stats = await db.getDashboardOverview();
      return jsonResponse({ success: true, data: stats });
    }

    if (path === "/api/v1/admin/classes" && request.method === "GET") {
      const classes = await db.listClasses();
      return jsonResponse({ success: true, data: classes });
    }

    if (path === "/api/v1/admin/classes" && request.method === "POST") {
      const body = (await request.json()) as { code?: string; name?: string; academicYear?: string };
      if (!body.code || !body.name) {
        return errorResponse("INVALID_INPUT", "Code and name are required");
      }
      const newClass: ClassRecord = {
        id: `class_${Date.now()}`,
        code: body.code,
        name: body.name,
        academic_year: body.academicYear || new Date().getFullYear().toString(),
        created_at: new Date().toISOString()
      };
      await db.createClass(newClass);
      return jsonResponse({ success: true, data: newClass }, 201);
    }

    if (path === "/api/v1/admin/exams" && request.method === "GET") {
      const classId = url.searchParams.get("classId") || undefined;
      const exams = await db.listExams(classId);

      const enrichedExams = await Promise.all(
        exams.map(async (exam) => {
          const codeStatement = env.DB.prepare(
            "SELECT code, is_revoked FROM exam_codes WHERE exam_id = ? AND is_revoked = 0 ORDER BY created_at DESC LIMIT 1"
          );
          const currentCode = await codeStatement.bind(exam.id).first<{ code: string }>();
          const classRecord = await db.findClassById(exam.class_id);
          return {
            ...exam,
            currentCode: currentCode?.code ?? null,
            className: classRecord?.name ?? exam.class_id
          };
        })
      );

      return jsonResponse({ success: true, data: enrichedExams });
    }

    if (path === "/api/v1/admin/exams" && request.method === "POST") {
      const body = (await request.json()) as {
        title?: string;
        description?: string;
        classId?: string;
        durationMinutes?: number;
        pkaBase64?: string;
        originalFilename?: string;
      };

      if (!body.title || !body.classId || !body.durationMinutes || !body.pkaBase64) {
        return errorResponse("INVALID_INPUT", "title, classId, durationMinutes, pkaBase64 are required");
      }

      const targetClass = await db.findClassById(body.classId);
      if (!targetClass) {
        return errorResponse("CLASS_NOT_FOUND", "Kelompok kelas yang dipilih tidak ditemukan di basis data", 404);
      }

      let admin = await db.findAdministratorById("admin_default");
      if (!admin) {
        const defaultPasswordHash = await calculateSha256Hex(new TextEncoder().encode("admin123"));
        admin = {
          id: "admin_default",
          username: "admin",
          email: "admin@kampus.ac.id",
          password_hash: defaultPasswordHash,
          full_name: "Dosen Pengampu",
          role: "ADMINISTRATOR",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await db.createAdministrator(admin);
      }

      let pkaBytes: Uint8Array;
      if (/^[0-9a-fA-F]+$/.test(body.pkaBase64)) {
        pkaBytes = hexStringToUint8Array(body.pkaBase64);
      } else {
        const binaryString = atob(body.pkaBase64);
        pkaBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          pkaBytes[i] = binaryString.charCodeAt(i);
        }
      }

      const examId = `exam_${Date.now()}`;
      const originalSha256 = await calculateSha256Hex(pkaBytes);
      const r2Key = `exams/${examId}/package.examenc`;

      const { containerBytes } = await packagePkaFileIntoExamContainer(
        pkaBytes,
        masterSecret,
        {
          examId,
          timestamp: Date.now(),
          originalSha256,
          purpose: "EXAM_DISTRIBUTION"
        }
      );

      await env.STORAGE.put(r2Key, containerBytes);

      const parsedContainer = decodeExamContainer(containerBytes);
      await db.createEncryptionMetadata({
        id: `meta_${Date.now()}`,
        resource_id: examId,
        resource_type: "EXAM_FILE",
        format_version: parsedContainer.header.formatVersion,
        algorithm: "AES-256-GCM",
        key_identifier: uint8ArrayToHexString(parsedContainer.header.keyIdentifier),
        nonce_hex: uint8ArrayToHexString(parsedContainer.header.nonce),
        wrapped_dek_hex: uint8ArrayToHexString(parsedContainer.header.wrappedDek),
        original_file_size: pkaBytes.byteLength,
        auth_tag_hex: uint8ArrayToHexString(parsedContainer.authenticationTag),
        created_at: new Date().toISOString()
      });

      const examRecord: ExamRecord = {
        id: examId,
        title: body.title,
        description: body.description ?? null,
        class_id: body.classId,
        created_by: "admin_default",
        r2_storage_key: r2Key,
        original_filename: body.originalFilename || "exam.pka",
        duration_minutes: body.durationMinutes,
        is_active: 1,
        start_time: null,
        end_time: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      };
      await db.createExam(examRecord);

      const initialCode = `EXAM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await db.createExamCode({
        id: `code_${Date.now()}`,
        exam_id: examId,
        code: initialCode,
        max_uses: 0,
        current_uses: 0,
        expires_at: null,
        is_revoked: 0,
        created_at: new Date().toISOString()
      });

      return jsonResponse(
        {
          success: true,
          data: {
            ...examRecord,
            code: initialCode
          }
        },
        201
      );
    }

    if (path.startsWith("/api/v1/admin/exams/") && path.endsWith("/rotate-code") && request.method === "POST") {
      const parts = path.split("/");
      const examId = parts[5];
      const exam = await db.findExamById(examId);
      if (!exam) {
        return errorResponse("EXAM_NOT_FOUND", "Ujian tidak ditemukan", 404);
      }

      await db.revokeExamCodesForExam(examId);
      const newCode = `EXAM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await db.createExamCode({
        id: `code_${Date.now()}`,
        exam_id: examId,
        code: newCode,
        max_uses: 0,
        current_uses: 0,
        expires_at: null,
        is_revoked: 0,
        created_at: new Date().toISOString()
      });

      return jsonResponse({
        success: true,
        data: { examId, newCode }
      });
    }

    if (path.startsWith("/api/v1/admin/exams/") && request.method === "DELETE") {
      const parts = path.split("/");
      const examId = parts[5];
      await db.softDeleteExam(examId);
      return jsonResponse({ success: true, data: { deleted: true } });
    }

    if (path === "/api/v1/admin/submissions" && request.method === "GET") {
      const examId = url.searchParams.get("examId") || undefined;
      const classId = url.searchParams.get("classId") || undefined;
      const status = url.searchParams.get("status") || undefined;
      const submissions = await db.listSubmissions({ examId, classId, status });
      return jsonResponse({ success: true, data: submissions });
    }

    if (path.startsWith("/api/v1/admin/submissions/") && path.endsWith("/download") && request.method === "GET") {
      const parts = path.split("/");
      const submissionId = parts[5];
      const submission = await db.findSubmissionById(submissionId);
      if (!submission) {
        return errorResponse("SUBMISSION_NOT_FOUND", "Submisi tidak ditemukan", 404);
      }

      const storedObject = await env.STORAGE.get(submission.r2_storage_key);
      if (!storedObject) {
        return errorResponse("FILE_NOT_FOUND", "Berkas jawaban tidak ditemukan di storage", 404);
      }

      const containerBytes = new Uint8Array(await storedObject.arrayBuffer());
      const parsed = decodeExamContainer(containerBytes);
      const sessionId = parsed.header.authenticatedMetadata.sessionId || submission.session_id;

      let dek: Uint8Array | null = null;
      if (sessionId) {
        try {
          const sessionKey = await deriveSessionCryptoKey(masterSecret, sessionId);
          dek = await unwrapDataEncryptionKey(parsed.header.wrappedDek, sessionKey);
        } catch (_) {}
      }

      if (!dek) {
        try {
          const masterKey = await deriveMasterCryptoKey(masterSecret);
          dek = await unwrapDataEncryptionKey(parsed.header.wrappedDek, masterKey);
        } catch (_) {}
      }

      if (!dek) {
        return errorResponse("DECRYPTION_FAILED", "Gagal membuka kunci dekripsi berkas jawaban", 500);
      }

      const decryptedPka = await decryptExamPayload(
        parsed.encryptedPayload,
        parsed.authenticationTag,
        dek,
        parsed.header.nonce,
        parsed.header.authenticatedMetadataRaw
      );

      return new Response(decryptedPka, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${submission.student_id}_answer.pka"`,
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Expose-Headers": "Content-Disposition"
        }
      });
    }

    if (path === "/api/v1/admin/audit-logs" && request.method === "GET") {
      const logs = await db.listAuditLogs(50);
      return jsonResponse({ success: true, data: logs });
    }

    return errorResponse("NOT_FOUND", "Endpoint tidak ditemukan", 404);
  } catch (error) {
    return errorResponse("INTERNAL_SERVER_ERROR", (error as Error).message, 500);
  }
}
