import React, { useState, useEffect } from 'react';
import {
  X,
  Briefcase,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Clock,
  User,
  Mail,
  FolderGit2,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import { ApprovalRequest } from '../types';
import {
  getMinistryPendingManagers,
  approveManagerByMinistry,
  rejectManagerByMinistry,
  suspendManagerByMinistry,
} from '../services/api';

interface MinistryManagerApprovalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ministryName?: string;
}

export const MinistryManagerApprovalsModal: React.FC<MinistryManagerApprovalsModalProps> = ({
  isOpen,
  onClose,
  ministryName = 'Assigned Ministry',
}) => {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const fetchPending = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const data = await getMinistryPendingManagers();
      setRequests(data.pending_managers || []);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to fetch pending project manager requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPending();
      setActionSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApprove = async (req: ApprovalRequest) => {
    setProcessingId(req.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await approveManagerByMinistry(req.id, req.project_id || undefined);
      setActionSuccess(`Successfully approved Project Manager "${req.username}" for Project #${req.project_id}.`);
      await fetchPending();
    } catch (err: any) {
      setActionError(err?.message || 'Approval failed.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: ApprovalRequest) => {
    const reason = window.prompt(`Enter rejection reason for ${req.username}:`, 'Rejected by Ministry authority');
    if (reason === null) return;
    setProcessingId(req.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await rejectManagerByMinistry(req.id, reason);
      setActionSuccess(`Project Manager "${req.username}" registration rejected.`);
      await fetchPending();
    } catch (err: any) {
      setActionError(err?.message || 'Rejection failed.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSuspend = async (req: ApprovalRequest) => {
    const reason = window.prompt(`Enter suspension reason for ${req.username}:`, 'Suspended by Ministry authority');
    if (reason === null) return;
    setProcessingId(req.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await suspendManagerByMinistry(req.id, reason);
      setActionSuccess(`Project Manager "${req.username}" suspended.`);
      await fetchPending();
    } catch (err: any) {
      setActionError(err?.message || 'Suspension failed.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div
      id="ministry-approvals-modal-backdrop"
      className="fixed inset-0 z-50 bg-[#0B132B]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="ministry-approvals-modal-card"
        className="relative bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#64748B] hover:text-[#101A3D] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-[#F1F5F9]">
          <div className="w-10 h-10 rounded-xl bg-[#101A3D] text-[#0F9D8C] flex items-center justify-center shrink-0 shadow-md">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#101A3D]">
              Project Manager Approvals
            </h2>
            <p className="text-xs text-[#64748B]">
              Ministry Scoped: <span className="font-semibold text-slate-800">{ministryName}</span>
            </p>
          </div>
        </div>

        {/* Action Alerts */}
        {actionError && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>{actionError}</div>
          </div>
        )}

        {actionSuccess && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>{actionSuccess}</div>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#0F9D8C]" />
              <span className="text-xs">Loading pending applications...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Pending Applications</p>
              <p className="text-xs text-slate-500 mt-1">
                All Project Manager registration requests for your ministry have been processed.
              </p>
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#0F9D8C]/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 text-xs min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#101A3D]">{req.full_name}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">
                      @{req.username}
                    </span>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                      {req.status}
                    </span>
                  </div>
                  <div className="text-slate-600 flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{req.email}</span>
                  </div>
                  <div className="text-slate-700 flex items-center gap-1.5 font-medium">
                    <FolderGit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      Project ID: <strong className="text-[#101A3D]">{req.project_code || req.project_id}</strong>
                      {req.project_name && <span className="text-slate-600"> — {req.project_name}</span>}
                    </span>
                  </div>
                  {(req.ministry || ministryName) && (
                    <div className="text-slate-600 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Project Ministry: <strong className="text-slate-800 font-semibold">{req.ministry || ministryName}</strong></span>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Registration Date: {new Date(req.created_at).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={processingId === req.id}
                    onClick={() => handleApprove(req)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {processingId === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    disabled={processingId === req.id}
                    onClick={() => handleReject(req)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    disabled={processingId === req.id}
                    onClick={() => handleSuspend(req)}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                    title="Suspend user"
                  >
                    Suspend
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
