import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  ChevronRight,
  ChevronLeft,
  Download,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  Loader2,
  RefreshCw,
  Lock,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { ProjectWithSnapshot, Profile } from '../types';
import { RiskBadge } from '../components/RiskBadge';
import { formatCurrencyCr, formatPercent } from '../utils/formatters';
import {
  getProjectsRegistry,
  RegistryProject,
  ProjectsRegistryResponse,
  getAvailableMonths,
  AvailableMonthItem,
  createProject,
} from '../services/api';

interface ProjectsPageProps {
  projects?: ProjectWithSnapshot[];
  onSelectProject: (projectCode: string) => void;
  initialTierFilter?: string | null;
  isNormalUser?: boolean;
  onOpenLogin?: () => void;
  currentProfile?: Profile | null;
}

const SECTORS = [
  'ALL',
  'Road Transport and Highways',
  'Railways',
  'Power',
  'Petroleum and Natural Gas',
  'Coal',
  'Mines',
  'Shipping and Ports',
  'Civil Aviation',
  'Telecommunications',
  'Steel',
  'Urban Development',
  'Atomic Energy',
  'Heavy Industry',
];

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  onSelectProject,
  initialTierFilter,
  isNormalUser = false,
  onOpenLogin,
  currentProfile,
}) => {
  const [monthsList, setMonthsList] = useState<AvailableMonthItem[]>([]);
  const [reportMonth, setReportMonth] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [riskTierFilter, setRiskTierFilter] = useState(
    initialTierFilter ? initialTierFilter.toUpperCase() : 'ALL'
  );
  const [sortBy, setSortBy] = useState('cost_overrun_pct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [registryData, setRegistryData] = useState<ProjectsRegistryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Project Modal state (Ministry)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newSector, setNewSector] = useState(SECTORS[1] || 'Road Transport and Highways');
  const [newState, setNewState] = useState('');
  const [newAgency, setNewAgency] = useState('');
  const [newCostCr, setNewCostCr] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [assignPm, setAssignPm] = useState(false);
  const [pmUsername, setPmUsername] = useState('');
  const [pmFullName, setPmFullName] = useState('');
  const [pmEmail, setPmEmail] = useState('');
  const [pmPassword, setPmPassword] = useState('');
  const [pmDesignation, setPmDesignation] = useState('Project Manager');
  const [pmPhone, setPmPhone] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    if (!newProjectName.trim()) {
      setCreateError('Project Name is required.');
      return;
    }
    if (assignPm) {
      if (!pmUsername.trim() || !pmFullName.trim() || !pmEmail.trim() || !pmPassword) {
        setCreateError('All PM credentials fields are required when assigning a Project Manager.');
        return;
      }
    }
    setCreateLoading(true);
    try {
      const res = await createProject({
        project_name: newProjectName.trim(),
        project_id: newProjectId.trim() || undefined,
        sector: newSector,
        state: newState.trim() || undefined,
        agency: newAgency.trim() || undefined,
        original_cost: newCostCr ? parseFloat(newCostCr) : undefined,
        original_completion_date: newTargetDate || undefined,
        assign_pm: assignPm,
        pm_username: assignPm ? pmUsername.trim() : undefined,
        pm_full_name: assignPm ? pmFullName.trim() : undefined,
        pm_email: assignPm ? pmEmail.trim() : undefined,
        pm_password: assignPm ? pmPassword : undefined,
        pm_designation: assignPm ? pmDesignation.trim() : undefined,
        pm_phone: assignPm ? pmPhone.trim() : undefined,
      });
      setCreateSuccess(res.message);
      fetchProjects();
      setTimeout(() => {
        setIsCreateModalOpen(false);
        setNewProjectName('');
        setNewProjectId('');
        setNewCostCr('');
        setNewTargetDate('');
        setNewState('');
        setNewAgency('');
        setAssignPm(false);
        setPmUsername('');
        setPmFullName('');
        setPmEmail('');
        setPmPassword('');
        setCreateSuccess(null);
      }, 1200);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create project.');
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    const loadMonths = async () => {
      try {
        const months = await getAvailableMonths();
        if (months && months.length > 0) {
          setMonthsList(months);
          setReportMonth((prev) => (prev ? prev : months[0].report_month));
        }
      } catch (err) {
        console.warn('Failed to load available months in ProjectsPage:', err);
      }
    };
    loadMonths();
    const handleUpdated = () => loadMonths();
    window.addEventListener('infranetra:month-updated', handleUpdated);
    return () => window.removeEventListener('infranetra:month-updated', handleUpdated);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  const handleSectorChange = (s: string) => {
    setSectorFilter(s);
    setPage(1);
  };
  const handleRiskChange = (r: string) => {
    if (isNormalUser && r !== 'ALL') {
      onOpenLogin?.();
      return;
    }
    setRiskTierFilter(r);
    setPage(1);
  };
  const handleStatusChange = (st: string) => {
    setStatusFilter(st);
    setPage(1);
  };
  const handleMonthChange = (m: string) => {
    setReportMonth(m);
    setPage(1);
  };

  const fetchProjects = async () => {
    if (!reportMonth) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProjectsRegistry({
        reportMonth,
        page,
        pageSize,
        search: debouncedSearch || undefined,
        sector: sectorFilter !== 'ALL' ? sectorFilter : undefined,
        state: stateFilter !== 'ALL' ? stateFilter : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        riskLevel: riskTierFilter !== 'ALL' ? riskTierFilter : undefined,
        sortBy,
        sortDir,
      });
      setRegistryData(data);
    } catch (err: any) {
      console.warn('Failed to load projects from backend API, using local fallback:', err);
      setError(err?.message || 'Failed to fetch registry data from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (reportMonth) {
      fetchProjects();
    }
  }, [
    reportMonth,
    page,
    pageSize,
    sectorFilter,
    stateFilter,
    statusFilter,
    riskTierFilter,
    sortBy,
    sortDir,
    debouncedSearch,
  ]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const exportCsv = () => {
    if (!registryData || registryData.projects.length === 0) return;
    const headers = [
      'Project ID',
      'Project Name',
      'Ministry',
      'Sector',
      'State',
      'Status',
      'Original Cost (Cr)',
      'Revised Cost (Cr)',
      'Cost Overrun %',
      'Expenditure (Cr)',
      'Physical Progress %',
      'Delay (Months)',
      ...(!isNormalUser ? ['Risk Score', 'Risk Level'] : []),
    ];
    const rows = registryData.projects.map((p) => [
      `"${p.project_id}"`,
      `"${(p.project_name || '').replace(/"/g, '""')}"`,
      `"${(p.ministry || '').replace(/"/g, '""')}"`,
      `"${p.sector}"`,
      `"${p.state}"`,
      p.status,
      p.original_cost ?? 'N/A',
      p.revised_cost ?? 'N/A',
      p.cost_overrun_pct,
      p.expenditure ?? 'N/A',
      p.physical_progress ?? 'N/A',
      p.delay_months,
      ...(!isNormalUser ? [p.risk_score, p.risk_level] : []),
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `InfraNetra_Registry_${reportMonth}_p${page}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const projects = registryData?.projects || [];
  const total = registryData?.total || 0;
  const totalPages = registryData?.total_pages || 1;

  return (
    <div id="projects-registry-container" className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0F9D8C]" />
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[#0F9D8C]">
              MoSPI Master Project Registry
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#101A3D] mt-1 tracking-tight">
            Central Sector Infrastructure Projects Registry
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Ingested from official PAIMANA Flash Reports · {total.toLocaleString()} projects found in active snapshot
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Snapshot Selector */}
          <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#CBD5E1] p-1 rounded-lg">
            <Calendar className="w-4 h-4 text-[#0F9D8C] ml-1.5" />
            <select
              value={reportMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              aria-label="Snapshot Month"
              className="bg-transparent text-xs font-semibold text-[#101A3D] pr-2 focus:outline-hidden cursor-pointer"
            >
              {monthsList.map((m) => (
                <option key={m.report_month} value={m.report_month}>
                  {m.label} ({m.project_count.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#101A3D] hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#0F9D8C]" />
            <span>Export CSV</span>
          </button>

          {(currentProfile?.authUser?.role === 'MINISTRY' || currentProfile?.role === 'MINISTRY') && (
            <button
              onClick={() => {
                setIsCreateModalOpen(true);
                setCreateError(null);
                setCreateSuccess(null);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0F9D8C] hover:bg-[#0c7c6f] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-white" />
              <span>Create New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white p-4 rounded-lg border border-[#E2E8F0] shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by project ID, title, or ministry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#101A3D] placeholder-[#94A3B8] focus:bg-white focus:outline-hidden focus:border-[#0F9D8C]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-[#94A3B8] hover:text-[#475569]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sector Filter */}
          <div>
            <select
              value={sectorFilter}
              onChange={(e) => handleSectorChange(e.target.value)}
              aria-label="Filter by Sector"
              className="w-full py-1.5 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#101A3D] focus:bg-white focus:outline-hidden focus:border-[#0F9D8C]"
            >
              <option value="ALL">All Sectors</option>
              {SECTORS.filter((s) => s !== 'ALL').map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Risk Tier Filter (Visible only for logged in officers/users) */}
          {!isNormalUser && (
            <div>
              <select
                value={riskTierFilter}
                onChange={(e) => handleRiskChange(e.target.value)}
                aria-label="Filter by Risk Tier"
                className="w-full py-1.5 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#101A3D] focus:bg-white focus:outline-hidden focus:border-[#0F9D8C]"
              >
                <option value="ALL">All Risk Tiers</option>
                <option value="CRITICAL">Critical Risk (≥75)</option>
                <option value="HIGH">High Risk (50–74)</option>
                <option value="MEDIUM">Medium Risk (25–49)</option>
                <option value="LOW">Low Risk (&lt;25)</option>
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              aria-label="Filter by Execution Status"
              className="w-full py-1.5 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#101A3D] focus:bg-white focus:outline-hidden focus:border-[#0F9D8C]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed (Table 3)</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchProjects} className="font-semibold underline text-red-900">
            Retry
          </button>
        </div>
      )}

      {/* Projects Registry Data Table */}
      <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs overflow-hidden relative min-h-[320px]">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center z-10">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#101A3D]">
              <Loader2 className="w-5 h-5 animate-spin text-[#0F9D8C]" />
              <span>Querying InfraNetra Database...</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1E293B] border-collapse">
            <thead className="bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B] uppercase tracking-[0.04em] border-b border-[#CBD5E1]">
              <tr>
                <th className="py-3 px-3 border-r border-[#CBD5E1] whitespace-nowrap">
                  <button
                    onClick={() => handleSort('project_id')}
                    className="flex items-center gap-1 font-semibold hover:text-[#101A3D]"
                  >
                    Project ID
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 border-r border-[#CBD5E1] min-w-[240px]">
                  Project Name & Ministry
                </th>
                <th className="py-3 px-3 border-r border-[#CBD5E1] whitespace-nowrap">Sector</th>
                <th className="py-3 px-3 border-r border-[#CBD5E1] whitespace-nowrap">State</th>
                <th className="py-3 px-3 text-center border-r border-[#CBD5E1] whitespace-nowrap">Status</th>
                <th className="py-3 px-3 text-right border-r border-[#CBD5E1] whitespace-nowrap">
                  <button
                    onClick={() => handleSort('original_cost')}
                    className="flex items-center gap-1 font-semibold ml-auto hover:text-[#101A3D]"
                  >
                    Approved (Cr)
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right border-r border-[#CBD5E1] whitespace-nowrap">
                  <button
                    onClick={() => handleSort('revised_cost')}
                    className="flex items-center gap-1 font-semibold ml-auto hover:text-[#101A3D]"
                  >
                    Revised (Cr)
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right border-r border-[#CBD5E1] whitespace-nowrap">
                  <button
                    onClick={() => handleSort('cost_overrun_pct')}
                    className="flex items-center gap-1 font-semibold ml-auto hover:text-[#101A3D]"
                  >
                    Overrun %
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-center border-r border-[#CBD5E1] whitespace-nowrap">
                  <button
                    onClick={() => handleSort('physical_progress')}
                    className="flex items-center gap-1 font-semibold mx-auto hover:text-[#101A3D]"
                  >
                    Progress
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                {!isNormalUser && (
                  <th className="py-3 px-3 text-center border-r border-[#CBD5E1] whitespace-nowrap">
                    <button
                      onClick={() => handleSort('risk_score')}
                      className="flex items-center gap-1 font-semibold mx-auto hover:text-[#101A3D]"
                    >
                      Risk Tier
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                )}
                <th className="py-3 px-3 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {projects.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={isNormalUser ? 10 : 11} className="py-12 text-center text-[#64748B]">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 text-[#94A3B8]" />
                    <p className="font-semibold text-sm">No infrastructure projects found</p>
                    <p className="text-xs text-[#94A3B8] mt-1">Try relaxing search or filter criteria</p>
                  </td>
                </tr>
              ) : (
                projects.map((p, idx) => {
                  const isZebra = idx % 2 === 1;
                  const tierLower = p.risk_level.toLowerCase() as 'critical' | 'high' | 'medium' | 'low';
                  return (
                    <tr
                      key={p.project_id}
                      onClick={() => onSelectProject(p.project_id)}
                      className={`hover:bg-[#E6F6F4]/50 cursor-pointer transition-colors ${
                        isZebra ? 'bg-[#F8FAFC]/50' : 'bg-white'
                      }`}
                    >
                      <td className="py-3 px-3 font-mono-code font-bold text-xs text-[#101A3D] whitespace-nowrap border-r border-[#E2E8F0]">
                        {p.project_id}
                      </td>
                      <td className="py-3 px-4 max-w-[280px] border-r border-[#E2E8F0]">
                        <div className="font-semibold text-[#1E293B] truncate hover:text-[#0F9D8C]" title={p.project_name}>
                          {p.project_name}
                        </div>
                        <div className="text-[11px] text-[#64748B] truncate mt-0.5" title={p.ministry}>
                          {p.ministry}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#475569] truncate max-w-[130px] border-r border-[#E2E8F0]" title={p.sector}>
                        {p.sector}
                      </td>
                      <td className="py-3 px-3 text-[#475569] truncate max-w-[110px] border-r border-[#E2E8F0]" title={p.state}>
                        {p.state}
                      </td>
                      <td className="py-3 px-3 text-center border-r border-[#E2E8F0] whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                            p.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-tabular text-[#64748B] whitespace-nowrap border-r border-[#E2E8F0]">
                        {p.original_cost !== null ? formatCurrencyCr(p.original_cost) : 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-right font-tabular font-bold text-[#1E293B] whitespace-nowrap border-r border-[#E2E8F0]">
                        {p.revised_cost !== null ? formatCurrencyCr(p.revised_cost) : 'N/A'}
                      </td>
                      <td className="py-3 px-3 text-right font-tabular whitespace-nowrap border-r border-[#E2E8F0]">
                        {p.cost_overrun_pct > 0 ? (
                          <span className="font-semibold text-[#DC2626]">+{p.cost_overrun_pct}%</span>
                        ) : (
                          <span className="text-[#16A34A]">0.0%</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap border-r border-[#E2E8F0]">
                        {p.physical_progress !== null ? (
                          <div className="inline-flex items-center gap-1 font-semibold text-xs text-[#101A3D]">
                            {p.physical_progress}%
                          </div>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                      {!isNormalUser && (
                        <td className="py-3 px-3 text-center whitespace-nowrap border-r border-[#E2E8F0]">
                          <RiskBadge tier={tierLower} score={p.risk_score} size="sm" />
                        </td>
                      )}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProject(p.project_id);
                          }}
                          className="p-1 rounded hover:bg-slate-200 text-[#0F9D8C] transition-colors"
                          title="View project details"
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

        {/* Pagination Bar */}
        <div className="p-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B]">
          <div className="flex items-center gap-2">
            <span>
              Showing {projects.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(page * pageSize, total)} of {total.toLocaleString()} projects
            </span>
            <span className="text-slate-300">|</span>
            <label className="flex items-center gap-1">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-[#CBD5E1] rounded px-1.5 py-0.5 text-xs text-[#101A3D]"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-2.5 py-1 rounded border border-[#CBD5E1] bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs text-[#101A3D] flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-2 text-xs font-semibold text-[#101A3D]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-2.5 py-1 rounded border border-[#CBD5E1] bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-xs text-[#101A3D] flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Create New Project Modal (Ministry) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-8">
            {/* Header */}
            <div className="px-6 py-4 bg-[#101A3D] text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#0F9D8C]" />
                  <span>Create New Infrastructure Project</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Ministry: <strong className="text-white">{currentProfile?.department || currentProfile?.authUser?.assigned_ministry || 'Ministry'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateProjectSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}
              {createSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{createSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                    Project Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. New Broad Gauge Railway Line Project"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-[#101A3D] focus:ring-2 focus:ring-[#0F9D8C]/30 focus:border-[#0F9D8C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                    Canonical Project ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-[#101A3D] focus:ring-2 focus:ring-[#0F9D8C]/30 focus:border-[#0F9D8C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                    Sector
                  </label>
                  <select
                    value={newSector}
                    onChange={(e) => setNewSector(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-[#101A3D] focus:ring-2 focus:ring-[#0F9D8C]/30 focus:border-[#0F9D8C] outline-none bg-white"
                  >
                    {SECTORS.filter((s) => s !== 'ALL').map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                    State / Region
                  </label>
                  <input
                    type="text"
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    placeholder="e.g. Maharashtra, Multi-State"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-[#101A3D] focus:ring-2 focus:ring-[#0F9D8C]/30 focus:border-[#0F9D8C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                    Executing Agency
                  </label>
                  <input
                    type="text"
                    value={newAgency}
                    onChange={(e) => setNewAgency(e.target.value)}
                    placeholder="e.g. RVNL, NHAI"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-[#101A3D] focus:ring-2 focus:ring-[#0F9D8C]/30 focus:border-[#0F9D8C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                    Original Cost (Rs. Crore)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newCostCr}
                    onChange={(e) => setNewCostCr(e.target.value)}
                    placeholder="e.g. 1250.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-[#101A3D] focus:ring-2 focus:ring-[#0F9D8C]/30 focus:border-[#0F9D8C] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-[#101A3D] focus:ring-2 focus:ring-[#0F9D8C]/30 focus:border-[#0F9D8C] outline-none"
                  />
                </div>
              </div>

              {/* Optional PM Assignment Accordion */}
              <div className="pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={assignPm}
                    onChange={(e) => setAssignPm(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0F9D8C] focus:ring-[#0F9D8C]"
                  />
                  <span className="text-xs font-bold text-[#101A3D]">
                    Assign Project Manager to this Project (Optional)
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                  Creates an initial PM profile linked to this project with status <strong>PENDING</strong>. The PM must complete authentication/approval.
                </p>

                {assignPm && (
                  <div className="mt-3 ml-6 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                          PM Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={assignPm}
                          value={pmFullName}
                          onChange={(e) => setPmFullName(e.target.value)}
                          placeholder="e.g. Rajesh Sharma"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-[#101A3D] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                          PM Username <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required={assignPm}
                          value={pmUsername}
                          onChange={(e) => setPmUsername(e.target.value)}
                          placeholder="e.g. pm_rajesh"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-[#101A3D] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                          PM Official Email <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          required={assignPm}
                          value={pmEmail}
                          onChange={(e) => setPmEmail(e.target.value)}
                          placeholder="e.g. rajesh.pm@gov.in"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-[#101A3D] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                          Initial Password <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="password"
                          required={assignPm}
                          value={pmPassword}
                          onChange={(e) => setPmPassword(e.target.value)}
                          placeholder="Min. 6 characters"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-[#101A3D] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                          Designation
                        </label>
                        <input
                          type="text"
                          value={pmDesignation}
                          onChange={(e) => setPmDesignation(e.target.value)}
                          placeholder="Project Director / Manager"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-[#101A3D] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#101A3D] mb-1">
                          Phone (Optional)
                        </label>
                        <input
                          type="tel"
                          value={pmPhone}
                          onChange={(e) => setPmPhone(e.target.value)}
                          placeholder="10-digit mobile"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-[#101A3D] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createLoading}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 bg-[#0F9D8C] hover:bg-[#0c7c6f] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  {createLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{createLoading ? 'Creating Project...' : 'Create Project'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
