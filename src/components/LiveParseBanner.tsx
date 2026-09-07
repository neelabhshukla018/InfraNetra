import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { ParseJob } from '../types';

interface LiveParseBannerProps {
  job: ParseJob | null;
  onDismiss: () => void;
  onViewDetails?: () => void;
}

export const LiveParseBanner: React.FC<LiveParseBannerProps> = ({
  job,
  onDismiss,
  onViewDetails,
}) => {
  if (!job) return null;

  const isProcessing = job.status === 'processing';
  const hasWarnings = job.rows_failed > 0;

  return (
    <div
      id="live-parse-status-banner"
      className="fixed top-20 right-4 sm:right-8 z-50 max-w-md w-full blurry-grey-card text-[#101A3D] rounded-xl shadow-2xl p-4 animate-in slide-in-from-top-4 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {isProcessing ? (
              <RefreshCw className="w-5 h-5 text-[#0F9D8C] animate-spin" />
            ) : hasWarnings ? (
              <AlertTriangle className="w-5 h-5 text-[#EA580C]" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#101A3D]">
                {isProcessing
                  ? `Parsing ${job.report_month} report...`
                  : job.rows_total && job.rows_total > 0
                  ? `Complete: ${job.rows_total.toLocaleString()} projects updated`
                  : `Success: ${job.report_month} PDF received`}
              </span>
              <span className="text-[10px] uppercase font-mono-code px-1.5 py-0.2 rounded bg-slate-200 text-[#0F9D8C] font-bold">
                Realtime
              </span>
            </div>
            <p className="text-xs text-[#475569] mt-1 leading-snug">
              {isProcessing
                ? 'Extracting tabular rows, calculating time/cost overruns, and refreshing early warnings.'
                : hasWarnings
                ? `Completed with ${job.rows_failed} warnings — review unmatched entries.`
                : job.rows_total && job.rows_total > 0
                ? 'All snapshots and 4-tier risk indices synchronized with National Registry.'
                : 'PDF uploaded and saved to backend/uploads/. Ready for extraction.'}
            </p>

            {onViewDetails && (
              <button
                onClick={onViewDetails}
                className="mt-2 text-xs font-semibold text-[#0F9D8C] hover:text-teal-300 underline"
              >
                View Ingestion Audit Log
              </button>
            )}
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-1 rounded transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
