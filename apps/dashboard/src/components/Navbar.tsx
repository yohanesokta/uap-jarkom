import React from 'react';
import {
  ShieldCheck,
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  UploadCloud,
  FileText,
} from 'lucide-react';

export type NavigationTab =
  | 'overview'
  | 'exams'
  | 'classes'
  | 'submissions'
  | 'audit';

interface NavbarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const navItems: { id: NavigationTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Ringkasan', icon: <LayoutDashboard size={16} /> },
    { id: 'exams', label: 'Mata Ujian', icon: <FileSpreadsheet size={16} /> },
    { id: 'classes', label: 'Kelompok Kelas', icon: <Users size={16} /> },
    { id: 'submissions', label: 'Submisi Mahasiswa', icon: <UploadCloud size={16} /> },
    { id: 'audit', label: 'Audit Trail', icon: <FileText size={16} /> },
  ];

  return (
    <header className="border-b border-[#27272a] bg-[#000000]/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0070F3]/10 border border-[#0070F3]/30 flex items-center justify-center text-[#0070F3]">
              <ShieldCheck size={20} />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-white block">
                Packet Tracer Exam
              </span>
              <span className="text-xs text-[#a1a1aa] block -mt-0.5">
                Admin Management Panel
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#27272a] text-white shadow-sm'
                      : 'text-[#a1a1aa] hover:text-white hover:bg-[#18181b]'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
              Backend Ready
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
