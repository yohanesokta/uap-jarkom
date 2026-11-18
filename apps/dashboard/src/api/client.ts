import type {
  AuditLogItem,
  ClassItem,
  ExamItem,
  OverviewStats,
  SubmissionItem,
} from '../types/index.ts';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787';

export class DashboardApiClient {
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(
        result.error?.message || `Request to ${endpoint} failed with status ${response.status}`
      );
    }

    return result.data as T;
  }

  static async getOverview(): Promise<OverviewStats> {
    return this.request<OverviewStats>('/api/v1/admin/overview');
  }

  static async listClasses(): Promise<ClassItem[]> {
    return this.request<ClassItem[]>('/api/v1/admin/classes');
  }

  static async createClass(data: {
    code: string;
    name: string;
    academicYear?: string;
  }): Promise<ClassItem> {
    return this.request<ClassItem>('/api/v1/admin/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async listExams(classId?: string): Promise<ExamItem[]> {
    const query = classId ? `?classId=${encodeURIComponent(classId)}` : '';
    return this.request<ExamItem[]>(`/api/v1/admin/exams${query}`);
  }

  static async createExam(data: {
    title: string;
    description?: string;
    classId: string;
    durationMinutes: number;
    pkaBase64: string;
    originalFilename?: string;
  }): Promise<ExamItem & { code: string }> {
    return this.request<ExamItem & { code: string }>('/api/v1/admin/exams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async rotateExamCode(
    examId: string
  ): Promise<{ examId: string; newCode: string }> {
    return this.request<{ examId: string; newCode: string }>(
      `/api/v1/admin/exams/${examId}/rotate-code`,
      { method: 'POST' }
    );
  }

  static async deleteExam(examId: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/api/v1/admin/exams/${examId}`, {
      method: 'DELETE',
    });
  }

  static async listSubmissions(filter?: {
    examId?: string;
    classId?: string;
    status?: string;
  }): Promise<SubmissionItem[]> {
    const params = new URLSearchParams();
    if (filter?.examId) params.append('examId', filter.examId);
    if (filter?.classId) params.append('classId', filter.classId);
    if (filter?.status) params.append('status', filter.status);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<SubmissionItem[]>(`/api/v1/admin/submissions${query}`);
  }

  static async downloadSubmissionDecrypted(
    submissionId: string,
    filename: string
  ): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/admin/submissions/${submissionId}/download`
    );

    if (!response.ok) {
      throw new Error(`Failed to download submission: status ${response.status}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(anchor);
  }

  static async listAuditLogs(): Promise<AuditLogItem[]> {
    return this.request<AuditLogItem[]>('/api/v1/admin/audit-logs');
  }
}
