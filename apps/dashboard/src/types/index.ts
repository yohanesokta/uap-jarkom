export interface OverviewStats {
  totalExams: number;
  totalClasses: number;
  totalStudents: number;
  activeSessions: number;
  successfulSubmissions: number;
  pendingSubmissions: number;
  failedSubmissions: number;
}

export interface ClassItem {
  id: string;
  code: string;
  name: string;
  academic_year: string;
  created_at: string;
}

export interface ExamItem {
  id: string;
  title: string;
  description: string | null;
  class_id: string;
  className?: string;
  currentCode?: string | null;
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

export interface SubmissionItem {
  id: string;
  session_id: string;
  exam_id: string;
  student_id: string;
  student_name: string;
  student_nim: string;
  exam_title: string;
  class_code: string;
  r2_storage_key: string;
  original_sha256: string;
  encrypted_sha256: string;
  file_size_bytes: number;
  status: string;
  retry_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface AuditLogItem {
  id: string;
  actor_id: string;
  actor_type: string;
  action: string;
  target_resource: string;
  details_json: string | null;
  ip_address: string | null;
  created_at: string;
}
