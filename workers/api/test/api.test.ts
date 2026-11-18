import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/router.js";
import { Env } from "../src/types.js";
import { calculateSha256Hex, uint8ArrayToHexString } from "../src/crypto.js";

class InMemoryD1PreparedStatement {
  constructor(
    private readonly query: string,
    private readonly storage: Map<string, any[]>,
    private boundValues: any[] = []
  ) {}

  bind(...values: any[]) {
    this.boundValues = values;
    return this;
  }

  private matchCondition(row: any): boolean {
    if (this.query.includes("FROM exam_codes WHERE code = ? AND is_revoked = 0")) {
      return row.code === this.boundValues[0] && row.is_revoked === 0;
    }
    if (this.query.includes("FROM exam_codes WHERE exam_id = ? AND is_revoked = 0")) {
      return row.exam_id === this.boundValues[0] && row.is_revoked === 0;
    }
    if (this.query.includes("FROM exams WHERE id = ?")) {
      return row.id === this.boundValues[0] && row.deleted_at === null;
    }
    if (this.query.includes("FROM classes WHERE code = ?")) {
      return row.code === this.boundValues[0];
    }
    if (this.query.includes("FROM classes WHERE id = ?")) {
      return row.id === this.boundValues[0];
    }
    if (this.query.includes("FROM students WHERE nim = ?")) {
      return row.nim === this.boundValues[0];
    }
    if (this.query.includes("FROM exam_sessions WHERE id = ?")) {
      return row.id === this.boundValues[0];
    }
    if (this.query.includes("FROM submissions WHERE id = ?")) {
      return row.id === this.boundValues[0];
    }
    if (this.query.includes("FROM encryption_metadata WHERE resource_id = ?")) {
      return row.resource_id === this.boundValues[0];
    }
    if (this.query.includes("FROM administrators WHERE username = ?")) {
      return row.username === this.boundValues[0];
    }
    return true;
  }

  async first<T = unknown>(): Promise<T | null> {
    const tableName = this.getTableName();
    const rows = this.storage.get(tableName) || [];
    const matched = rows.find((r) => this.matchCondition(r));
    return (matched as T) || null;
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    const tableName = this.getTableName();
    const rows = this.storage.get(tableName) || [];
    let matched = rows.filter((r) => this.matchCondition(r));
    return { results: matched as T[] };
  }

  async run(): Promise<{ success: boolean }> {
    const tableName = this.getTableName();
    const rows = this.storage.get(tableName) || [];

    if (this.query.startsWith("INSERT INTO administrators")) {
      rows.push({
        id: this.boundValues[0],
        username: this.boundValues[1],
        email: this.boundValues[2],
        password_hash: this.boundValues[3],
        full_name: this.boundValues[4],
        role: this.boundValues[5],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } else if (this.query.startsWith("INSERT INTO classes")) {
      rows.push({
        id: this.boundValues[0],
        code: this.boundValues[1],
        name: this.boundValues[2],
        academic_year: this.boundValues[3],
        created_at: new Date().toISOString()
      });
    } else if (this.query.startsWith("INSERT INTO students")) {
      rows.push({
        id: this.boundValues[0],
        nim: this.boundValues[1],
        full_name: this.boundValues[2],
        class_id: this.boundValues[3],
        created_at: new Date().toISOString()
      });
    } else if (this.query.startsWith("INSERT INTO exams")) {
      rows.push({
        id: this.boundValues[0],
        title: this.boundValues[1],
        description: this.boundValues[2],
        class_id: this.boundValues[3],
        created_by: this.boundValues[4],
        r2_storage_key: this.boundValues[5],
        original_filename: this.boundValues[6],
        duration_minutes: this.boundValues[7],
        is_active: this.boundValues[8],
        start_time: this.boundValues[9],
        end_time: this.boundValues[10],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      });
    } else if (this.query.startsWith("INSERT INTO exam_codes")) {
      rows.push({
        id: this.boundValues[0],
        exam_id: this.boundValues[1],
        code: this.boundValues[2],
        max_uses: this.boundValues[3],
        current_uses: this.boundValues[4],
        expires_at: this.boundValues[5],
        is_revoked: this.boundValues[6],
        created_at: new Date().toISOString()
      });
    } else if (this.query.startsWith("INSERT INTO exam_sessions")) {
      rows.push({
        id: this.boundValues[0],
        exam_id: this.boundValues[1],
        student_id: this.boundValues[2],
        exam_code_id: this.boundValues[3],
        session_token_hash: this.boundValues[4],
        status: this.boundValues[5],
        client_ip: this.boundValues[6],
        client_platform: this.boundValues[7],
        expires_at: this.boundValues[8],
        started_at: new Date().toISOString(),
        ended_at: null
      });
    } else if (this.query.startsWith("INSERT INTO submissions")) {
      rows.push({
        id: this.boundValues[0],
        session_id: this.boundValues[1],
        exam_id: this.boundValues[2],
        student_id: this.boundValues[3],
        r2_storage_key: this.boundValues[4],
        original_sha256: this.boundValues[5],
        encrypted_sha256: this.boundValues[6],
        file_size_bytes: this.boundValues[7],
        status: this.boundValues[8],
        retry_count: 0,
        created_at: new Date().toISOString(),
        completed_at: null
      });
    } else if (this.query.startsWith("INSERT INTO encryption_metadata")) {
      rows.push({
        id: this.boundValues[0],
        resource_id: this.boundValues[1],
        resource_type: this.boundValues[2],
        format_version: this.boundValues[3],
        algorithm: this.boundValues[4],
        key_identifier: this.boundValues[5],
        nonce_hex: this.boundValues[6],
        wrapped_dek_hex: this.boundValues[7],
        original_file_size: this.boundValues[8],
        auth_tag_hex: this.boundValues[9],
        created_at: new Date().toISOString()
      });
    } else if (this.query.startsWith("INSERT INTO audit_logs")) {
      rows.push({
        id: this.boundValues[0],
        actor_id: this.boundValues[1],
        actor_type: this.boundValues[2],
        action: this.boundValues[3],
        target_resource: this.boundValues[4],
        details_json: this.boundValues[5],
        ip_address: this.boundValues[6],
        created_at: new Date().toISOString()
      });
    } else if (this.query.startsWith("UPDATE exam_codes SET is_revoked = 1")) {
      for (const r of rows) {
        if (r.exam_id === this.boundValues[0]) {
          r.is_revoked = 1;
        }
      }
    } else if (this.query.startsWith("UPDATE exam_codes SET current_uses")) {
      for (const r of rows) {
        if (r.id === this.boundValues[0]) {
          r.current_uses += 1;
        }
      }
    } else if (this.query.startsWith("UPDATE exam_sessions SET status")) {
      for (const r of rows) {
        if (r.id === this.boundValues[2]) {
          r.status = this.boundValues[0];
        }
      }
    } else if (this.query.startsWith("UPDATE submissions SET status = ?, completed_at = ?")) {
      for (const r of rows) {
        if (r.id === this.boundValues[2]) {
          r.status = this.boundValues[0];
          r.completed_at = this.boundValues[1];
        }
      }
    } else if (this.query.startsWith("UPDATE submissions SET encrypted_sha256")) {
      for (const r of rows) {
        if (r.id === this.boundValues[2]) {
          r.encrypted_sha256 = this.boundValues[0];
          r.file_size_bytes = this.boundValues[1];
        }
      }
    }

    this.storage.set(tableName, rows);
    return { success: true };
  }

  private getTableName(): string {
    const match = this.query.match(/(?:FROM|INTO|UPDATE)\s+([a-zA-Z_]+)/i);
    return match ? match[1].toLowerCase() : "unknown";
  }
}

class InMemoryD1Database {
  public storage = new Map<string, any[]>();

  prepare(query: string) {
    return new InMemoryD1PreparedStatement(query, this.storage);
  }
}

class InMemoryR2Bucket {
  public storage = new Map<string, Uint8Array>();

  async get(key: string) {
    const data = this.storage.get(key);
    if (!data) return null;
    return {
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    };
  }

  async put(key: string, value: Uint8Array | ArrayBuffer) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    this.storage.set(key, bytes);
  }
}

describe("End-to-End Worker API REST Routes", () => {
  let inMemoryDb: InMemoryD1Database;
  let inMemoryR2: InMemoryR2Bucket;
  let testEnv: Env;
  const masterSecret = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  beforeEach(() => {
    inMemoryDb = new InMemoryD1Database();
    inMemoryR2 = new InMemoryR2Bucket();
    testEnv = {
      DB: inMemoryDb as unknown as D1Database,
      STORAGE: inMemoryR2 as unknown as R2Bucket,
      MASTER_KEY_SECRET: masterSecret
    };
  });

  it("should handle full lifecycle: create exam, student validate, download, and submission", async () => {
    const createClassRequest = new Request("https://api.internal/api/v1/admin/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "TI-3A", name: "Teknik Informatika 3A" })
    });
    const classResponse = await handleRequest(createClassRequest, testEnv);
    assert.equal(classResponse.status, 201);
    const classResult = await classResponse.json() as any;
    const classId = classResult.data.id;

    const samplePkaBytes = new TextEncoder().encode("SAMPLE_CISCO_PACKET_TRACER_FILE_CONTENT");
    const createExamRequest = new Request("https://api.internal/api/v1/admin/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Ujian Jaringan 1",
        description: "Praktikum Routing",
        classId,
        durationMinutes: 90,
        pkaBase64: uint8ArrayToHexString(samplePkaBytes),
        originalFilename: "routing_lab.pka"
      })
    });

    const createExamResponse = await handleRequest(createExamRequest, testEnv);
    assert.equal(createExamResponse.status, 201);
    const examResult = await createExamResponse.json() as any;
    const examId = examResult.data.id;
    const examCode = examResult.data.code;
    assert.ok(examCode.startsWith("EXAM-"));

    const validateRequest = new Request("https://api.internal/api/v1/exam/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nim: "210001001",
        studentName: "Budi Santoso",
        classCode: "TI-3A",
        examCode: examCode
      })
    });
    const validateResponse = await handleRequest(validateRequest, testEnv);
    assert.equal(validateResponse.status, 200);
    const validateResult = await validateResponse.json() as any;
    assert.equal(validateResult.success, true);
    const sessionId = validateResult.data.sessionId;

    const downloadRequest = new Request(`https://api.internal/api/v1/exams/${examId}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });
    const downloadResponse = await handleRequest(downloadRequest, testEnv);
    assert.equal(downloadResponse.status, 200);
    const downloadResult = await downloadResponse.json() as any;
    assert.ok(downloadResult.data.sessionKeyHex);
    assert.ok(downloadResult.data.containerBase64);

    const originalSha256 = await calculateSha256Hex(samplePkaBytes);
    const initSubmissionRequest = new Request("https://api.internal/api/v1/submissions/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        examId,
        sha256Original: originalSha256,
        fileSizeBytes: 2048
      })
    });
    const initSubResponse = await handleRequest(initSubmissionRequest, testEnv);
    assert.equal(initSubResponse.status, 201);
    const initSubResult = await initSubResponse.json() as any;
    const submissionId = initSubResult.data.submissionId;

    const dummyAnswerContainer = new TextEncoder().encode("MOCK_ENCRYPTED_ANSWER_EXAMENC_BINARY");
    const uploadRequest = new Request(`https://api.internal/api/v1/submissions/${submissionId}/upload`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: dummyAnswerContainer
    });
    const uploadResponse = await handleRequest(uploadRequest, testEnv);
    assert.equal(uploadResponse.status, 200);

    const completeRequest = new Request(`https://api.internal/api/v1/submissions/${submissionId}/complete`, {
      method: "POST"
    });
    const completeResponse = await handleRequest(completeRequest, testEnv);
    assert.equal(completeResponse.status, 200);
    const completeResult = await completeResponse.json() as any;
    assert.equal(completeResult.data.status, "COMPLETED");
  });
});
