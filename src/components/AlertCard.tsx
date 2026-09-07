import React from 'react';
import { ChevronRight, Check, RotateCcw, Building2 } from 'lucide-react';
import { EarlyWarning, ProjectWithSnapshot, RiskTier } from '../types';
import { RiskBadge } from './RiskBadge';

interface AlertCardProps {
  warning: EarlyWarning;
  project: ProjectWithSnapshot;
  isDismissed?: boolean;
  onToggleDismiss?: (warningId: string) => void;
  onSelectProject: (projectCode: string, section?: string) => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  warning,
  project,
  isDismissed = false,
  onToggleDismiss,
  onSelectProject,
}) => {
  // 3px colored left border matching severity per spec
  const borderLeftClass = {
    critical: 'border-l-[3px] border-l-[#DC2626]',
    high: 'border-l-[3px] border-l-[#EA580C]',
    medium: 'border-l-[3px] border-l-[#D97706]',
    low: 'border-l-[3px] border-l-[#16A34A]',
  }[warning.severity] || 'border-l-[3px] border-l-[#DC2626]';

  return (
    <div
      id={`alert-card-${warning.id}`}
      className={`bg-white rounded-lg p-5 sm:p-6 border border-[#E2E8F0] ${borderLeftClass} shadow-xs transition-all ${
        isDismissed ? 'opacity-60 bg-[#F8FAFC]/70' : 'hover:shadow-sm'
      }`}
    >
      {/* Top Row: Severity Chip top-left & Metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#F1F5F9]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity chip top-left */}
          <RiskBadge tier={warning.severity} size="sm" />

          {/* Monospace project code */}
          <span className="font-mono-code font-normal text-xs px-2 py-0.5 rounded bg-slate-100 text-[#1E293B] border border-slate-200">
            {project.project_code || 'Not available'}
          </span>

          <span className="text-xs text-[#64748B]">
            {project.ministry || 'Not available'} ·{' '}
            <strong className="text-[#1E293B] font-semibold">{project.state || 'Not available'}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <span>Report Cycle: {warning.report_month || 'Current Snapshot'}</span>
          {isDismissed && (
            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-semibold">
              Acknowledged
            </span>
          )}
        </div>
      </div>

      {/* Project Title & Nodal Context */}
      <div className="mt-3">
        <h3
          onClick={() => onSelectProject(project.project_code, 'risk-breakdown')}
          className="text-base font-bold text-[#101A3D] hover:text-[#0F9D8C] cursor-pointer transition-colors"
        >
          {project.name}
        </h3>
        <div className="text-xs text-[#64748B] mt-0.5">
          EPC Contractor:{' '}
          <span className="font-semibold text-[#1E293B]">{project.epc_contractor || 'Not available'}</span> · Delay:{' '}
          <span className="font-semibold text-[#DC2626]">{project.latest_snapshot.delay_months} Months</span>
        </div>
      </div>

      {/* Detected Signals as a bulleted list per spec */}
      <div className="mt-4">
        <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.04em] mb-1.5">
          Detected Signals & Indicators:
        </div>
        <ul className="list-disc pl-5 text-xs sm:text-sm text-[#1E293B] space-y-1">
          {warning.detected_signals && warning.detected_signals.length > 0 ? (
            warning.detected_signals.map((signal, idx) => (
              <li key={idx} className="leading-relaxed">
                {signal}
              </li>
            ))
          ) : (
            <li className="text-[#64748B] italic">No active telemetry breaches recorded</li>
          )}
        </ul>
      </div>

      {/* Bottom Action Row */}
      <div className="mt-5 pt-3 border-t border-[#F1F5F9] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <Building2 className="w-4 h-4 text-[#64748B] stroke-[1.5]" />
          <span>Implementing Agency: {project.nodal_officer || 'MoSPI Monitoring Desk'}</span>
        </div>

        <div className="flex items-center gap-2">
          {onToggleDismiss && (
            <button
              type="button"
              onClick={() => onToggleDismiss(warning.id)}
              className="text-xs font-semibold px-3 py-1.5 rounded border border-[#CBD5E1] text-[#64748B] hover:text-[#1E293B] hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {isDismissed ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>Reopen Alert</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>Acknowledge</span>
                </>
              )}
            </button>
          )}

          {/* Deep-link to Project Details + AI Risk Analysis scrolled to risk breakdown */}
          <button
            type="button"
            onClick={() => onSelectProject(project.project_code, 'risk-breakdown')}
            className="text-xs font-semibold px-3.5 py-1.5 rounded bg-[#0F9D8C] hover:bg-[#0d8778] text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <span>View Project & AI Analysis</span>
            <ChevronRight className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
