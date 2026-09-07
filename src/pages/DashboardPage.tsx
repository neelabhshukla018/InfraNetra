import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Building2,
  DollarSign,
  Layers,
  Clock,
  Calendar,
  CheckCircle2,
  Filter,
  ArrowUpRight,
  ShieldAlert,
  LogIn,
  UserPlus,
  Loader2,
  RefreshCw,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';
import { ProjectWithSnapshot, RiskTier } from '../types';
import { KpiCard } from '../components/KpiCard';
import { RiskDonutChart } from '../components/RiskDonutChart';
import { ProgressDonutChart } from '../components/ProgressDonutChart';
import { SectorDistributionChart } from '../components/SectorDistributionChart';
import { TopRiskProjectsTable } from '../components/TopRiskProjectsTable';
import { formatCurrencyCr } from '../utils/formatters';
import {
  getDashboardSummary,
  DashboardSummaryData,
  getAvailableMonths,
  AvailableMonthItem,
} from '../services/api';

interface DashboardPageProps {
  projects: ProjectWithSnapshot[];
  onSelectProject: (projectCode: string) => void;
  onNavigateProjects: (tierFilter?: string) => void;
  onNavigateWarnings: () => void;
  onNavigateMap?: () => void;
  onOpenUpload: () => void;
  isNormalUser?: boolean;
  onOpenLogin?: () => void;
  onOpenRegister?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  projects,
  onSelectProject,
  onNavigateProjects,
  onNavigateWarnings,
  onNavigateMap,
  onOpenUpload,
  isNormalUser = false,
  onOpenLogin,
  onOpenRegister,
}) => {
  const [availableMonths, setAvailableMonths] = useState<AvailableMonthItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDonutTier, setSelectedDonutTier] = useState<RiskTier | null>(null);
  const [summaryData, setSummaryData] = useState<DashboardSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isCalendarOpen]);

  const fetchMonths = async () => {
    try {
      const months = await getAvailableMonths();
      if (months && months.length > 0) {
        setAvailableMonths(months);
        setSelectedMonth((prev) => (prev ? prev : months[0].report_month));
      }
    } catch (err) {
      console.warn('Failed to load available months:', err);
    }
  };

  const fetchDashboard = async (month?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDashboardSummary(month || undefined);
      setSummaryData(data);
      if (data.report_month && !selectedMonth) {
        setSelectedMonth(data.report_month);
      }
      if (data.available_months && data.available_months.length > 0) {
        setAvailableMonths((prev) => {
          if (prev.length === 0) {
            return data.available_months.map((m: any) => ({
              report_month: m.report_month,
              label: m.label,
              project_count: m.project_count ?? m.record_count ?? 0,
            }));
          }
          return prev;
        });
      }
    } catch (err: any) {
      console.error('Failed to load dashboard summary:', err);
      setError(err?.message || 'Failed to connect to backend database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonths();
    fetchDashboard();
    const handleUpdated = () => {
      fetchMonths();
      fetchDashboard(selectedMonth || undefined);
    };
    window.addEventListener('infranetra:month-updated', handleUpdated);
    return () => window.removeEventListener('infranetra:month-updated', handleUpdated);
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      fetchDashboard(selectedMonth);
    }
  }, [selectedMonth]);

  const isMonthSelected = Boolean(selectedMonth && summaryData);

  const metrics = isMonthSelected ? (summaryData?.metrics || {
    total_monitored_projects: 0,
    total_original_cost_cr: 0,
    total_revised_cost_cr: 0,
    total_cost_overrun_cr: 0,
    cost_overrun_pct: 0,
    projects_with_cost_overrun: 0,
    total_expenditure_cr: 0,
    expenditure_pct_of_revised: 0,
    projects_with_time_overrun: 0,
    projects_ongoing: 0,
    projects_completed: 0,
  }) : null;

  const riskDistribution = isMonthSelected ? (summaryData?.risk_distribution || {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  }) : {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  const totalProjects = metrics?.total_monitored_projects ?? 0;
  const highAndCritical = riskDistribution.CRITICAL + riskDistribution.HIGH;

  return (
    <div id="dashboard-page-container" className="space-y-6 pb-12">
      {/* Top Banner / Month Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[#0F9D8C]">
              MoSPI PAIMANA Flash Report Database · {availableMonths.length > 0 ? `${availableMonths.length} Verified Snapshots` : 'Verified Snapshots'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#101A3D] mt-1 tracking-tight">
            National Infrastructure Risk Intelligence Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Central Sector infrastructure projects costing Rs. 150 Crore & above.
          </p>
        </div>

        {/* Snapshot Month Selector Dropdown with Runnable Calendar */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="relative" ref={calendarRef}>
            <button
              id="btn-open-calendar-picker"
              type="button"
              onClick={() => setIsCalendarOpen((prev) => !prev)}
              aria-label="Open Calendar to select snapshot month"
              aria-expanded={isCalendarOpen}
              className="flex items-center gap-2 bg-[#F8FAFC] hover:bg-slate-100 border border-[#CBD5E1] hover:border-[#0F9D8C] px-3 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0F9D8C]/30"
              title="Click to open calendar and select snapshot month"
            >
              <Calendar className="w-4 h-4 text-[#0F9D8C] shrink-0" />
              <span className="text-xs font-bold text-[#101A3D]">
                {availableMonths.find((m) => m.report_month === selectedMonth)?.label || (selectedMonth ? selectedMonth : 'Select Month')}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isCalendarOpen ? 'rotate-180 text-[#0F9D8C]' : ''}`} />
            </button>

            {/* Interactive Calendar Month Picker Popover */}
            {isCalendarOpen && (
              <div
                id="calendar-month-picker-popover"
                className="absolute right-0 top-full mt-2 z-50 w-72 sm:w-80 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200/60 flex items-center justify-center text-[#0F9D8C]">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#101A3D] leading-tight">
                        Select Snapshot Month
                      </h4>
                      <p className="text-[10px] text-[#64748B] leading-tight">
                        2026 PAIMANA Flash Reports
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Close calendar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Calendar Months Grid (12 Months of 2026) */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { month: '01', name: 'Jan', label: 'January 2026', key: '2026-01-01' },
                    { month: '02', name: 'Feb', label: 'February 2026', key: '2026-02-01' },
                    { month: '03', name: 'Mar', label: 'March 2026', key: '2026-03-01' },
                    { month: '04', name: 'Apr', label: 'April 2026', key: '2026-04-01' },
                    { month: '05', name: 'May', label: 'May 2026', key: '2026-05-01' },
                    { month: '06', name: 'Jun', label: 'June 2026', key: '2026-06-01' },
                    { month: '07', name: 'Jul', label: 'July 2026', key: '2026-07-01' },
                    { month: '08', name: 'Aug', label: 'August 2026', key: '2026-08-01' },
                    { month: '09', name: 'Sep', label: 'September 2026', key: '2026-09-01' },
                    { month: '10', name: 'Oct', label: 'October 2026', key: '2026-10-01' },
                    { month: '11', name: 'Nov', label: 'November 2026', key: '2026-11-01' },
                    { month: '12', name: 'Dec', label: 'December 2026', key: '2026-12-01' },
                  ].map((m) => {
                    const availableItem = availableMonths.find(
                      (item) => item.report_month === m.key || item.label.toLowerCase().startsWith(m.name.toLowerCase())
                    );
                    const isAvailable = Boolean(availableItem);
                    const isSelected = selectedMonth === (availableItem ? availableItem.report_month : m.key);
                    const count = availableItem?.project_count ?? availableItem?.record_count;

                    return (
                      <button
                        key={m.key}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => {
                          if (isAvailable && availableItem) {
                            setSelectedMonth(availableItem.report_month);
                            setIsCalendarOpen(false);
                          }
                        }}
                        className={`p-2.5 rounded-lg text-center transition-all flex flex-col items-center justify-center relative cursor-pointer ${
                          isSelected
                            ? 'bg-[#0F9D8C] text-white font-bold shadow-sm ring-2 ring-[#0F9D8C]/40'
                            : isAvailable
                            ? 'bg-slate-50 hover:bg-teal-50/70 border border-slate-200 hover:border-[#0F9D8C]/50 text-slate-800'
                            : 'bg-slate-50/40 text-slate-300 border border-slate-100 cursor-not-allowed opacity-50'
                        }`}
                        title={
                          isAvailable
                            ? `${availableItem?.label} (${count?.toLocaleString()} projects)`
                            : `${m.label} (Not yet ingested)`
                        }
                      >
                        <span className="text-xs font-bold">{m.name}</span>
                        <span className="text-[10px] opacity-75 font-mono">2026</span>
                        {isAvailable && (
                          <span
                            className={`mt-1 text-[9px] px-1 py-0.2 rounded font-semibold ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {count ? `${count}` : 'Active'}
                          </span>
                        )}
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-[#0F9D8C] flex items-center justify-center shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonth('');
                      setSummaryData(null);
                      setIsCalendarOpen(false);
                    }}
                    className="text-slate-500 hover:text-rose-600 transition-colors font-medium cursor-pointer"
                  >
                    Clear Filter
                  </button>
                  {availableMonths.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMonth(availableMonths[0].report_month);
                        setIsCalendarOpen(false);
                      }}
                      className="text-[#0F9D8C] hover:text-[#0d8778] font-bold transition-colors cursor-pointer"
                    >
                      Latest: {availableMonths[0].label}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              fetchMonths();
              fetchDashboard(selectedMonth || undefined);
            }}
            className="p-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#64748B] transition-colors cursor-pointer"
            title="Refresh current snapshot"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#0F9D8C]' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => {
              fetchDashboard(selectedMonth || undefined);
            }}
            className="font-semibold underline text-amber-900 ml-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          id="kpi-total-projects"
          label="Total Monitored Projects"
          value={isMonthSelected ? totalProjects.toLocaleString() : '—'}
          subValue={isMonthSelected ? (summaryData?.report_month_label || 'Active Snapshot') : 'Select Month'}
          deltaText={isMonthSelected ? `${metrics?.projects_ongoing ?? 0} Ongoing · ${metrics?.projects_completed ?? 0} Completed` : 'Awaiting snapshot selection'}
          deltaType={isMonthSelected ? 'positive' : 'neutral'}
          icon={Building2}
          subtitle="Projects costing ≥ Rs. 150 Cr"
        />

        <KpiCard
          id="kpi-total-outlay"
          label="Total Capital Outlay"
          value={isMonthSelected ? `Rs. ${((metrics?.total_original_cost_cr ?? 0) / 100000).toFixed(2)} L Cr` : '—'}
          subValue={isMonthSelected ? "Approved Baseline" : "Select Month"}
          subValueClassName={isMonthSelected ? "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-[#16A34A] bg-[#16A34A]/10" : undefined}
          deltaText={isMonthSelected ? `+${metrics?.cost_overrun_pct ?? 0}% Overrun (+Rs. ${((metrics?.total_cost_overrun_cr ?? 0) / 100000).toFixed(2)} L Cr)` : 'Awaiting snapshot selection'}
          deltaType={isMonthSelected ? ((metrics?.cost_overrun_pct ?? 0) > 0 ? 'negative' : 'positive') : 'neutral'}
          icon={DollarSign}
          subtitle={isMonthSelected ? `Revised: Rs. ${((metrics?.total_revised_cost_cr ?? 0) / 100000).toFixed(2)} L Cr` : 'Select a month to view outlay'}
        />

        {isNormalUser ? (
          <>
            <KpiCard
              id="kpi-sectors-monitored"
              label="Infrastructure Sectors"
              value={isMonthSelected && summaryData?.sector_breakdown?.length ? `${summaryData.sector_breakdown.length} Key Sectors` : '—'}
              subValue={isMonthSelected ? "Coverage" : "Select Month"}
              deltaText={isMonthSelected ? "National Master Plan" : "Awaiting selection"}
              deltaType={isMonthSelected ? "positive" : "neutral"}
              icon={Layers}
              subtitle="Roads, Rail, Power, Petroleum, etc."
            />

            <KpiCard
              id="kpi-expenditure-outlay"
              label="Cumulative Expenditure"
              value={isMonthSelected ? `Rs. ${((metrics?.total_expenditure_cr ?? 0) / 100000).toFixed(2)} L Cr` : '—'}
              subValue={isMonthSelected ? `${metrics?.expenditure_pct_of_revised ?? 0}% Outlay` : "Select Month"}
              deltaText={isMonthSelected ? `${metrics?.projects_completed ?? 0} Table 3 Completed` : "Awaiting selection"}
              deltaType={isMonthSelected ? "positive" : "neutral"}
              icon={CheckCircle2}
              subtitle="Disbursed Central Sector Outlay"
            />
          </>
        ) : (
          <>
            <KpiCard
              id="kpi-high-risk-count"
              label="High & Critical Risk"
              value={isMonthSelected ? highAndCritical : '—'}
              subValue={isMonthSelected ? `${highAndCritical} / ${totalProjects}` : 'Select Month'}
              deltaText={isMonthSelected ? `Critical: ${riskDistribution.CRITICAL} | High: ${riskDistribution.HIGH}` : 'Awaiting selection'}
              deltaType={isMonthSelected ? "critical" : "neutral"}
              icon={ShieldAlert}
              subtitle={isMonthSelected ? `Medium: ${riskDistribution.MEDIUM} | Low: ${riskDistribution.LOW}` : 'Select a month to view classification'}
            />

            <KpiCard
              id="kpi-early-warnings"
              label="Cost & Schedule Overruns"
              value={isMonthSelected ? ((metrics?.projects_with_cost_overrun ?? 0) + (metrics?.projects_with_time_overrun ?? 0)) : '—'}
              subValue={isMonthSelected ? 'Breach Triggers' : 'Select Month'}
              deltaText={isMonthSelected ? `${metrics?.projects_with_cost_overrun ?? 0} Cost · ${metrics?.projects_with_time_overrun ?? 0} Delay` : 'Awaiting selection'}
              deltaType={isMonthSelected ? 'critical' : 'neutral'}
              icon={AlertTriangle}
              subtitle={isMonthSelected ? 'Derived from Flash Report Table 1 & 2' : 'Select a month to view overruns'}
            />
          </>
        )}
      </div>

      {/* Visual Analytics Row: Risk Donut Chart & Sector Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Risk Distribution Card (Only visible to logged in officers) */}
        {!isNormalUser && (
          <div className="lg:col-span-4 bg-white rounded-lg p-5 sm:p-6 border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
                  Portfolio Risk Classification
                </span>
                <span className="text-xs text-[#0F9D8C] font-semibold">
                  {isMonthSelected ? (summaryData?.report_month_label || 'Selected Cycle') : 'Select Month'}
                </span>
              </div>
              <h3 className="font-bold text-base text-[#101A3D] mt-1">
                Deterministic Multi-Factor Risk Index
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Based on cost escalation %, schedule delay months, progress velocity, and capital scale.
              </p>
            </div>

            <div className="my-4">
              <RiskDonutChart
                counts={{
                  critical: riskDistribution.CRITICAL,
                  high: riskDistribution.HIGH,
                  medium: riskDistribution.MEDIUM,
                  low: riskDistribution.LOW,
                }}
                totalCount={isMonthSelected ? totalProjects : 0}
                selectedTier={selectedDonutTier}
                onSelectTier={setSelectedDonutTier}
              />
            </div>

            <div className="border-t border-[#E2E8F0] pt-3 text-xs text-[#64748B] flex items-center justify-between">
              <span>Critical (Score ≥75): {isMonthSelected ? riskDistribution.CRITICAL : '—'}</span>
              <button
                onClick={() => onNavigateProjects('critical')}
                className="text-[#0F9D8C] font-semibold hover:underline"
              >
                Filter Critical →
              </button>
            </div>
          </div>
        )}

        {/* Sector Cost Distribution Card */}
        <div className={`${!isNormalUser ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white rounded-lg p-5 sm:p-6 border border-[#E2E8F0] shadow-xs flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
                Sectoral Capital Allocation
              </span>
              <span className="text-xs text-[#64748B] font-medium">
                Approved vs Revised Outlay (Rs. Cr)
              </span>
            </div>
            <h3 className="font-bold text-base text-[#101A3D] mt-1">
              Top Infrastructure Sectors by Capital Outlay
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Comparative analysis of original sanction against latest revised outlay across major infrastructure domains.
            </p>
          </div>

          <div className="my-4">
            <SectorDistributionChart
              projects={isMonthSelected ? projects : []}
              dbSectors={isMonthSelected ? summaryData?.sector_breakdown : []}
            />
          </div>

          <div className="border-t border-[#E2E8F0] pt-3 text-xs text-[#64748B] flex items-center justify-between">
            <span>
              Total Sectors Tracked: {isMonthSelected ? (summaryData?.sector_breakdown?.length || 0) : '—'}
            </span>
            <button
              onClick={() => onNavigateProjects()}
              className="text-[#0F9D8C] font-semibold hover:underline"
            >
              View Full Registry →
            </button>
          </div>
        </div>
      </div>

      {/* Top High-Risk Projects Requiring Intervention */}
      <TopRiskProjectsTable
        projects={isMonthSelected ? projects : []}
        dbProjects={isMonthSelected ? summaryData?.top_critical_projects : []}
        onSelectProject={onSelectProject}
        onViewAllProjects={() => onNavigateProjects()}
      />
    </div>
  );
};
