import React, { useMemo } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { ProjectWithSnapshot } from '../types';
import { RiskBadge } from './RiskBadge';
import { formatCurrencyCr, formatPercent, formatReportFreshness } from '../utils/formatters';
import { TopProjectItem } from '../services/api';

interface TopRiskProjectsTableProps {
  projects?: ProjectWithSnapshot[];
  dbProjects?: TopProjectItem[];
  onSelectProject: (projectCode: string) => void;
  onViewAllProjects: () => void;
}

export const TopRiskProjectsTable: React.FC<TopRiskProjectsTableProps> = ({
  projects = [],
  dbProjects,
  onSelectProject,
  onViewAllProjects,
}) => {
  // If dbProjects is provided from API, use it directly
  const useDb = Boolean(dbProjects && dbProjects.length > 0);
  const sortedProjects = useMemo(() => {
    if (useDb && dbProjects) {
      return dbProjects.slice(0, 5);
    }
    return [...projects]
      .sort((a, b) => b.latest_snapshot.overall_risk - a.latest_snapshot.overall_risk)
      .slice(0, 5);
  }, [useDb, dbProjects, projects]);

  return (
    <div id="top-high-risk-projects-card" className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
        <div>
          <h3 className="font-bold text-sm text-[#1E293B] flex items-center gap-2">
            <span>Top High-Risk Projects Requiring Intervention</span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#DC2626]/10 text-[#DC2626]">
              Action Priority
            </span>
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5">
            Ranked by composite risk index (Schedule delay, cost escalation & statutory bottlenecks)
          </p>
        </div>
        <button
          onClick={onViewAllProjects}
          className="text-xs font-semibold text-[#0F9D8C] hover:text-[#0d8778] flex items-center gap-1 self-start sm:self-auto hover:underline"
        >
          <span>View All Monitored Projects</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[#1E293B] border-collapse">
          <thead className="bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.04em] border-b border-[#CBD5E1]">
            <tr>
              <th className="py-3 px-4 border-r border-[#CBD5E1]">Project Code</th>
              <th className="py-3 px-4 border-r border-[#CBD5E1]">Project Name & Ministry</th>
              <th className="py-3 px-4 text-right border-r border-[#CBD5E1]">Approved Cost</th>
              <th className="py-3 px-4 text-right border-r border-[#CBD5E1]">Revised Cost</th>
              <th className="py-3 px-4 text-center border-r border-[#CBD5E1]">Progress (Act/Exp)</th>
              <th className="py-3 px-4 text-center border-r border-[#CBD5E1]">Overall Risk</th>
              <th className="py-3 px-4 text-right border-r border-[#CBD5E1]">Freshness</th>
              <th className="py-3 px-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-[#64748B]">
                  No snapshot selected. Select a month above to load project risk data.
                </td>
              </tr>
            ) : (
              sortedProjects.map((item: any, index) => {
              const pCode = item.project_id || item.project_code || 'PROJ';
              const pName = item.project_name || item.name || 'Unnamed Project';
              const pMinistry = item.ministry || item.sector || 'Central Sector';
              const pState = item.state || 'National';
              const pApproved = item.original_cost ?? item.approved_cost ?? 0;
              const pRevised = item.revised_cost ?? item.latest_snapshot?.revised_cost ?? pApproved;
              const pOverrunPct = item.cost_overrun_pct ?? item.latest_snapshot?.cost_overrun_pct ?? 0;
              const pProgress = item.physical_progress ?? item.latest_snapshot?.physical_progress_pct ?? 0;
              const pRiskScore = item.risk_score ?? item.latest_snapshot?.overall_risk ?? 0;
              const rawTier = String(item.risk_level || item.latest_snapshot?.risk_tier || 'medium').toLowerCase();
              const pRiskTier = (rawTier === 'critical' || rawTier === 'high' || rawTier === 'medium' || rawTier === 'low') ? rawTier : 'medium';
              const isZebra = index % 2 === 1;

              return (
                <tr
                  key={pCode}
                  onClick={() => onSelectProject(pCode)}
                  className={`border-b border-[#E2E8F0] last:border-b-0 hover:bg-[#E6F6F4]/50 cursor-pointer transition-colors ${
                    isZebra ? 'bg-[#F8FAFC]/60' : 'bg-white'
                  }`}
                >
                  {/* Monospace Project Code */}
                  <td className="py-3.5 px-4 font-mono-code font-bold text-xs text-[#101A3D] whitespace-nowrap border-r border-[#E2E8F0]">
                    {pCode}
                  </td>

                  {/* Project Name & Ministry */}
                  <td className="py-3.5 px-4 max-w-[280px] border-r border-[#E2E8F0]">
                    <div className="font-semibold text-[#1E293B] truncate hover:text-[#0F9D8C]" title={pName}>
                      {pName}
                    </div>
                    <div className="text-[11px] text-[#64748B] truncate mt-0.5">
                      {pMinistry} · <span className="font-medium">{pState}</span>
                    </div>
                  </td>

                  {/* Approved Cost */}
                  <td className="py-3.5 px-4 text-right font-tabular text-[#64748B] whitespace-nowrap border-r border-[#E2E8F0]">
                    {formatCurrencyCr(pApproved)}
                  </td>

                  {/* Revised Cost */}
                  <td className="py-3.5 px-4 text-right font-tabular font-bold text-[#1E293B] whitespace-nowrap border-r border-[#E2E8F0]">
                    {formatCurrencyCr(pRevised)}
                    {pOverrunPct > 0 && (
                      <span className="block text-[10px] text-[#DC2626] font-normal">
                        +{pOverrunPct}% overrun
                      </span>
                    )}
                  </td>

                  {/* Progress Act / Exp */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap border-r border-[#E2E8F0]">
                    <div className="inline-flex items-center gap-1 font-semibold text-xs">
                      <span className="text-[#101A3D]">{formatPercent(pProgress)}</span>
                    </div>
                    <div className="w-20 bg-slate-200 h-1.5 rounded-full mx-auto mt-1 overflow-hidden">
                      <div
                        className="bg-[#0F9D8C] h-full rounded-full"
                        style={{ width: `${Math.min(pProgress, 100)}%` }}
                      />
                    </div>
                  </td>

                  {/* Overall Risk Column with dedicated pill */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap border-r border-[#E2E8F0]">
                    <RiskBadge tier={pRiskTier as any} score={pRiskScore} size="sm" />
                  </td>

                  {/* Freshness */}
                  <td className="py-3.5 px-4 text-right text-[11px] text-[#64748B] whitespace-nowrap border-r border-[#E2E8F0]">
                    Verified Ingest
                  </td>

                  {/* Drill-down link */}
                  <td className="py-3.5 px-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(pCode);
                      }}
                      className="p-1 rounded hover:bg-slate-200 text-[#0F9D8C] transition-colors"
                      title="Drill down to Project Risk Details"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
