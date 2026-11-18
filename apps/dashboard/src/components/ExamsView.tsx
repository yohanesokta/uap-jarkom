import React, { useEffect, useState } from 'react';
import {
  Plus,
  Key,
  Trash2,
  Copy,
  Check,
  Upload,
  AlertTriangle,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { DashboardApiClient } from '../api/client.ts';
import type { ClassItem, ExamItem } from '../types/index.ts';

export const ExamsView: React.FC = () => {
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalClassId, setModalClassId] = useState('');
  const [modalDuration, setModalDuration] = useState(90);
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const [examsData, classesData] = await Promise.all([
        DashboardApiClient.listExams(selectedClassId || undefined),
        DashboardApiClient.listClasses(),
      ]);
      setExams(examsData);
      setClasses(classesData);
      if (classesData.length > 0 && !modalClassId) {
        setModalClassId(classesData[0].id);
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedClassId]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleRotateCode = async (examId: string) => {
    try {
      const result = await DashboardApiClient.rotateExamCode(examId);
      setExams((prev) =>
        prev.map((exam) =>
          exam.id === examId ? { ...exam, currentCode: result.newCode } : exam
        )
      );
    } catch (error) {
      alert(`Gagal merotasi kode: ${(error as Error).message}`);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus ujian ini?')) {
      return;
    }
    try {
      await DashboardApiClient.deleteExam(examId);
      setExams((prev) => prev.filter((exam) => exam.id !== examId));
    } catch (error) {
      alert(`Gagal menghapus ujian: ${(error as Error).message}`);
    }
  };

  const handleCreateExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFile) {
      setModalError('Silakan pilih berkas .pka soal ujian.');
      return;
    }

    try {
      setModalSubmitting(true);
      setModalError(null);

      const arrayBuffer = await modalFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let hexString = '';
      for (let i = 0; i < bytes.length; i++) {
        hexString += bytes[i].toString(16).padStart(2, '0');
      }

      await DashboardApiClient.createExam({
        title: modalTitle,
        description: modalDescription,
        classId: modalClassId,
        durationMinutes: Number(modalDuration),
        pkaBase64: hexString,
        originalFilename: modalFile.name,
      });

      setIsModalOpen(false);
      setModalTitle('');
      setModalDescription('');
      setModalFile(null);
      await fetchData();
    } catch (error) {
      setModalError((error as Error).message);
    } finally {
      setModalSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Manajemen Mata Ujian
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Unggah berkas .pka, buat kode ujian, dan tetapkan ke kelompok kelas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-md bg-[#18181b] border border-[#27272a] text-[#ededed] focus:outline-none focus:border-[#0070F3]"
          >
            <option value="">Semua Kelompok Kelas</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.code} - {cls.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#0070F3] hover:bg-[#0060df] text-white transition-colors"
          >
            <Plus size={14} />
            Buat Ujian Baru
          </button>
        </div>
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
                <th className="px-5 py-3.5 font-medium">Judul Ujian</th>
                <th className="px-5 py-3.5 font-medium">Kelas</th>
                <th className="px-5 py-3.5 font-medium">Durasi</th>
                <th className="px-5 py-3.5 font-medium">Kode Akses Ujian</th>
                <th className="px-5 py-3.5 font-medium">Status Enkripsi R2</th>
                <th className="px-5 py-3.5 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[#71717a]">
                    Memuat data ujian...
                  </td>
                </tr>
              ) : exams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[#71717a]">
                    Belum ada mata ujian yang dibuat.
                  </td>
                </tr>
              ) : (
                exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-[#121214]/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{exam.title}</div>
                      <div className="text-[11px] text-[#71717a] mt-0.5">
                        {exam.original_filename}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#ededed]">
                      {exam.className || exam.class_id}
                    </td>
                    <td className="px-5 py-4 text-[#a1a1aa]">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} />
                        {exam.duration_minutes} Menit
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {exam.currentCode ? (
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 rounded bg-[#18181b] border border-[#27272a] text-[#0070F3] font-mono text-[11px] font-semibold">
                            {exam.currentCode}
                          </code>
                          <button
                            onClick={() => handleCopyCode(exam.currentCode!)}
                            title="Salin Kode Ujian"
                            className="p-1 text-[#71717a] hover:text-white transition-colors"
                          >
                            {copiedCode === exam.currentCode ? (
                              <Check size={13} className="text-[#10b981]" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[#71717a] text-[11px]">
                          Tidak ada kode aktif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
                        <CheckCircle size={11} />
                        AES-256-GCM
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRotateCode(exam.id)}
                          title="Rotasi Kode Baru"
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded bg-[#18181b] hover:bg-[#27272a] text-[#ededed] border border-[#27272a] transition-colors"
                        >
                          <Key size={12} />
                          Rotasi Kode
                        </button>
                        <button
                          onClick={() => handleDeleteExam(exam.id)}
                          title="Hapus Ujian"
                          className="p-1.5 text-[#71717a] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-[#27272a] bg-[#0a0a0a] p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-white">
              Buat Mata Ujian Baru
            </h2>
            <p className="text-xs text-[#a1a1aa] mt-1 mb-4">
              Unggah berkas .pka asli. Server akan langsung mengenkripsi berkas menggunakan AES-256-GCM.
            </p>

            {modalError && (
              <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateExamSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#ededed] mb-1">
                  Judul Ujian
                </label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="Contoh: Ujian Praktikum Jaringan Komputer"
                  className="w-full px-3 py-2 text-xs rounded-md bg-[#18181b] border border-[#27272a] text-white focus:outline-none focus:border-[#0070F3]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#ededed] mb-1">
                  Deskripsi / Petunjuk (Opsional)
                </label>
                <textarea
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="Instruksi tambahan untuk peserta ujian"
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-md bg-[#18181b] border border-[#27272a] text-white focus:outline-none focus:border-[#0070F3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#ededed] mb-1">
                    Kelompok Kelas
                  </label>
                  <select
                    value={modalClassId}
                    onChange={(e) => setModalClassId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-md bg-[#18181b] border border-[#27272a] text-white focus:outline-none focus:border-[#0070F3]"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.code} - {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#ededed] mb-1">
                    Durasi (Menit)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={360}
                    required
                    value={modalDuration}
                    onChange={(e) => setModalDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-md bg-[#18181b] border border-[#27272a] text-white focus:outline-none focus:border-[#0070F3]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#ededed] mb-1">
                  Berkas Soal Cisco Packet Tracer (.pka)
                </label>
                <div className="border border-dashed border-[#27272a] hover:border-[#0070F3] rounded-lg p-4 text-center cursor-pointer transition-colors bg-[#121214]">
                  <input
                    type="file"
                    accept=".pka"
                    onChange={(e) => setModalFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="pka-upload"
                  />
                  <label htmlFor="pka-upload" className="cursor-pointer block">
                    <Upload size={20} className="mx-auto text-[#a1a1aa] mb-2" />
                    <span className="text-xs text-[#ededed] font-medium block">
                      {modalFile ? modalFile.name : 'Pilih Berkas .pka'}
                    </span>
                    <span className="text-[11px] text-[#71717a] block mt-0.5">
                      {modalFile
                        ? `${(modalFile.size / 1024).toFixed(1)} KB`
                        : 'Maksimum ukuran 50 MB'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-[#18181b] hover:bg-[#27272a] text-[#ededed] border border-[#27272a] transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-1.5 text-xs font-medium rounded-md bg-[#0070F3] hover:bg-[#0060df] text-white transition-colors disabled:opacity-50"
                >
                  {modalSubmitting ? 'Mengenksipsi & Mengunggah...' : 'Buat Ujian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
