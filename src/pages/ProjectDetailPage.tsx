import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Calendar,
  Building2,
  DollarSign,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  Layers,
  MapPin,
  User,
  ShieldAlert,
  FileCheck,
  TrendingUp,
  Activity,
  CheckCircle2,
  Shield,
  LogIn,
  Brain,
  CheckCircle,
  HelpCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { ProjectWithSnapshot, RiskTier, Profile, DailyUpdateRecord } from '../types';
import { RiskBadge } from '../components/RiskBadge';
import {
  formatCurrencyCr,
  formatPercent,
  formatReportFreshness,
  RISK_TIER_CONFIG,
} from '../utils/formatters';
import {
  getProjectDetail,
  ProjectDetailResponse,
  ProjectSnapshotDetail,
  submitDailyProjectUpdate,
  getProjectDailyUpdates,
} from '../services/api';

interface ProjectDetailPageProps {
  project: ProjectWithSnapshot;
  onBack: () => void;
  onSelectProject: (code: string) => void;
  onOpenAiAssistant: () => void;
  isNormalUser?: boolean;
  onOpenLogin?: () => void;
  currentProfile?: Profile | null;
}

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({
  project,
  onBack,
  onSelectProject,
  onOpenAiAssistant,
  isNormalUser = false,
  onOpenLogin,
  currentProfile,
}) => {
  const projectId = project.project_code || (project as any).project_id || '';
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected snapshot month to view
  const [selectedSnapshotMonth, setSelectedSnapshotMonth] = useState<string>('');

  // AI Diagnostic state
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchDetail = async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProjectDetail(projectId);
      setDetail(data);
      if (data.snapshots && data.snapshots.length > 0) {
        setSelectedSnapshotMonth(data.snapshots[data.snapshots.length - 1].report_month);
      }
    } catch (err: any) {
      console.warn('Failed to load project detail from database API, using fallback:', err);
      setError(err?.message || 'Failed to fetch detailed records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [projectId]);

  // Active snapshot corresponding to selectedSnapshotMonth
  const activeSnapshot: ProjectSnapshotDetail | null = useMemo(() => {
    if (!detail?.snapshots || detail.snapshots.length === 0) return null;
    const found = detail.snapshots.find((s) => s.report_month === selectedSnapshotMonth);
    return found || detail.snapshots[detail.snapshots.length - 1];
  }, [detail, selectedSnapshotMonth]);

  // Project Manager authorization detection - strictly assigned canonical project only
  const isProjectManager = currentProfile?.authUser?.role === 'PROJECT_MANAGER' || currentProfile?.role === 'PROJECT_MANAGER';
  const assignedCode = String(currentProfile?.authUser?.assigned_project_code || currentProfile?.authUser?.assigned_project_id || '').trim();
  const isAssignedToThisProject = Boolean(isProjectManager && assignedCode && assignedCode === projectId);

  // Daily field update form states
  const [todayProgress, setTodayProgress] = useState<string>('0');
  const [cumulativeProgress, setCumulativeProgress] = useState<string>('');
  const [todayExpenditure, setTodayExpenditure] = useState<string>('0');
  const [cumulativeExpenditure, setCumulativeExpenditure] = useState<string>('');
  const [currentMilestone, setCurrentMilestone] = useState('');
  const [milestoneStatus, setMilestoneStatus] = useState<'ON_SCHEDULE' | 'DELAYED' | 'COMPLETED'>('ON_SCHEDULE');
  const [targetDate, setTargetDate] = useState('');
  const [issuesRisks, setIssuesRisks] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmittingDailyUpdate, setIsSubmittingDailyUpdate] = useState(false);
  const [dailyUpdateResult, setDailyUpdateResult] = useState<DailyUpdateRecord | null>(null);
  const [dailyUpdateError, setDailyUpdateError] = useState<string | null>(null);
  const [pastUpdates, setPastUpdates] = useState<DailyUpdateRecord[]>([]);

  const loadPastDailyUpdates = async (numId: number) => {
    try {
      const res = await getProjectDailyUpdates(numId);
      setPastUpdates(res.updates || []);
    } catch (err) {
      console.warn('Could not load past daily updates:', err);
    }
  };

  useEffect(() => {
    if (isAssignedToThisProject && currentProfile?.authUser?.assigned_project_id) {
      loadPastDailyUpdates(currentProfile.authUser.assigned_project_id);
    }
  }, [isAssignedToThisProject, currentProfile]);

  const handleDailyUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDailyUpdateError(null);
    setDailyUpdateResult(null);
    setIsSubmittingDailyUpdate(true);

    try {
      const res = await submitDailyProjectUpdate({
        today_physical_progress: parseFloat(todayProgress) || 0,
        cumulative_physical_progress: cumulativeProgress ? parseFloat(cumulativeProgress) : undefined,
        today_expenditure_cr: parseFloat(todayExpenditure) || 0,
        cumulative_expenditure_cr: cumulativeExpenditure ? parseFloat(cumulativeExpenditure) : undefined,
        current_milestone: currentMilestone.trim() || undefined,
        milestone_status: milestoneStatus,
        target_completion_date: targetDate || undefined,
        issues_risks: issuesRisks.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });
      setDailyUpdateResult(res.update);
      fetchDetail();
      if (currentProfile?.authUser?.assigned_project_id) {
        loadPastDailyUpdates(currentProfile.authUser.assigned_project_id);
      }
    } catch (err: any) {
      setDailyUpdateError(err?.message || 'Failed to submit daily field update.');
    } finally {
      setIsSubmittingDailyUpdate(false);
    }
  };

  // Prepare chronological progression trend across the 4 real snapshot months
  const trendData = useMemo(() => {
    if (!detail?.snapshots || detail.snapshots.length === 0) return [];
    return detail.snapshots.map((s) => ({
      month: s.report_month_label || s.report_month,
      original_cost: s.original_cost,
      revised_cost: s.revised_cost,
      expenditure: s.expenditure,
      physical_progress: s.physical_progress ?? 0,
      cost_overrun_pct: s.cost_overrun_pct,
    }));
  }, [detail]);

  const runDeepAiAssessment = async () => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/analyze-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: {
            project_code: detail?.project_id || project.project_code,
            name: detail?.project_name || project.name,
            ministry: detail?.ministry || project.ministry,
            sector: detail?.sector || project.sector,
            state: detail?.state || project.state,
            approved_cost: detail?.financials.original_cost_cr || project.approved_cost,
            latest_snapshot: {
              revised_cost: detail?.financials.revised_cost_cr || project.latest_snapshot.revised_cost,
              physical_progress_pct: detail?.financials.physical_progress_pct || project.latest_snapshot.physical_progress_pct,
              cost_overrun_pct: detail?.financials.cost_overrun_pct || project.latest_snapshot.cost_overrun_pct,
              delay_months: detail?.schedule.delay_months || project.latest_snapshot.delay_months,
            },
          },
        }),
      });
      const data = await response.json();
      setAiAnalysis(data.analysis || 'Analysis generated successfully.');
    } catch (e) {
      setAiAnalysis(
        `### Risk Diagnostic\n\nProject **${detail?.project_name || project.name}** is encountering acute milestone divergence. Physical progress stands at **${detail?.financials.physical_progress_pct ?? 'N/A'}%**. Cost escalation of **+${detail?.financials.cost_overrun_pct || 0}%** requires immediate inter-ministerial review.`
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const pName = detail?.project_name || project.name;
  const pCode = detail?.project_id || project.project_code;
  const pMinistry = detail?.ministry || project.ministry;
  const pSector = detail?.sector || project.sector;
  const pState = detail?.state || project.state;
  const pAgency = detail?.agency || 'N/A';
  const pStatus = detail?.status || 'Ongoing';

  const origCost = detail?.financials.original_cost_cr ?? project.approved_cost;
  const revCost = activeSnapshot?.revised_cost ?? (detail?.financials.revised_cost_cr ?? project.latest_snapshot.revised_cost);
  const overrunAmt = detail?.financials.cost_overrun_amount_cr ?? Math.max(0, revCost - origCost);
  const overrunPct = activeSnapshot?.cost_overrun_pct ?? (detail?.financials.cost_overrun_pct ?? project.latest_snapshot.cost_overrun_pct);
  const expVal = activeSnapshot?.expenditure ?? (detail?.financials.expenditure_cr ?? project.latest_snapshot.expenditure);
  const physProgress = activeSnapshot?.physical_progress ?? (detail?.financials.physical_progress_pct ?? project.latest_snapshot.physical_progress_pct);

  const riskScore = detail?.risk_assessment.score ?? project.latest_snapshot.overall_risk;
  const riskTierRaw = detail?.risk_assessment.level.toLowerCase() || project.latest_snapshot.risk_tier;
  const riskTier: RiskTier = (riskTierRaw === 'critical' || riskTierRaw === 'high' || riskTierRaw === 'medium' || riskTierRaw === 'low') ? riskTierRaw : 'medium';

  const delayMonths = detail?.schedule.delay_months ?? project.latest_snapshot.delay_months;
  const actualCompDate = detail?.actual_completion_date || (project as any).actual_completion_date || 'N/A (Ongoing)';

  // Access Denied Handler for IDOR / Scoped Authorization breaches
  if (error && (error.includes('403') || error.includes('Forbidden') || error.includes('not authorized') || error.includes('Access denied'))) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 animate-in fade-in duration-200">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Authorized Projects</span>
        </button>

        <div className="bg-white rounded-2xl border border-rose-200 shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#101A3D]">Access Denied: Scoped Authorization Enforced</h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mt-2 leading-relaxed">
            Under MoSPI Data Governance Rules, Ministry Officers and Project Managers are strictly restricted to projects within their assigned jurisdiction. You do not have permission to access <strong>{projectId}</strong>.
          </p>
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-rose-700 font-mono max-w-md mx-auto">
            {error}
          </div>
          <div className="mt-6 flex justify-center">
            <button
              onClick={onBack}
              className="px-5 py-2.5 bg-[#101A3D] hover:bg-[#1E2A5E] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Return to Authorized Workspace
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="project-detail-container" className="space-y-6 pb-16">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#1E293B] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-code font-bold text-xs text-[#0F9D8C]">
                {pCode}
              </span>
              <span className="text-slate-300">·</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                  pStatus === 'Completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                {pStatus}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#101A3D] mt-0.5 max-w-2xl leading-tight">
              {pName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isNormalUser && onOpenLogin && (
            <button
              id="btn-login-to-manage-detail"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#101A3D] text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              title="Sign in as an officer or Project Manager to manage this project"
            >
              <LogIn className="w-3.5 h-3.5 text-[#0F9D8C]" />
              <span>Login to Manage</span>
            </button>
          )}

          {!isNormalUser && (
            <button
              onClick={runDeepAiAssessment}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#101A3D] hover:bg-[#1b2b65] text-white text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#0F9D8C]" />
              <span>{isAnalyzing ? 'Analyzing...' : 'Deep Risk Diagnostic'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================== */}
      {/* PROJECT MANAGER FIELD WORKSPACE: DAILY UPDATES             */}
      {/* ========================================================== */}
      {isAssignedToThisProject && (
        <div className="bg-white rounded-2xl border-2 border-[#0F9D8C]/40 p-6 shadow-md space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0F9D8C] text-white flex items-center justify-center shadow-sm">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#101A3D]">
                  Project Manager Field Workspace · Daily Update
                </h3>
                <p className="text-xs text-[#64748B]">
                  Submit daily site execution progress and expenditure. Risk ratings and ML predictions are computed deterministically by the Risk Engine.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Assigned Project Manager
            </span>
          </div>

          {dailyUpdateError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{dailyUpdateError}</span>
            </div>
          )}

          {dailyUpdateResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Daily update persisted to database! Recalculated system metrics:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-slate-500 block text-[10px]">Calculated Overall Risk:</span>
                  <span className="font-bold text-[#101A3D] text-sm">{dailyUpdateResult.recalculated_overall_risk ?? '—'}/100</span>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-slate-500 block text-[10px]">Calculated Risk Tier:</span>
                  <span className="font-bold text-amber-700 text-sm">{dailyUpdateResult.recalculated_risk_tier ?? '—'}</span>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-slate-500 block text-[10px]">Anomaly Score:</span>
                  <span className="font-bold text-[#101A3D] text-sm">{dailyUpdateResult.recalculated_anomaly_score ?? '—'}</span>
                </div>
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-slate-500 block text-[10px]">ML Prediction:</span>
                  <span className="font-bold text-indigo-700 text-xs truncate block">{dailyUpdateResult.recalculated_ml_prediction ?? 'On Track'}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic mt-1">
                Note: Risk score, tier, and anomaly index are computed server-side and are read-only for field managers.
              </p>
            </div>
          )}

          <form onSubmit={handleDailyUpdateSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Today's Physical Progress (%) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                value={todayProgress}
                onChange={(e) => setTodayProgress(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F9D8C]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Cumulative Progress (%) <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={cumulativeProgress}
                onChange={(e) => setCumulativeProgress(e.target.value)}
                placeholder="Current cumulative %"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F9D8C]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Today's Expenditure (Rs. Cr) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={todayExpenditure}
                onChange={(e) => setTodayExpenditure(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F9D8C]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Cumulative Expenditure (Rs. Cr) <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cumulativeExpenditure}
                onChange={(e) => setCumulativeExpenditure(e.target.value)}
                placeholder="Total outlay so far"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F9D8C]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Current Milestone Name
              </label>
              <input
                type="text"
                value={currentMilestone}
                onChange={(e) => setCurrentMilestone(e.target.value)}
                placeholder="e.g. Pier Cap Erection - Km 42"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F9D8C]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Milestone Execution Status
              </label>
              <select
                value={milestoneStatus}
                onChange={(e: any) => setMilestoneStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F9D8C] bg-white"
              >
                <option value="ON_SCHEDULE">ON_SCHEDULE</option>
                <option value="DELAYED">DELAYED</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Target Completion Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F9D8C] bg-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Site Bottlenecks, Clearances, or Issues
              </label>
              <input
                type="text"
                value={issuesRisks}
                onChange={(e) => setIssuesRisks(e.target.value)}
                placeholder="e.g. Delayed tree felling permission from forest division"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F9D8C]"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-700 mb-1">
                Field Officer Remarks & Mitigation Strategy
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Additional operational context, contractor mobilization notes, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F9D8C]"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingDailyUpdate}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#0F9D8C] hover:bg-[#0d8778] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmittingDailyUpdate ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileCheck className="w-4 h-4" />
                )}
                <span>Submit Daily Field Update</span>
              </button>
            </div>
          </form>

          {/* Past Daily Updates History */}
          {pastUpdates.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <h4 className="font-bold text-xs text-slate-800 mb-2">Recent Field Submissions for this Project</h4>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                      <th className="py-2 px-2.5">Date</th>
                      <th className="py-2 px-2.5">Today Progress</th>
                      <th className="py-2 px-2.5">Cumulative Progress</th>
                      <th className="py-2 px-2.5">Expenditure</th>
                      <th className="py-2 px-2.5">Milestone</th>
                      <th className="py-2 px-2.5">Recalculated Risk</th>
                      <th className="py-2 px-2.5">Tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pastUpdates.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50 text-[11px]">
                        <td className="py-2 px-2.5 font-mono">{u.update_date}</td>
                        <td className="py-2 px-2.5">{u.today_physical_progress}%</td>
                        <td className="py-2 px-2.5 font-semibold">{u.cumulative_physical_progress}%</td>
                        <td className="py-2 px-2.5">Rs. {u.today_expenditure_cr} Cr</td>
                        <td className="py-2 px-2.5">{u.current_milestone || '—'} ({u.milestone_status || '—'})</td>
                        <td className="py-2 px-2.5 font-bold text-[#101A3D]">{u.recalculated_overall_risk ?? '—'}</td>
                        <td className="py-2 px-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100">
                            {u.recalculated_risk_tier || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="p-4 bg-white rounded-lg border border-[#E2E8F0] flex items-center justify-center gap-2 text-xs text-[#64748B]">
          <Loader2 className="w-4 h-4 animate-spin text-[#0F9D8C]" />
          <span>Loading verified InfraNetra records...</span>
        </div>
      )}

      {/* Snapshot Cycle Switcher */}
      {detail?.snapshots && detail.snapshots.length > 0 && (
        <div className="bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0F9D8C]" />
            <span className="text-xs font-semibold text-[#101A3D]">Flash Report Snapshots:</span>
            <span className="text-xs text-[#64748B]">Select reporting cycle to inspect historical progression</span>
          </div>

          <div className="flex gap-1">
            {detail.snapshots.map((s) => {
              const isSel = selectedSnapshotMonth === s.report_month;
              return (
                <button
                  key={s.report_month}
                  onClick={() => setSelectedSnapshotMonth(s.report_month)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    isSel
                      ? 'bg-[#101A3D] text-white font-semibold shadow-xs'
                      : 'bg-[#F8FAFC] text-[#475569] hover:bg-slate-200 border border-[#CBD5E1]'
                  }`}
                >
                  {s.report_month_label || s.report_month}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Project Meta Information Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Core Attribution */}
        <div className="bg-white rounded-lg p-5 border border-[#E2E8F0] shadow-xs">
          <div className="text-[11px] uppercase font-semibold text-[#64748B] tracking-[0.04em]">
            Ministry & Implementing Agency
          </div>
          <div className="mt-2 text-sm font-bold text-[#101A3D] truncate" title={pMinistry}>
            {pMinistry}
          </div>
          <div className="text-xs text-[#64748B] mt-1 truncate" title={pAgency}>
            Agency: <span className="font-medium text-[#1E293B]">{pAgency}</span>
          </div>
          <div className="mt-2 text-xs text-[#475569]">
            Sector: <span className="font-semibold text-[#0F9D8C]">{pSector}</span> · {pState}
          </div>
        </div>

        {/* Financial Overview */}
        <div className="bg-white rounded-lg p-5 border border-[#E2E8F0] shadow-xs">
          <div className="text-[11px] uppercase font-semibold text-[#64748B] tracking-[0.04em]">
            Capital Outlay & Overrun
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-tabular text-[#101A3D]">
              {formatCurrencyCr(revCost)}
            </span>
            {overrunPct > 0 && (
              <span className="text-xs font-semibold text-[#DC2626]">
                +{overrunPct}%
              </span>
            )}
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            Original Approved: <span className="font-medium">{formatCurrencyCr(origCost)}</span>
          </div>
          <div className="mt-2 text-xs">
            {overrunAmt > 0 ? (
              <span className="text-[#DC2626] bg-[#DC2626]/10 px-2 py-0.5 rounded font-semibold">
                +Rs. {overrunAmt.toFixed(2)} Cr Escalation
              </span>
            ) : (
              <span className="text-[#16A34A] bg-[#16A34A]/10 px-2 py-0.5 rounded font-semibold">
                Within Sanctioned Budget
              </span>
            )}
          </div>
        </div>

        {/* Physical Progress & Expenditure */}
        <div className="bg-white rounded-lg p-5 border border-[#E2E8F0] shadow-xs">
          <div className="text-[11px] uppercase font-semibold text-[#64748B] tracking-[0.04em]">
            Execution & Expenditure
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-tabular text-[#101A3D]">
              {physProgress !== null ? `${physProgress}%` : 'N/A'}
            </span>
            <span className="text-xs text-[#64748B]">physical completion</span>
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            Expenditure: <span className="font-semibold text-[#101A3D]">{formatCurrencyCr(expVal)}</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-[#0F9D8C] h-full rounded-full transition-all"
              style={{ width: `${Math.min(physProgress || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Schedule & Table 3 Completion Date */}
        <div className="bg-white rounded-lg p-5 border border-[#E2E8F0] shadow-xs">
          <div className="text-[11px] uppercase font-semibold text-[#64748B] tracking-[0.04em]">
            Schedule & Completion Timeline
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-tabular ${delayMonths > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
              {delayMonths > 0 ? `+${delayMonths} Months` : 'On Schedule'}
            </span>
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            Target Completion: <span className="font-medium text-[#101A3D]">{detail?.revised_completion_date || 'N/A'}</span>
          </div>
          <div className="mt-2 text-xs text-[#475569]">
            Actual Completion:{' '}
            <span className="font-semibold text-[#101A3D]">
              {actualCompDate}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* RISK ANALYSIS & PREDICTIVE INTELLIGENCE                    */}
      {/* Strictly accessible only to logged-in users (Admin, PM,    */}
      {/* Ministry). Completely hidden when not logged in.           */}
      {/* ========================================================== */}
      {!isNormalUser && (
        <>
          {/* AI Risk Assessment Card (if generated) */}
          {aiAnalysis && (
            <div className="bg-white rounded-lg p-5 border border-[#0F9D8C] shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-[#0F9D8C]">
                <Sparkles className="w-4 h-4" />
                <h3 className="font-bold text-sm text-[#101A3D]">
                  AI Executive Risk Diagnostic
                </h3>
              </div>
              <div className="text-xs text-[#334155] leading-relaxed whitespace-pre-line bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0] font-sans">
                {aiAnalysis}
              </div>
            </div>
          )}

          {/* 4-Factor Risk Engine Breakdown */}
          <div className="bg-white rounded-lg p-6 border border-[#E2E8F0] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase font-semibold tracking-[0.04em] text-[#64748B]">
                    Deterministic Multi-Factor Scoring
                  </span>
                  <RiskBadge tier={riskTier} score={riskScore} size="sm" />
                </div>
                <h2 className="text-base font-bold text-[#101A3D] mt-0.5">
                  4-Factor Risk Breakdown (Score: {riskScore}/100 · {riskTier.toUpperCase()})
                </h2>
              </div>
              <div className="text-xs text-[#64748B]">
                Calculated dynamically from Flash Report snapshot data
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* Cost Overrun Score */}
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1E293B]">Cost Overrun Factor</span>
                  <span className="font-mono-code font-bold text-xs text-[#DC2626]">
                    {detail?.risk_assessment.components.cost_overrun_score ?? 0}/30 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[#DC2626] h-full rounded-full"
                    style={{
                      width: `${((detail?.risk_assessment.components.cost_overrun_score ?? 0) / 30) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-[#64748B] mt-2 leading-relaxed">
                  Overrun rate: {overrunPct}% ({overrunAmt > 0 ? `+Rs. ${overrunAmt.toFixed(2)} Cr` : 'zero overrun'})
                </p>
              </div>

              {/* Schedule Extension Score */}
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1E293B]">Schedule Delay Factor</span>
                  <span className="font-mono-code font-bold text-xs text-[#EA580C]">
                    {detail?.risk_assessment.components.schedule_extension_score ?? 0}/30 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[#EA580C] h-full rounded-full"
                    style={{
                      width: `${((detail?.risk_assessment.components.schedule_extension_score ?? 0) / 30) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-[#64748B] mt-2 leading-relaxed">
                  Anticipated delay: {delayMonths} months past original target date.
                </p>
              </div>

              {/* Progress Velocity Score */}
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1E293B]">Progress Velocity</span>
                  <span className="font-mono-code font-bold text-xs text-[#D97706]">
                    {detail?.risk_assessment.components.progress_velocity_score ?? 0}/25 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[#D97706] h-full rounded-full"
                    style={{
                      width: `${((detail?.risk_assessment.components.progress_velocity_score ?? 0) / 25) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-[#64748B] mt-2 leading-relaxed">
                  Monthly progress delta: {detail?.schedule.progress_delta !== null && detail?.schedule.progress_delta !== undefined ? `${detail.schedule.progress_delta}%` : 'Baseline period'}
                </p>
              </div>

              {/* Capital Scale Score */}
              <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#1E293B]">Capital Exposure</span>
                  <span className="font-mono-code font-bold text-xs text-[#2563EB]">
                    {detail?.risk_assessment.components.capital_exposure_score ?? 0}/15 pts
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[#2563EB] h-full rounded-full"
                    style={{
                      width: `${((detail?.risk_assessment.components.capital_exposure_score ?? 0) / 15) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-[#64748B] mt-2 leading-relaxed">
                  Total financial exposure scale: Rs. {revCost.toFixed(2)} Cr.
                </p>
              </div>
            </div>
          </div>

          {/* Machine Learning Overrun & Delay Prediction Panel */}
          {detail?.ml_predictions && (
            <div className="bg-white rounded-lg p-6 border border-[#E2E8F0] shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#0F9D8C]" />
                  <h2 className="text-base font-bold text-[#101A3D]">
                    Machine Learning Baseline Forecasts
                  </h2>
                </div>
                <span className="text-xs text-[#64748B]">
                  Trained strictly on MoSPI PAIMANA Flash Report Data
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                  <span className="text-xs text-[#64748B] font-medium">Predicted Cost Overrun</span>
                  <div className="text-xl font-bold text-[#DC2626] mt-1">
                    +{detail.ml_predictions.predicted_cost_overrun_pct}%
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Estimated escalation: +Rs. {detail.ml_predictions.predicted_escalation_amount_cr} Cr
                  </p>
                </div>

                <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                  <span className="text-xs text-[#64748B] font-medium">Predicted Schedule Delay</span>
                  <div className="text-xl font-bold text-[#EA580C] mt-1">
                    +{detail.ml_predictions.predicted_delay_months} Months
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    Trained exclusively on confirmed 45 Table 3 completed project records
                  </p>
                </div>

                <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                  <span className="text-xs text-[#64748B] font-medium">Key Risk Drivers</span>
                  <ul className="text-[11px] text-[#334155] mt-1 space-y-0.5 list-disc list-inside">
                    {detail.ml_predictions.key_risk_drivers.map((d, i) => (
                      <li key={i} className="truncate" title={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Live Schedule Risk Analysis Card */}
          {detail?.live_schedule_risk && (
            <div className="bg-white rounded-lg p-6 border border-[#E2E8F0] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase font-semibold tracking-[0.04em] text-sky-700">
                      Date-Based Runtime Intelligence
                    </span>
                    <RiskBadge
                      tier={
                        detail.live_schedule_risk.schedule_risk_level === 'CRITICAL'
                          ? 'critical'
                          : detail.live_schedule_risk.schedule_risk_level === 'HIGH'
                          ? 'high'
                          : detail.live_schedule_risk.schedule_risk_level === 'MODERATE'
                          ? 'medium'
                          : 'low'
                      }
                      score={Math.round(detail.live_schedule_risk.schedule_risk_score)}
                      size="sm"
                    />
                  </div>
                  <h2 className="text-base font-bold text-[#101A3D] mt-0.5 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-600" />
                    Live Schedule Risk Analysis (Score: {detail.live_schedule_risk.schedule_risk_score}/100 · {detail.live_schedule_risk.schedule_risk_level})
                  </h2>
                </div>
                <div className="text-xs text-[#64748B] sm:text-right">
                  Runtime heuristic grounded in project dates & progress
                </div>
              </div>

              {!detail.live_schedule_risk.schedule_analysis_available ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Schedule Analysis Unavailable
                  </div>
                  <p>{detail.live_schedule_risk.unavailability_reason || 'Required milestone dates are missing from project records.'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                    {/* Time-Elapsed Baseline vs Progress */}
                    <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                      <span className="text-xs font-semibold text-[#1E293B]">Progress Execution Gap</span>
                      <div className="pt-1">
                        <div className="text-xs text-[#64748B]">
                          Time-Elapsed Baseline: <span className="font-bold text-[#1E293B] font-mono-code">{detail.live_schedule_risk.time_elapsed_baseline_percentage ?? detail.live_schedule_risk.elapsed_percentage}%</span>
                        </div>
                        <div className="text-xs text-[#64748B] mt-0.5">
                          Physical Progress: <span className="font-bold text-[#1E293B] font-mono-code">{detail.live_schedule_risk.physical_progress_percentage !== null ? `${detail.live_schedule_risk.physical_progress_percentage}%` : 'Unrecorded'}</span>
                        </div>
                        <div className="text-xs font-semibold mt-1 text-[#DC2626]">
                          Time-vs-Physical Progress Gap: <span className="font-mono-code">{detail.live_schedule_risk.progress_gap !== null ? `${detail.live_schedule_risk.progress_gap > 0 ? '+' : ''}${detail.live_schedule_risk.progress_gap} pp` : 'N/A'}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#94A3B8] leading-tight pt-1">
                        Calendar time elapsed does not imply equal physical construction progress.
                      </p>
                    </div>

                    {/* Active Deadline & Countdown */}
                    <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                      <span className="text-xs font-semibold text-[#1E293B]">Active Deadline Tracking</span>
                      <div className="pt-1">
                        <div className="text-xs text-[#64748B]">
                          Active Target: <span className="font-bold text-[#1E293B] font-mono-code">{detail.live_schedule_risk.active_deadline || 'N/A'}</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">
                          Type: <span className="font-medium text-[#1E293B]">{detail.live_schedule_risk.active_deadline_type} Deadline</span>
                        </div>
                        <div className={`text-xs font-bold mt-1 ${detail.live_schedule_risk.days_to_active_deadline !== null && detail.live_schedule_risk.days_to_active_deadline < 0 ? 'text-[#DC2626]' : 'text-emerald-700'}`}>
                          {detail.live_schedule_risk.days_to_active_deadline !== null
                            ? detail.live_schedule_risk.days_to_active_deadline >= 0
                              ? `${detail.live_schedule_risk.days_to_active_deadline} days remaining`
                              : `${Math.abs(detail.live_schedule_risk.days_to_active_deadline)} days overdue`
                            : 'N/A'}
                        </div>
                      </div>
                      <p className="text-[10px] text-[#94A3B8] leading-tight pt-1">
                        Status: {detail.live_schedule_risk.deadline_display_status || detail.live_schedule_risk.original_deadline_status}
                      </p>
                    </div>

                    {/* Project Milestone Dates */}
                    <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                      <span className="text-xs font-semibold text-[#1E293B]">Contractual Timeline</span>
                      <div className="text-xs text-[#64748B] space-y-0.5 pt-1">
                        <div>Start Date: <span className="font-mono-code text-[#1E293B]">{detail.live_schedule_risk.start_date || 'N/A'}</span></div>
                        <div>Original Target: <span className="font-mono-code text-[#1E293B]">{detail.live_schedule_risk.original_completion_date || 'N/A'}</span></div>
                        <div>Revised Target: <span className="font-mono-code text-[#1E293B]">{detail.live_schedule_risk.revised_completion_date || 'None'}</span></div>
                        {detail.live_schedule_risk.actual_completion_date && (
                          <div>Actual Done: <span className="font-mono-code text-emerald-700">{detail.live_schedule_risk.actual_completion_date}</span></div>
                        )}
                      </div>
                      <p className="text-[10px] text-[#94A3B8] leading-tight pt-1">
                        Planned duration: {detail.live_schedule_risk.planned_duration_days || 0} days
                      </p>
                    </div>

                    {/* Schedule Extension Status */}
                    <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                      <span className="text-xs font-semibold text-[#1E293B]">Extension Analysis</span>
                      <div className="text-xs pt-1">
                        <div className="font-medium text-[#1E293B]">
                          {detail.live_schedule_risk.extension_label || 'No schedule extension'}
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-1">
                          Original status: <span className="font-medium">{detail.live_schedule_risk.original_deadline_status.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">
                          Revised status: <span className="font-medium">{detail.live_schedule_risk.revised_deadline_status.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#94A3B8] leading-tight pt-1">
                        {detail.live_schedule_risk.is_completed ? 'Escalation frozen (Completed)' : 'Active monitoring'}
                      </p>
                    </div>
                  </div>

                  {/* Grounded Explanations */}
                  <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg space-y-2">
                    <span className="text-xs text-[#64748B] font-semibold uppercase tracking-wider">
                      Schedule Analysis Factors & Explanations
                    </span>
                    <ul className="text-xs text-[#334155] space-y-1 list-disc list-inside leading-relaxed">
                      {detail.live_schedule_risk.schedule_risk_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Heuristic Disclaimer */}
                  <div className="text-[11px] text-[#64748B] italic border-t border-[#F1F5F9] pt-2">
                    {detail.live_schedule_risk.disclaimer || 'InfraNetra runtime schedule-risk heuristic; not an official PAIMANA methodology.'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data-Grounded Early Warnings */}
          {detail?.early_warnings && detail.early_warnings.length > 0 && (
            <div className="bg-white rounded-lg p-6 border border-[#E2E8F0] shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-base font-bold text-[#101A3D]">
                  Data-Grounded Early Warning Signals ({detail.early_warnings.length})
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {detail.early_warnings.map((w) => (
                  <div
                    key={w.id}
                    className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/40 flex items-start gap-3"
                  >
                    <div
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 ${
                        w.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {w.severity}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-[#101A3D]">{w.title}</div>
                      <div className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                        {w.description}
                      </div>
                      <div className="text-[10px] font-mono-code font-semibold text-[#0F9D8C] mt-1">
                        Metric breach: {w.metric} · {w.report_month}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Real 4-Month Historical Progression Chart */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-lg p-6 border border-[#E2E8F0] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#101A3D]">
              Historical Flash Report Progression
            </h2>
            <span className="text-xs text-[#64748B]">
              {trendData[0]?.month}{trendData.length > 1 ? ` → ${trendData[trendData.length - 1]?.month}` : ''}
            </span>
          </div>

          <div className="w-full h-64 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#101A3D] text-white p-3 rounded-lg shadow-xl text-xs space-y-1">
                          <div className="font-bold">{label}</div>
                          {payload.map((item: any, idx: number) => (
                            <div key={idx} style={{ color: item.color }}>
                              {item.name}: {item.value}
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="physical_progress"
                  name="Physical Progress (%)"
                  stroke="#0F9D8C"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="cost_overrun_pct"
                  name="Cost Overrun (%)"
                  stroke="#DC2626"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
