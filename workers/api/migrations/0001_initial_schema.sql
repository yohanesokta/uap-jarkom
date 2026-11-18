CREATE TABLE IF NOT EXISTS administrators (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'LECTURER',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classes_code ON classes(code);

CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    nim TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    class_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_students_nim ON students(nim);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);

CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    class_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    r2_storage_key TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    start_time DATETIME,
    end_time DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES administrators(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(class_id);
CREATE INDEX IF NOT EXISTS idx_exams_active ON exams(is_active);

CREATE TABLE IF NOT EXISTS exam_codes (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    max_uses INTEGER NOT NULL DEFAULT 0,
    current_uses INTEGER NOT NULL DEFAULT 0,
    expires_at DATETIME,
    is_revoked INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exam_codes_lookup ON exam_codes(code, is_revoked);

CREATE TABLE IF NOT EXISTS exam_sessions (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    exam_code_id TEXT NOT NULL,
    session_token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    client_ip TEXT,
    client_platform TEXT,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    ended_at DATETIME,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE RESTRICT,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT,
    FOREIGN KEY (exam_code_id) REFERENCES exam_codes(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON exam_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_student_exam ON exam_sessions(student_id, exam_id);

CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    exam_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    r2_storage_key TEXT NOT NULL,
    original_sha256 TEXT NOT NULL,
    encrypted_sha256 TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE RESTRICT,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE RESTRICT,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_exam ON submissions(exam_id);

CREATE TABLE IF NOT EXISTS encryption_metadata (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL UNIQUE,
    resource_type TEXT NOT NULL,
    format_version INTEGER NOT NULL DEFAULT 1,
    algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    key_identifier TEXT NOT NULL,
    nonce_hex TEXT NOT NULL,
    wrapped_dek_hex TEXT NOT NULL,
    original_file_size INTEGER NOT NULL,
    auth_tag_hex TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crypto_resource ON encryption_metadata(resource_id, resource_type);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    action TEXT NOT NULL,
    target_resource TEXT NOT NULL,
    details_json TEXT,
    ip_address TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

INSERT OR IGNORE INTO administrators (id, username, email, password_hash, full_name, role)
VALUES ('admin_default', 'admin', 'admin@kampus.ac.id', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Dosen Pengampu', 'ADMINISTRATOR');
