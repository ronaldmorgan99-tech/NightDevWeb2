import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ShieldAlert, 
  History, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  UserMinus, 
  Trash2,
  Clock,
  User,
  MoreVertical,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PromptModal from '../../components/PromptModal';
import { apiJson } from '../../lib/api';

interface Report {
  id: number;
  reporter_id: number;
  reporter_name: string;
  target_type: 'post' | 'thread' | 'user';
  target_id: number;
  reason: string;
  status: string;
  created_at: string;
}

interface AuditLog {
  id: number;
  moderator_id: number;
  moderator_name: string;
  action_type: string;
  target_type: string;
  target_id: number;
  reason: string;
  created_at: string;
}

const asArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const AdminModerationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'reports' | 'audit'>('reports');
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    reportId: number | null;
    action: string | null;
  }>({
    isOpen: false,
    reportId: null,
    action: null
  });
  const queryClient = useQueryClient();

  const { data: reports, isLoading: reportsLoading } = useQuery<Report[] | null>({
    queryKey: ['admin-reports'],
    queryFn: () => apiJson<Report[] | null>('/api/admin/reports'),
    enabled: activeTab === 'reports'
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery<AuditLog[] | null>({
    queryKey: ['admin-audit-log'],
    queryFn: () => apiJson<AuditLog[] | null>('/api/admin/audit-log'),
    enabled: activeTab === 'audit'
  });

  const actionMutation = useMutation({
    mutationFn: ({ reportId, action, reason }: { reportId: number; action: string; reason: string }) =>
      apiJson(`/api/admin/reports/${reportId}/action`, {
        method: 'POST',
        json: { action, reason }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-log'] });
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['forum'] });
      queryClient.invalidateQueries({ queryKey: ['thread'] });
    }
  });

  const handleAction = (reportId: number, action: string) => {
    setPromptModal({ isOpen: true, reportId, action });
  };

  const normalizedReports = asArray(reports);
  const normalizedAuditLogs = asArray(auditLogs);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Moderation Center</h1>
          <p className="text-zinc-400">Handle community reports and review moderation history.</p>
        </div>

        <div className="flex bg-[#121214] border border-white/5 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-500 hover:text-white'}`}
          >
            <ShieldAlert className="w-4 h-4" />
            Pending Reports
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-500 hover:text-white'}`}
          >
            <History className="w-4 h-4" />
            Audit Log
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'reports' ? (
          <motion.div
            key="reports"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {reportsLoading ? (
              <div className="animate-pulse space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 bg-white/5 rounded-2xl" />)}</div>
            ) : normalizedReports.length === 0 ? (
              <div className="p-12 text-center bg-[#121214] border border-white/5 rounded-2xl">
                <CheckCircle className="w-12 h-12 text-emerald-500/20 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white">All Clear!</h3>
                <p className="text-zinc-500">No pending reports to review at this time.</p>
              </div>
            ) : (
              normalizedReports.map((report) => (
                <div key={report.id} className="bg-[#121214] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="p-6 flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          report.target_type === 'post' ? 'bg-indigo-500/10 text-indigo-400' :
                          report.target_type === 'thread' ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {report.target_type}
                        </div>
                        <span className="text-xs text-zinc-500">
                          Reported by <span className="text-white font-bold">{report.reporter_name}</span>
                        </span>
                        <span className="text-xs text-zinc-600">•</span>
                        <span className="text-xs text-zinc-600">{new Date(report.created_at).toLocaleString()}</span>
                      </div>
                      
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                        <p className="text-sm text-zinc-400 italic">"{report.reason}"</p>
                      </div>

                      <div className="text-xs text-zinc-500">
                        Target ID: <span className="text-zinc-300">#{report.target_id}</span>
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2 justify-center">
                      <button 
                        onClick={() => handleAction(report.id, 'dismiss')}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 text-zinc-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                      >
                        <XCircle className="w-4 h-4" /> Dismiss
                      </button>
                      <button 
                        onClick={() => handleAction(report.id, 'warn')}
                        className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 rounded-lg text-xs font-bold transition-all"
                      >
                        <AlertTriangle className="w-4 h-4" /> Warn User
                      </button>
                      <button 
                        onClick={() => handleAction(report.id, 'hide')}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 rounded-lg text-xs font-bold transition-all"
                      >
                        <EyeOff className="w-4 h-4" /> Hide Content
                      </button>
                      <button 
                        onClick={() => handleAction(report.id, 'remove')}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-all"
                      >
                        <Trash2 className="w-4 h-4" /> Remove Content
                      </button>
                      <button 
                        onClick={() => handleAction(report.id, 'suspend')}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg text-xs font-bold transition-all shadow-lg shadow-red-600/20"
                      >
                        <UserMinus className="w-4 h-4" /> Suspend User
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#121214] border border-white/5 rounded-2xl overflow-hidden"
          >
            {auditLoading ? (
              <div className="animate-pulse p-6 space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl" />)}</div>
            ) : normalizedAuditLogs.length === 0 ? (
              <div className="p-12 text-center">
                <History className="w-12 h-12 text-zinc-700/40 mx-auto mb-4" />
                <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">No moderation audit records returned</p>
              </div>
            ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/5 text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Target</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {normalizedAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                          {log.moderator_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-white">{log.moderator_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md ${
                        log.action_type === 'dismiss' ? 'bg-zinc-800 text-zinc-400' :
                        log.action_type === 'warn' ? 'bg-yellow-500/10 text-yellow-500' :
                        log.action_type === 'hide' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {log.action_type}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-zinc-400">
                        <span className="capitalize">{log.target_type}</span> #{log.target_id}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-zinc-500 line-clamp-1 max-w-xs" title={log.reason}>
                        {log.reason || 'No reason provided'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-zinc-600">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <PromptModal
        isOpen={promptModal.isOpen}
        onClose={() => setPromptModal({ ...promptModal, isOpen: false })}
        onConfirm={(reason) => {
          if (promptModal.reportId && promptModal.action) {
            actionMutation.mutate({ 
              reportId: promptModal.reportId, 
              action: promptModal.action, 
              reason 
            });
          }
        }}
        title={`Action: ${promptModal.action}`}
        message={`Please provide a reason for this moderation action.`}
      />
    </div>
  );
};

export default AdminModerationPage;
