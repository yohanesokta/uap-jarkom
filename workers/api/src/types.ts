export interface Env {
  DB: D1Database;
  STORAGE: R2Bucket;
  MASTER_KEY_SECRET?: string;
  ENVIRONMENT?: string;
}

export interface AdministratorRecord {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface ClassRecord {
  id: string;
  code: string;
  name: string;
  academic_year: string;
  created_at: string;
}

export interface StudentRecord {
  id: string;
  nim: string;
  full_name: string;
  class_id: string;
  created_at: string;
}

export interface ExamRecord {
  id: string;
  title: string;
  description: string | null;
  class_id: string;
  created_by: string;
  r2_storage_key: string;
  original_filename: string;
  duration_minutes: number;
  is_active: number;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ExamCodeRecord {
  id: string;
  exam_id: string;
  code: string;
  max_uses: number;
  current_uses: number;
  expires_at: string | null;
  is_revoked: number;
  created_at: string;
}

export interface ExamSessionRecord {
  id: string;
  exam_id: string;
  student_id: string;
  exam_code_id: string;
  session_token_hash: string;
  status: string;
  client_ip: string | null;
  client_platform: string | null;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
}

export interface SubmissionRecord {
  id: string;
  session_id: string;
  exam_id: string;
  student_id: string;
  r2_storage_key: string;
  original_sha256: string;
  encrypted_sha256: string;
  file_size_bytes: number;
  status: string;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface EncryptionMetadataRecord {
  id: string;
  resource_id: string;
  resource_type: string;
  format_version: number;
  algorithm: string;
  key_identifier: string;
  nonce_hex: string;
  wrapped_dek_hex: string;
  original_file_size: number;
  auth_tag_hex: string;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  actor_id: string;
  actor_type: string;
  action: string;
  target_resource: string;
  details_json: string | null;
  ip_address: string | null;
  created_at: string;
}
