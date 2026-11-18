import React, { useEffect, useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { DashboardApiClient } from '../api/client.ts';
import type { ClassItem } from '../types/index.ts';

export const ClassesView: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCode, setModalCode] = useState('');
  const [modalName, setModalName] = useState('');
  const [modalYear, setModalYear] = useState(new Date().getFullYear().toString());
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await DashboardApiClient.listClasses();
      setClasses(data);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleCreateClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalSubmitting(true);
      setModalError(null);
      await DashboardApiClient.createClass({
        code: modalCode.trim().toUpperCase(),
        name: modalName.trim(),
        academicYear: modalYear.trim(),
      });
      setIsModalOpen(false);
      setModalCode('');
      setModalName('');
      await fetchClasses();
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
            Kelompok Kelas Perkuliahan
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Manajemen kelas untuk pembagian jadwal dan hak akses mata ujian.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#0070F3] hover:bg-[#0060df] text-white transition-colors"
        >
          <Plus size={14} />
          Tambah Kelas Baru
        </button>
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
                <th className="px-5 py-3.5 font-medium">Kode Kelas</th>
                <th className="px-5 py-3.5 font-medium">Nama Kelompok Kelas</th>
                <th className="px-5 py-3.5 font-medium">Tahun Akademik</th>
                <th className="px-5 py-3.5 font-medium">Tanggal Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-[#71717a]">
                    Memuat daftar kelas...
                  </td>
                </tr>
              ) : classes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-[#71717a]">
                    Belum ada kelas yang didaftarkan.
                  </td>
                </tr>
              ) : (
                classes.map((cls) => (
                  <tr key={cls.id} className="hover:bg-[#121214]/50 transition-colors">
                    <td className="px-5 py-4 font-mono font-semibold text-[#0070F3]">
                      {cls.code}
                    </td>
                    <td className="px-5 py-4 font-medium text-white">
                      {cls.name}
                    </td>
                    <td className="px-5 py-4 text-[#a1a1aa]">
                      {cls.academic_year}
                    </td>
                    <td className="px-5 py-4 text-[#71717a] text-[11px]">
                      {new Date(cls.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
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
          <div className="w-full max-w-md rounded-xl border border-[#27272a] bg-[#0a0a0a] p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-white">
              Tambah Kelompok Kelas Baru
            </h2>
            <p className="text-xs text-[#a1a1aa] mt-1 mb-4">
              Daftarkan kode kelas baru untuk pemetaan mahasiswa dan ujian praktikum.
            </p>

            {modalError && (
              <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateClassSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#ededed] mb-1">
                  Kode Kelas
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: TI-3A"
                  value={modalCode}
                  onChange={(e) => setModalCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md bg-[#18181b] border border-[#27272a] text-white focus:outline-none focus:border-[#0070F3] font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#ededed] mb-1">
                  Nama Kelas
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Teknik Informatika Kelas 3A"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md bg-[#18181b] border border-[#27272a] text-white focus:outline-none focus:border-[#0070F3]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#ededed] mb-1">
                  Tahun Akademik
                </label>
                <input
                  type="text"
                  required
                  value={modalYear}
                  onChange={(e) => setModalYear(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md bg-[#18181b] border border-[#27272a] text-white focus:outline-none focus:border-[#0070F3]"
                />
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
                  {modalSubmitting ? 'Menyimpan...' : 'Simpan Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
