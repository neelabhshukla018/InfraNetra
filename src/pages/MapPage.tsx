import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Layers,
  Search,
  ExternalLink,
  AlertTriangle,
  Clock,
  Compass,
  CheckCircle2,
  Calendar,
  Loader2,
} from 'lucide-react';
import { ProjectWithSnapshot, RiskTier } from '../types';
import { RiskBadge } from '../components/RiskBadge';
import { formatCurrencyCr, formatPercent } from '../utils/formatters';
import { GoogleIndiaMap } from '../components/GoogleIndiaMap';
import { MapErrorBoundary } from '../components/MapErrorBoundary';
import {
  getMapProjects,
  MapMarkerProject,
  StateAggregate,
  MapProjectsResponse,
  getAvailableMonths,
  AvailableMonthItem,
} from '../services/api';

interface MapPageProps {
  projects: ProjectWithSnapshot[];
  onSelectProject: (projectCode: string) => void;
  isNormalUser?: boolean;
}

export const MapPage: React.FC<MapPageProps> = ({
  projects,
  onSelectProject,
  isNormalUser = false,
}) => {
  const [monthsList, setMonthsList] = useState<AvailableMonthItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [mapData, setMapData] = useState<MapProjectsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedRiskTier, setSelectedRiskTier] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'state-summary'>('map');

  useEffect(() => {
    const loadMonths = async () => {
      try {
        const months = await getAvailableMonths();
        if (months && months.length > 0) {
          setMonthsList(months);
          setSelectedMonth((prev) => (prev ? prev : months[0].report_month));
        }
      } catch (err) {
        console.warn('Failed to load available months in MapPage:', err);
      }
    };
    loadMonths();
    const handleUpdated = () => loadMonths();
    window.addEventListener('infranetra:month-updated', handleUpdated);
    return () => window.removeEventListener('infranetra:month-updated', handleUpdated);
  }, []);

  const fetchMapData = async (m: string) => {
    if (!m) return;
    setIsLoading(true);
    try {
      const data = await getMapProjects(m);
      setMapData(data);
      if (data.markers.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data.markers[0].project_id);
      }
    } catch (err) {
      console.warn('Failed to load map data from backend API:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMonth) {
      fetchMapData(selectedMonth);
    }
  }, [selectedMonth]);

  const rawMarkers = mapData?.markers || [];

  // Sectors & States lists
  const sectors = useMemo(() => {
    return Array.from(new Set(rawMarkers.map((m) => m.sector))).filter(Boolean).sort();
  }, [rawMarkers]);

  const states = useMemo(() => {
    return Array.from(new Set(rawMarkers.map((m) => m.state))).filter(Boolean).sort();
  }, [rawMarkers]);

  // Filtered markers
  const filteredMarkers = useMemo(() => {
    return rawMarkers.filter((m) => {
      const matchesSearch =
        searchQuery === '' ||
        m.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.project_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.state.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSector = selectedSector === 'all' || m.sector === selectedSector;
      const matchesRisk = selectedRiskTier === 'all' || m.risk_level === selectedRiskTier;
      const matchesState = selectedState === 'all' || m.state === selectedState;

      return matchesSearch && matchesSector && matchesRisk && matchesState;
    });
  }, [rawMarkers, searchQuery, selectedSector, selectedRiskTier, selectedState]);

  // Active highlighted marker
  const activeMarker = useMemo(() => {
    if (!selectedProjectId) return filteredMarkers[0] || null;
    return filteredMarkers.find((m) => m.project_id === selectedProjectId) || filteredMarkers[0] || null;
  }, [selectedProjectId, filteredMarkers]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const total = filteredMarkers.length;
    const critical = filteredMarkers.filter((m) => m.risk_level === 'CRITICAL').length;
    const high = filteredMarkers.filter((m) => m.risk_level === 'HIGH').length;
    const totalRevisedCost = filteredMarkers.reduce((acc, m) => acc + m.revised_cost, 0);

    const delayedMarkers = filteredMarkers.filter((m) => m.delay_months > 0);
    const avgDelay =
      delayedMarkers.length > 0
        ? Math.round(delayedMarkers.reduce((acc, m) => acc + m.delay_months, 0) / delayedMarkers.length)
        : 0;

    return { total, critical, high, totalRevisedCost, avgDelay };
  }, [filteredMarkers]);

  // State aggregates from backend API
  const stateAggregates: StateAggregate[] = mapData?.state_aggregates || [];

  // Adapt markers for GoogleIndiaMap component
  const adaptedProjects = useMemo(() => {
    return filteredMarkers.map((m) => ({
      project_code: m.project_id,
      name: m.project_name,
      ministry: m.sector,
      sector: m.sector,
      state: m.state,
      approved_cost: m.original_cost,
      epc_contractor: 'MoSPI Central Sector',
      sanction_date: '2021-01-01',
      target_completion: '2026-12-31',
      nodal_officer: 'Project Director',
      length_or_capacity: 'Mega Corridor',
      latest_snapshot: {
        id: `snap-${m.project_id}`,
        project_code: m.project_id,
        report_month: selectedMonth,
        revised_cost: m.revised_cost,
        expenditure: m.expenditure || 0,
        physical_progress_pct: m.physical_progress || 0,
        expected_progress_pct: 100,
        time_risk: m.risk_score,
        cost_risk: m.risk_score,
        implementation_risk: m.risk_score,
        overall_risk: m.risk_score,
        risk_tier: m.risk_level.toLowerCase() as RiskTier,
        delay_months: m.delay_months,
        cost_overrun_pct: Math.round(((m.revised_cost - m.original_cost) / (m.original_cost || 1)) * 100),
        last_updated_relative: 'Verified',
        last_updated_absolute: selectedMonth,
      },
      active_warnings_count: 0,
      warnings: [],
    }));
  }, [filteredMarkers, selectedMonth]);

  return (
    <div id="google-map-page-container" className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-[#101A3D] text-[#0F9D8C] flex items-center justify-center shadow-xs shrink-0 mt-0.5">
              <Compass className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#101A3D] tracking-tight">
                  National Infrastructure Geospatial Map
                </h1>
                <span className="text-[11px] font-mono-code font-bold uppercase px-2.5 py-0.5 rounded bg-[#E6F6F4] text-[#0F9D8C] border border-[#0F9D8C]/30">
                  Live Snapshot View
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed max-w-2xl">
                Geospatial distribution and real-time risk intelligence of Central Sector Infrastructure Projects across India.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            {/* Snapshot Selector */}
            <div className="flex items-center gap-1 bg-[#F8FAFC] border border-[#CBD5E1] p-1 rounded-lg">
              <Calendar className="w-4 h-4 text-[#0F9D8C] ml-1.5" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="Select Snapshot Month"
                className="bg-transparent text-xs font-semibold text-[#101A3D] pr-2 focus:outline-hidden cursor-pointer"
              >
                {monthsList.map((m) => (
                  <option key={m.report_month} value={m.report_month}>
                    {m.label} ({m.project_count.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-lg border border-[#E2E8F0]">
              <button
                onClick={() => setViewMode('map')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'map' ? 'bg-[#101A3D] text-white shadow-xs' : 'text-[#64748B] hover:text-[#101A3D]'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-[#0F9D8C]" />
                <span>Map View</span>
              </button>
              <button
                onClick={() => setViewMode('state-summary')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'state-summary' ? 'bg-[#101A3D] text-white shadow-xs' : 'text-[#64748B] hover:text-[#101A3D]'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>State Analytics</span>
              </button>
            </div>
          </div>
        </div>

        {/* Top Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-[#F1F5F9]">
          <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
              Monitored Projects
            </span>
            <span className="text-xl font-bold font-tabular text-[#101A3D] mt-0.5 block">
              {summaryMetrics.total.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#64748B] mt-0.5 block">Active map markers</span>
          </div>

          <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
              Total Capital Outlay
            </span>
            <span className="text-xl font-bold font-tabular text-[#101A3D] mt-0.5 block">
              Rs. {(summaryMetrics.totalRevisedCost / 100000).toFixed(2)} L Cr
            </span>
            <span className="text-[10px] text-[#64748B] mt-0.5 block">Revised sanctioned cost</span>
          </div>

          <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
              High / Critical Risk
            </span>
            <span className="text-xl font-bold font-tabular text-[#DC2626] mt-0.5 block">
              {summaryMetrics.critical + summaryMetrics.high}
            </span>
            <span className="text-[10px] text-[#64748B] mt-0.5 block">
              Critical: {summaryMetrics.critical} | High: {summaryMetrics.high}
            </span>
          </div>

          <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
              Average Schedule Lag
            </span>
            <span className="text-xl font-bold font-tabular text-[#EA580C] mt-0.5 block">
              {summaryMetrics.avgDelay > 0 ? `+${summaryMetrics.avgDelay} Months` : 'On Track'}
            </span>
            <span className="text-[10px] text-[#64748B] mt-0.5 block">
              Evaluated on projects with delay
            </span>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center flex-1">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search project name, ID, or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#101A3D] focus:bg-white focus:outline-hidden focus:border-[#0F9D8C]"
            />
          </div>

          {/* Sector Filter */}
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            aria-label="Filter Map by Sector"
            className="py-1.5 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#101A3D] focus:bg-white focus:outline-hidden focus:border-[#0F9D8C]"
          >
            <option value="all">All Sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* State Filter */}
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            aria-label="Filter Map by State"
            className="py-1.5 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#101A3D] focus:bg-white focus:outline-hidden focus:border-[#0F9D8C]"
          >
            <option value="all">All States</option>
            {states.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Risk Filter */}
          <select
            value={selectedRiskTier}
            onChange={(e) => setSelectedRiskTier(e.target.value)}
            aria-label="Filter Map by Risk Tier"
            className="py-1.5 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-md text-xs text-[#101A3D] focus:bg-white focus:outline-hidden focus:border-[#0F9D8C]"
          >
            <option value="all">All Risk Levels</option>
            <option value="CRITICAL">Critical Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="LOW">Low Risk</option>
          </select>
        </div>

        <div className="text-xs font-medium text-[#64748B] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#0F9D8C]" />
          <span>📍 Markers labeled: State-level location centroid fallback</span>
        </div>
      </div>

      {viewMode === 'map' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Map Canvas */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden h-[600px] relative">
            <MapErrorBoundary>
              <GoogleIndiaMap
                projects={adaptedProjects as any}
                selectedProjectCode={selectedProjectId}
                onSelectProject={(code) => {
                  setSelectedProjectId(code);
                }}
                isNormalUser={isNormalUser}
              />
            </MapErrorBoundary>
          </div>

          {/* Project Details Panel */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5 flex flex-col justify-between h-[600px] overflow-y-auto">
            {activeMarker ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono-code font-bold text-[#0F9D8C]">
                      {activeMarker.project_id}
                    </span>
                    <span className="text-[10px] text-[#64748B] font-medium bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0]">
                      {activeMarker.location_accuracy}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-[#101A3D] mt-1 leading-snug">
                    {activeMarker.project_name}
                  </h3>
                  <div className="text-xs text-[#64748B] mt-0.5">
                    {activeMarker.sector} · <span className="font-semibold text-[#1E293B]">{activeMarker.state}</span>
                  </div>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Approved Cost:</span>
                    <span className="font-semibold text-[#101A3D]">{formatCurrencyCr(activeMarker.original_cost)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Revised Outlay:</span>
                    <span className="font-bold text-[#101A3D]">{formatCurrencyCr(activeMarker.revised_cost)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Physical Progress:</span>
                    <span className="font-bold text-[#0F9D8C]">
                      {activeMarker.physical_progress !== null ? `${activeMarker.physical_progress}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B]">Delay Overrun:</span>
                    <span className={`font-bold ${activeMarker.delay_months > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                      {activeMarker.delay_months > 0 ? `+${activeMarker.delay_months} Months` : 'On Track'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
                    <span className="text-[#64748B]">Composite Risk:</span>
                    <RiskBadge tier={activeMarker.risk_level.toLowerCase() as RiskTier} score={activeMarker.risk_score} size="sm" />
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <div className="font-semibold mb-0.5">Location Precision Notice:</div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Exact project site GPS boundary polygon is pending state PWD geo-survey. Centroid rendered using verified {activeMarker.state} jurisdiction coordinates.
                  </p>
                </div>

                <button
                  onClick={() => onSelectProject(activeMarker.project_id)}
                  className="w-full py-2 bg-[#101A3D] hover:bg-[#1b2b65] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <span>Open Full Project Risk File</span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#0F9D8C]" />
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-[#64748B]">
                <Compass className="w-8 h-8 text-slate-300 mb-2" />
                <p className="font-semibold text-xs">No project selected</p>
                <p className="text-[11px] text-slate-400">Click a marker on the map to inspect project telemetry</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* State Analytics Table */
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[#1E293B]">
                State-by-State Infrastructure Capital & Delay Matrix
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Aggregated Central Sector portfolio for {selectedMonth} (Average delay evaluated only on delayed/completed records)
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1E293B] border-collapse">
              <thead className="bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#CBD5E1]">
                <tr>
                  <th className="py-3 px-4 border-r border-[#CBD5E1]">State / Territory</th>
                  <th className="py-3 px-4 text-center border-r border-[#CBD5E1]">Total Projects</th>
                  <th className="py-3 px-4 text-right border-r border-[#CBD5E1]">Total Outlay (Rs. Cr)</th>
                  <th className="py-3 px-4 text-center border-r border-[#CBD5E1]">Critical Projects</th>
                  <th className="py-3 px-4 text-center">Avg Delay (Months)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {stateAggregates.map((st, idx) => (
                  <tr key={st.state} className={idx % 2 === 1 ? 'bg-[#F8FAFC]/50' : 'bg-white'}>
                    <td className="py-3 px-4 font-semibold text-[#101A3D] border-r border-[#E2E8F0]">
                      {st.state}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-[#1E293B] border-r border-[#E2E8F0]">
                      {st.project_count}
                    </td>
                    <td className="py-3 px-4 text-right font-tabular font-bold text-[#101A3D] border-r border-[#E2E8F0]">
                      {formatCurrencyCr(st.total_cost_cr)}
                    </td>
                    <td className="py-3 px-4 text-center border-r border-[#E2E8F0]">
                      {st.critical_projects > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-semibold text-[11px]">
                          {st.critical_projects}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-[#EA580C]">
                      {st.average_delay_months > 0 ? `+${st.average_delay_months}m` : '0m'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
