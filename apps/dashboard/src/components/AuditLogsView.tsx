import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { DashboardApiClient } from '../api/client.ts';
import type { AuditLogItem } from '../types/index.ts';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const data = await DashboardApiClient.listAuditLogs();
      setLogs(data);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Audit Trail Keamanan
          </h1>
          <p className="text-xs text-[#a1a1aa] mt-1">
            Catatan aktivitas immutable audit logs untuk forensik dan transparansi pengujian.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#18181b] hover:bg-[#27272a] text-[#ededed] border border-[#27272a] transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Segarkan
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
                <th className="px-5 py-3.5 font-medium">Aktor</th>
                <th className="px-5 py-3.5 font-medium">Aksi</th>
                <th className="px-5 py-3.5 font-medium">Sumber Daya Target</th>
                <th className="px-5 py-3.5 font-medium">IP Address</th>
                <th className="px-5 py-3.5 font-medium">Waktu Kejadian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272a]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[#71717a]">
                    Memuat log audit...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#71717a]">
                    Belum ada catatan aktivitas keamanan.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#121214]/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{log.actor_id}</div>
                      <div className="text-[11px] text-[#71717a] mt-0.5">
                        {log.actor_type}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono font-medium text-[#0070F3]">
                      {log.action}
                    </td>
                    <td className="px-5 py-4 font-mono text-[#ededed] text-[11px]">
                      {log.target_resource}
                    </td>
                    <td className="px-5 py-4 text-[#a1a1aa] font-mono text-[11px]">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="px-5 py-4 text-[#71717a] text-[11px]">
                      {new Date(log.created_at).toLocaleString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
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
