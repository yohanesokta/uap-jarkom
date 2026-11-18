import {
  AdministratorRecord,
  AuditLogRecord,
  ClassRecord,
  EncryptionMetadataRecord,
  ExamCodeRecord,
  ExamRecord,
  ExamSessionRecord,
  StudentRecord,
  SubmissionRecord
} from "./types.js";

export class DatabaseService {
  constructor(private readonly database: D1Database) {}

  async findAdministratorByUsername(username: string): Promise<AdministratorRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM administrators WHERE username = ? LIMIT 1"
    );
    return await statement.bind(username).first<AdministratorRecord>();
  }

  async findAdministratorById(id: string): Promise<AdministratorRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM administrators WHERE id = ? LIMIT 1"
    );
    return await statement.bind(id).first<AdministratorRecord>();
  }

  async createAdministrator(admin: AdministratorRecord): Promise<void> {
    const statement = this.database.prepare(
      "INSERT INTO administrators (id, username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?, ?)"
    );
    await statement
      .bind(
        admin.id,
        admin.username,
        admin.email,
        admin.password_hash,
        admin.full_name,
        admin.role
      )
      .run();
  }

  async listClasses(): Promise<ClassRecord[]> {
    const statement = this.database.prepare(
      "SELECT * FROM classes ORDER BY code ASC"
    );
    const result = await statement.all<ClassRecord>();
    return result.results;
  }

  async findClassById(id: string): Promise<ClassRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM classes WHERE id = ? LIMIT 1"
    );
    return await statement.bind(id).first<ClassRecord>();
  }

  async findClassByCode(code: string): Promise<ClassRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM classes WHERE code = ? LIMIT 1"
    );
    return await statement.bind(code).first<ClassRecord>();
  }

  async createClass(classRecord: ClassRecord): Promise<void> {
    const statement = this.database.prepare(
      "INSERT INTO classes (id, code, name, academic_year) VALUES (?, ?, ?, ?)"
    );
    await statement
      .bind(
        classRecord.id,
        classRecord.code,
        classRecord.name,
        classRecord.academic_year
      )
      .run();
  }

  async findStudentByNim(nim: string): Promise<StudentRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM students WHERE nim = ? LIMIT 1"
    );
    return await statement.bind(nim).first<StudentRecord>();
  }

  async upsertStudent(student: StudentRecord): Promise<StudentRecord> {
    const existing = await this.findStudentByNim(student.nim);
    if (existing) {
      const updateStatement = this.database.prepare(
        "UPDATE students SET full_name = ?, class_id = ? WHERE id = ?"
      );
      await updateStatement.bind(student.full_name, student.class_id, existing.id).run();
      return { ...existing, full_name: student.full_name, class_id: student.class_id };
    }

    const insertStatement = this.database.prepare(
      "INSERT INTO students (id, nim, full_name, class_id) VALUES (?, ?, ?, ?)"
    );
    await insertStatement
      .bind(student.id, student.nim, student.full_name, student.class_id)
      .run();
    return student;
  }

  async findExamCode(code: string): Promise<ExamCodeRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM exam_codes WHERE code = ? AND is_revoked = 0 LIMIT 1"
    );
    return await statement.bind(code).first<ExamCodeRecord>();
  }

  async createExamCode(examCode: ExamCodeRecord): Promise<void> {
    const statement = this.database.prepare(
      "INSERT INTO exam_codes (id, exam_id, code, max_uses, current_uses, expires_at, is_revoked) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    await statement
      .bind(
        examCode.id,
        examCode.exam_id,
        examCode.code,
        examCode.max_uses,
        examCode.current_uses,
        examCode.expires_at,
        examCode.is_revoked
      )
      .run();
  }

  async revokeExamCodesForExam(examId: string): Promise<void> {
    const statement = this.database.prepare(
      "UPDATE exam_codes SET is_revoked = 1 WHERE exam_id = ?"
    );
    await statement.bind(examId).run();
  }

  async incrementExamCodeUsage(codeId: string): Promise<void> {
    const statement = this.database.prepare(
      "UPDATE exam_codes SET current_uses = current_uses + 1 WHERE id = ?"
    );
    await statement.bind(codeId).run();
  }

  async findExamById(id: string): Promise<ExamRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM exams WHERE id = ? AND deleted_at IS NULL LIMIT 1"
    );
    return await statement.bind(id).first<ExamRecord>();
  }

  async listExams(classId?: string): Promise<ExamRecord[]> {
    if (classId) {
      const statement = this.database.prepare(
        "SELECT * FROM exams WHERE class_id = ? AND deleted_at IS NULL ORDER BY created_at DESC"
      );
      const result = await statement.bind(classId).all<ExamRecord>();
      return result.results;
    }
    const statement = this.database.prepare(
      "SELECT * FROM exams WHERE deleted_at IS NULL ORDER BY created_at DESC"
    );
    const result = await statement.all<ExamRecord>();
    return result.results;
  }

  async createExam(exam: ExamRecord): Promise<void> {
    const statement = this.database.prepare(
      "INSERT INTO exams (id, title, description, class_id, created_by, r2_storage_key, original_filename, duration_minutes, is_active, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    await statement
      .bind(
        exam.id,
        exam.title,
        exam.description,
        exam.class_id,
        exam.created_by,
        exam.r2_storage_key,
        exam.original_filename,
        exam.duration_minutes,
        exam.is_active,
        exam.start_time,
        exam.end_time
      )
      .run();
  }

  async updateExam(exam: ExamRecord): Promise<void> {
    const statement = this.database.prepare(
      "UPDATE exams SET title = ?, description = ?, class_id = ?, duration_minutes = ?, is_active = ?, start_time = ?, end_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    );
    await statement
      .bind(
        exam.title,
        exam.description,
        exam.class_id,
        exam.duration_minutes,
        exam.is_active,
        exam.start_time,
        exam.end_time,
        exam.id
      )
      .run();
  }

  async softDeleteExam(id: string): Promise<void> {
    const statement = this.database.prepare(
      "UPDATE exams SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?"
    );
    await statement.bind(id).run();
  }

  async createExamSession(session: ExamSessionRecord): Promise<void> {
    const statement = this.database.prepare(
      "INSERT INTO exam_sessions (id, exam_id, student_id, exam_code_id, session_token_hash, status, client_ip, client_platform, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    await statement
      .bind(
        session.id,
        session.exam_id,
        session.student_id,
        session.exam_code_id,
        session.session_token_hash,
        session.status,
        session.client_ip,
        session.client_platform,
        session.expires_at
      )
      .run();
  }

  async findSessionByTokenHash(tokenHash: string): Promise<ExamSessionRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM exam_sessions WHERE session_token_hash = ? LIMIT 1"
    );
    return await statement.bind(tokenHash).first<ExamSessionRecord>();
  }

  async findSessionById(id: string): Promise<ExamSessionRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM exam_sessions WHERE id = ? LIMIT 1"
    );
    return await statement.bind(id).first<ExamSessionRecord>();
  }

  async updateSessionStatus(id: string, status: string): Promise<void> {
    const statement = this.database.prepare(
      "UPDATE exam_sessions SET status = ?, ended_at = CASE WHEN ? = 'CLOSED' THEN CURRENT_TIMESTAMP ELSE ended_at END WHERE id = ?"
    );
    await statement.bind(status, status, id).run();
  }

  async createSubmission(submission: SubmissionRecord): Promise<void> {
    const statement = this.database.prepare(
      "INSERT INTO submissions (id, session_id, exam_id, student_id, r2_storage_key, original_sha256, encrypted_sha256, file_size_bytes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    await statement
      .bind(
        submission.id,
        submission.session_id,
        submission.exam_id,
        submission.student_id,
        submission.r2_storage_key,
        submission.original_sha256,
        submission.encrypted_sha256,
        submission.file_size_bytes,
        submission.status
      )
      .run();
  }

  async findSubmissionById(id: string): Promise<SubmissionRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM submissions WHERE id = ? LIMIT 1"
    );
    return await statement.bind(id).first<SubmissionRecord>();
  }

  async findSubmissionBySessionId(sessionId: string): Promise<SubmissionRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM submissions WHERE session_id = ? LIMIT 1"
    );
    return await statement.bind(sessionId).first<SubmissionRecord>();
  }

  async updateSubmissionStatus(
    id: string,
    status: string,
    completedAt?: string
  ): Promise<void> {
    if (completedAt) {
      const statement = this.database.prepare(
        "UPDATE submissions SET status = ?, completed_at = ? WHERE id = ?"
      );
      await statement.bind(status, completedAt, id).run();
    } else {
      const statement = this.database.prepare(
        "UPDATE submissions SET status = ?, retry_count = retry_count + 1 WHERE id = ?"
      );
      await statement.bind(status, id).run();
    }
  }

  async listSubmissions(filter?: {
    examId?: string;
    classId?: string;
    status?: string;
  }): Promise<(SubmissionRecord & { student_name: string; student_nim: string; exam_title: string; class_code: string })[]> {
    let query = `
      SELECT s.*, st.full_name as student_name, st.nim as student_nim, e.title as exam_title, c.code as class_code
      FROM submissions s
      JOIN students st ON s.student_id = st.id
      JOIN exams e ON s.exam_id = e.id
      JOIN classes c ON st.class_id = c.id
      WHERE 1=1
    `;
    const parameters: string[] = [];

    if (filter?.examId) {
      query += " AND s.exam_id = ?";
      parameters.push(filter.examId);
    }
    if (filter?.classId) {
      query += " AND st.class_id = ?";
      parameters.push(filter.classId);
    }
    if (filter?.status) {
      query += " AND s.status = ?";
      parameters.push(filter.status);
    }

    query += " ORDER BY s.created_at DESC";

    const statement = this.database.prepare(query);
    const result = await statement.bind(...parameters).all<
      SubmissionRecord & { student_name: string; student_nim: string; exam_title: string; class_code: string }
    >();
    return result.results;
  }

  async createEncryptionMetadata(metadata: EncryptionMetadataRecord): Promise<void> {
    const statement = this.database.prepare(
      "INSERT INTO encryption_metadata (id, resource_id, resource_type, format_version, algorithm, key_identifier, nonce_hex, wrapped_dek_hex, original_file_size, auth_tag_hex) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    await statement
      .bind(
        metadata.id,
        metadata.resource_id,
        metadata.resource_type,
        metadata.format_version,
        metadata.algorithm,
        metadata.key_identifier,
        metadata.nonce_hex,
        metadata.wrapped_dek_hex,
        metadata.original_file_size,
        metadata.auth_tag_hex
      )
      .run();
  }

  async findEncryptionMetadataByResourceId(
    resourceId: string
  ): Promise<EncryptionMetadataRecord | null> {
    const statement = this.database.prepare(
      "SELECT * FROM encryption_metadata WHERE resource_id = ? LIMIT 1"
    );
    return await statement.bind(resourceId).first<EncryptionMetadataRecord>();
  }

  async createAuditLog(log: AuditLogRecord): Promise<void> {
    const statement = this.database.prepare(
      "INSERT INTO audit_logs (id, actor_id, actor_type, action, target_resource, details_json, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    await statement
      .bind(
        log.id,
        log.actor_id,
        log.actor_type,
        log.action,
        log.target_resource,
        log.details_json,
        log.ip_address
      )
      .run();
  }

  async listAuditLogs(limit: number = 50): Promise<AuditLogRecord[]> {
    const statement = this.database.prepare(
      "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?"
    );
    const result = await statement.bind(limit).all<AuditLogRecord>();
    return result.results;
  }

  async getDashboardOverview(): Promise<{
    totalExams: number;
    totalClasses: number;
    totalStudents: number;
    activeSessions: number;
    successfulSubmissions: number;
    pendingSubmissions: number;
    failedSubmissions: number;
  }> {
    const examsCount = await this.database
      .prepare("SELECT COUNT(*) as count FROM exams WHERE deleted_at IS NULL")
      .first<{ count: number }>();
    const classesCount = await this.database
      .prepare("SELECT COUNT(*) as count FROM classes")
      .first<{ count: number }>();
    const studentsCount = await this.database
      .prepare("SELECT COUNT(*) as count FROM students")
      .first<{ count: number }>();
    const activeSessionsCount = await this.database
      .prepare("SELECT COUNT(*) as count FROM exam_sessions WHERE status = 'ACTIVE'")
      .first<{ count: number }>();
    const successSubmissionsCount = await this.database
      .prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'COMPLETED'")
      .first<{ count: number }>();
    const pendingSubmissionsCount = await this.database
      .prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'PENDING'")
      .first<{ count: number }>();
    const failedSubmissionsCount = await this.database
      .prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'FAILED'")
      .first<{ count: number }>();

    return {
      totalExams: examsCount?.count ?? 0,
      totalClasses: classesCount?.count ?? 0,
      totalStudents: studentsCount?.count ?? 0,
      activeSessions: activeSessionsCount?.count ?? 0,
      successfulSubmissions: successSubmissionsCount?.count ?? 0,
      pendingSubmissions: pendingSubmissionsCount?.count ?? 0,
      failedSubmissions: failedSubmissionsCount?.count ?? 0
    };
  }
}
