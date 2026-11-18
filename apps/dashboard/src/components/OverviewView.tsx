import React, { useEffect, useState } from 'react';
import {
  FileText,
  Users,
  GraduationCap,
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { DashboardApiClient } from '../api/client.ts';
import type { OverviewStats } from '../types/index.ts';

interface OverviewViewProps {
  onNavigateToTab: (tab: 'exams' | 'classes' | 'submissions') => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigateToTab }) => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await DashboardApiClient.getOverview();
      setStats(data);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Ringkasan Sistem Ujian
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Status agregasi data ujian, kelas, dan submisi terenkripsi waktu nyata.
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#18181b] hover:bg-[#27272a] text-[#ededed] border border-[#27272a] transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Segarkan Data
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#27272a]">
          <div className="flex items-center justify-between text-[#a1a1aa]">
            <span className="text-xs font-medium">Total Ujian Aktif</span>
            <FileText size={16} />
          </div>
          <div className="mt-3 text-2xl font-bold text-white tracking-tight">
            {loading ? '...' : stats?.totalExams ?? 0}
          </div>
          <div className="mt-2 text-[11px] text-[#71717a]">
            Soal ujian .pka terenkripsi di R2
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#27272a]">
          <div className="flex items-center justify-between text-[#a1a1aa]">
            <span className="text-xs font-medium">Kelompok Kelas</span>
            <Users size={16} />
          </div>
          <div className="mt-3 text-2xl font-bold text-white tracking-tight">
            {loading ? '...' : stats?.totalClasses ?? 0}
          </div>
          <div className="mt-2 text-[11px] text-[#71717a]">
            Kelas perkuliahan terdaftar
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#27272a]">
          <div className="flex items-center justify-between text-[#a1a1aa]">
            <span className="text-xs font-medium">Mahasiswa Terdaftar</span>
            <GraduationCap size={16} />
          </div>
          <div className="mt-3 text-2xl font-bold text-white tracking-tight">
            {loading ? '...' : stats?.totalStudents ?? 0}
          </div>
          <div className="mt-2 text-[11px] text-[#71717a]">
            Total NIM mahasiswa unik
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#27272a]">
          <div className="flex items-center justify-between text-[#a1a1aa]">
            <span className="text-xs font-medium">Sesi Ujian Aktif</span>
            <Activity size={16} className="text-[#0070F3]" />
          </div>
          <div className="mt-3 text-2xl font-bold text-[#0070F3] tracking-tight">
            {loading ? '...' : stats?.activeSessions ?? 0}
          </div>
          <div className="mt-2 text-[11px] text-[#71717a]">
            Mahasiswa sedang mengerjakan
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#27272a]">
          <div className="flex items-center gap-2 text-[#10b981]">
            <CheckCircle2 size={16} />
            <span className="text-xs font-medium">Submisi Berhasil</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {loading ? '...' : stats?.successfulSubmissions ?? 0}
          </div>
          <p className="mt-1 text-xs text-[#71717a]">
            Terenkripsi AES-256 & diverifikasi di server
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#27272a]">
          <div className="flex items-center gap-2 text-[#f59e0b]">
            <Clock size={16} />
            <span className="text-xs font-medium">Submisi Tertunda / Retry</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {loading ? '...' : stats?.pendingSubmissions ?? 0}
          </div>
          <p className="mt-1 text-xs text-[#71717a]">
            Menunggu koneksi atau sinkronisasi klien
          </p>
        </div>

        <div className="p-5 rounded-xl bg-[#0a0a0a] border border-[#27272a]">
          <div className="flex items-center gap-2 text-[#ef4444]">
            <AlertTriangle size={16} />
            <span className="text-xs font-medium">Submisi Gagal</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">
            {loading ? '...' : stats?.failedSubmissions ?? 0}
          </div>
          <p className="mt-1 text-xs text-[#71717a]">
            Memerlukan investigasi cadangan lokal .examenc
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[#27272a] bg-[#0a0a0a] p-6">
        <h2 className="text-sm font-semibold text-white">
          Akses Cepat Pengelolaan
        </h2>
        <p className="text-xs text-[#a1a1aa] mt-1 mb-4">
          Kelola bank soal praktikum atau periksa hasil pengumpulan siswa.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigateToTab('exams')}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-[#0070F3] hover:bg-[#0060df] text-white transition-colors"
          >
            Buat Ujian & Unggah File .PKA
          </button>
          <button
            onClick={() => onNavigateToTab('classes')}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-[#18181b] hover:bg-[#27272a] text-white border border-[#27272a] transition-colors"
          >
            Tambah Kelompok Kelas
          </button>
          <button
            onClick={() => onNavigateToTab('submissions')}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-[#18181b] hover:bg-[#27272a] text-white border border-[#27272a] transition-colors"
          >
            Lihat & Dekripsi Hasil Siswa
          </button>
        </div>
      </div>
    </div>
  );
};
