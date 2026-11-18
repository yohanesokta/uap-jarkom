import React, { useEffect, useState } from 'react';
import {
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileSpreadsheet,
} from 'lucide-react';
import { DashboardApiClient } from '../api/client.ts';
import type { ClassItem, ExamItem, SubmissionItem } from '../types/index.ts';

export const SubmissionsView: React.FC = () => {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [filterExamId, setFilterExamId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const [submissionsData, examsData, classesData] = await Promise.all([
        DashboardApiClient.listSubmissions({
          examId: filterExamId || undefined,
          classId: filterClassId || undefined,
          status: filterStatus || undefined,
        }),
        DashboardApiClient.listExams(),
        DashboardApiClient.listClasses(),
      ]);
      setSubmissions(submissionsData);
      setExams(examsData);
      setClasses(classesData);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterExamId, filterClassId, filterStatus]);

  const handleDownloadDecryptedAnswer = async (submission: SubmissionItem) => {
    try {
      setDownloadingId(submission.id);
      const filename = `${submission.student_nim}_${submission.class_code}_answer.pka`;
      await DashboardApiClient.downloadSubmissionDecrypted(submission.id, filename);
    } catch (error) {
      alert(`Gagal mengunduh jawaban: ${(error as Error).message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportCsv = () => {
    if (submissions.length === 0) return;
    const headers = [
      'NIM',
      'Nama Mahasiswa',
      'Kelas',
      'Mata Ujian',
      'Session ID',
      'Status',
      'Ukuran (Bytes)',
      'SHA256 Asli',
      'Waktu Pengumpulan',
    ];

    const rows = submissions.map((sub) => [
      sub.student_nim,
      sub.student_name,
      sub.class_code,
      sub.exam_title,
      sub.session_id,
      sub.status,
      sub.file_size_bytes,
      sub.original_sha256,
      sub.completed_at || sub.created_at,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_submisi_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Pengumpulan Jawaban Siswa
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Daftar jawaban pka terenkripsi di R2 dengan verifikasi SHA-256 dan dekripsi terotorisasi.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={submissions.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#18181b] hover:bg-[#27272a] text-[#ededed] border border-[#27272a] transition-colors disabled:opacity-50"
        >
          <FileSpreadsheet size={14} />
          Ekspor Metadata CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#0a0a0a] border border-[#27272a]">
        <select
          value={filterExamId}
          onChange={(e) => setFilterExamId(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-md bg-[#18181b] border border-[#27272a] text-[#ededed] focus:outline-none focus:border-[#0070F3]"
        >
          <option value="">Semua Mata Ujian</option>
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.title}
            </option>
          ))}
        </select>

        <select
          value={filterClassId}
          onChange={(e) => setFilterClassId(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-md bg-[#18181b] border border-[#27272a] text-[#ededed] focus:outline-none focus:border-[#0070F3]"
        >
          <option value="">Semua Kelas</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.code} - {cls.name}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-md bg-[#18181b] border border-[#27272a] text-[#ededed] focus:outline-none focus:border-[#0070F3]"
        >
          <option value="">Semua Status Submisi</option>
          <option value="COMPLETED">Berhasil (COMPLETED)</option>
          <option value="PENDING">Tertunda (PENDING)</option>
          <option value="FAILED">Gagal (FAILED)</option>
        </select>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          {errorMessage}
        </div>
      )}

      <div className="rounded-xl border border-[#27272a] bg-[#0a0a0a] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121214] border-b border-[#27272a] text-[#a1a1aa]">
              <tr>
                <th className="px-5 py-3.5 font-medium">Mahasiswa (NIM / Nama)</th>
                <th className="px-5 py-3.5 font-medium">Kelas</th>
                <th className="px-5 py-3.5 font-medium">Ujian</th>
                <th className="px-5 py-3.5 font-medium">Waktu Pengumpulan</th>
                <th className="px-5 py-3.5 font-medium">Ukuran & SHA256</th>
                <th className="px-5 py-3.5 font-medium">Status & Keutuhan</th>
                <th className="px-5 py-3.5 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[#71717a]">
                    Memuat data submisi...
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[#71717a]">
                    Belum ada submisi yang masuk.
                  </td>
                </tr>
              ) : (
                submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[#121214]/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{sub.student_name}</div>
                      <div className="text-[11px] font-mono text-[#0070F3] mt-0.5">
                        {sub.student_nim}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#ededed]">
                      {sub.class_code}
                    </td>
                    <td className="px-5 py-4 text-[#a1a1aa]">
                      {sub.exam_title}
                    </td>
                    <td className="px-5 py-4 text-[#71717a] text-[11px]">
                      {sub.completed_at
                        ? new Date(sub.completed_at).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Belum selesai'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-[#ededed]">
                        {(sub.file_size_bytes / 1024).toFixed(1)} KB
                      </div>
                      <div className="text-[10px] font-mono text-[#71717a] truncate max-w-[120px]" title={sub.original_sha256}>
                        {sub.original_sha256 ? sub.original_sha256.substring(0, 10) + '...' : '-'}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {sub.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
                          <CheckCircle size={11} />
                          Terverifikasi
                        </span>
                      ) : sub.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">
                          <Clock size={11} />
                          Tertunda ({sub.retry_count}x)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertTriangle size={11} />
                          Gagal
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDownloadDecryptedAnswer(sub)}
                        disabled={downloadingId === sub.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-[#0070F3] hover:bg-[#0060df] text-white transition-colors disabled:opacity-50"
                      >
                        <Download size={12} />
                        {downloadingId === sub.id ? 'Mendekripsi...' : 'Unduh .PKA'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
