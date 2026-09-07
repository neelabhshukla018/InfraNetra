import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  FileText,
  FileSpreadsheet,
  FolderGit2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { ProjectWithSnapshot, UploadedReportDocument } from '../types';
import { UPLOADED_REPORTS } from '../data/uploadedReports';
import { getProjectsRegistry, lookupProject, getProjectDetail } from '../services/api';

interface ReportSearchBarProps {
  projects: ProjectWithSnapshot[];
  onSelectProject: (projectCode: string) => void;
  onSelectDocument: (doc: UploadedReportDocument) => void;
  isNormalUser?: boolean;
}

export interface SearchProjectItem {
  id: string;
  name: string;
  ministry: string;
  sector: string;
  state?: string;
  approved_cost: number;
  revised_cost?: number;
  physical_progress_pct?: number;
  cost_overrun_pct?: number;
  delay_months?: number;
  risk_level: string; // 'critical' | 'high' | 'medium' | 'low'
}

export const ReportSearchBar: React.FC<ReportSearchBarProps> = ({
  projects,
  onSelectProject,
  onSelectDocument,
  isNormalUser = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Live API search state
  const [apiProjects, setApiProjects] = useState<SearchProjectItem[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const searchRequestIdRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Fetch live matching projects from backend database API with debounce
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setApiProjects([]);
      setIsLoadingApi(false);
      return;
    }

    const currentRequestId = ++searchRequestIdRef.current;
    setIsLoadingApi(true);

    const timer = setTimeout(async () => {
      try {
        // 1. Query the main projects registry search endpoint
        const registryPromise = getProjectsRegistry({
          search: q,
          pageSize: 8,
        }).catch(() => null);

        // 2. If the query looks like a project ID (numeric or alphanumeric without whitespace), also query lookup in parallel
        const isPotentialId = /^[a-zA-Z0-9_-]+$/.test(q);
        const lookupPromise = isPotentialId
          ? lookupProject(q).catch(() => null)
          : Promise.resolve(null);

        const [registryRes, lookupRes] = await Promise.all([registryPromise, lookupPromise]);

        if (currentRequestId === searchRequestIdRef.current) {
          const resultsMap = new Map<string, SearchProjectItem>();

          // Add direct lookup result first if matched
          if (lookupRes && lookupRes.found && lookupRes.project_id) {
            resultsMap.set(lookupRes.project_id.toLowerCase(), {
              id: lookupRes.project_id,
              name: lookupRes.project_name || `Project ${lookupRes.project_id}`,
              ministry: lookupRes.ministry || lookupRes.approval_authority || 'Central Sector',
              sector: 'Central Infrastructure',
              approved_cost: 0,
              risk_level: 'medium',
            });
          }

          // Add registry search results
          if (registryRes && registryRes.projects) {
            for (const p of registryRes.projects) {
              const key = String(p.project_id).toLowerCase();
              if (!resultsMap.has(key)) {
                resultsMap.set(key, {
                  id: p.project_id,
                  name: p.project_name,
                  ministry: p.ministry || 'Central Sector',
                  sector: p.sector || 'Infrastructure',
                  state: p.state || 'India',
                  approved_cost: p.original_cost || 0,
                  revised_cost: p.revised_cost || undefined,
                  physical_progress_pct: p.physical_progress ?? undefined,
                  cost_overrun_pct: p.cost_overrun_pct ?? undefined,
                  delay_months: p.delay_months ?? undefined,
                  risk_level: (p.risk_level || 'LOW').toLowerCase(),
                });
              }
            }
          }

          // If still no results and query is a direct ID, attempt getProjectDetail
          if (resultsMap.size === 0 && isPotentialId) {
            try {
              const direct = await getProjectDetail(q);
              if (direct && direct.project_id) {
                resultsMap.set(direct.project_id.toLowerCase(), {
                  id: direct.project_id,
                  name: direct.project_name,
                  ministry: direct.ministry,
                  sector: direct.sector,
                  state: direct.state,
                  approved_cost: direct.financials?.original_cost_cr || 0,
                  revised_cost: direct.financials?.revised_cost_cr || undefined,
                  physical_progress_pct: direct.financials?.physical_progress_pct ?? undefined,
                  cost_overrun_pct: direct.financials?.cost_overrun_pct ?? undefined,
                  delay_months: direct.schedule?.delay_months ?? undefined,
                  risk_level: (direct.risk_assessment?.level || 'LOW').toLowerCase(),
                });
              }
            } catch {
              // Ignore direct fetch fallback error
            }
          }

          setApiProjects(Array.from(resultsMap.values()));
        }
      } catch (err) {
        console.warn('Live search error:', err);
      } finally {
        if (currentRequestId === searchRequestIdRef.current) {
          setIsLoadingApi(false);
        }
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  // Filtered documents (searchable by title, cycle, format, etc.)
  const filteredDocuments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return UPLOADED_REPORTS;
    }
    return UPLOADED_REPORTS.filter((doc) => {
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.cycle.toLowerCase().includes(q) ||
        doc.fileName.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q) ||
        doc.department.toLowerCase().includes(q) ||
        doc.uploadedBy.toLowerCase().includes(q)
      );
    });
  }, [query]);

  // Combined project matches (live API results + in-memory projects)
  const filteredProjects = useMemo<SearchProjectItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [];
    }

    // 1. In-memory project matches
    const inMemoryMatches: SearchProjectItem[] = projects
      .filter((p) => {
        return (
          p.project_code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.ministry.toLowerCase().includes(q) ||
          p.sector.toLowerCase().includes(q) ||
          p.state.toLowerCase().includes(q) ||
          (p.epc_contractor && p.epc_contractor.toLowerCase().includes(q))
        );
      })
      .map((p) => ({
        id: p.project_code,
        name: p.name,
        ministry: p.ministry,
        sector: p.sector,
        state: p.state,
        approved_cost: p.approved_cost,
        revised_cost: p.latest_snapshot?.revised_cost,
        physical_progress_pct: p.latest_snapshot?.physical_progress_pct,
        cost_overrun_pct: p.latest_snapshot?.cost_overrun_pct,
        delay_months: p.latest_snapshot?.delay_months,
        risk_level: (p.latest_snapshot?.risk_tier || 'low').toLowerCase(),
      }));

    // 2. Combine and deduplicate
    const combined: SearchProjectItem[] = [];
    const seenIds = new Set<string>();

    for (const p of apiProjects) {
      const cleanId = String(p.id).trim().toLowerCase();
      if (!seenIds.has(cleanId)) {
        seenIds.add(cleanId);
        combined.push(p);
      }
    }

    for (const p of inMemoryMatches) {
      const cleanId = String(p.id).trim().toLowerCase();
      if (!seenIds.has(cleanId)) {
        seenIds.add(cleanId);
        combined.push(p);
      }
    }

    // Sort: exact ID matches placed first
    combined.sort((a, b) => {
      const aId = String(a.id).trim().toLowerCase();
      const bId = String(b.id).trim().toLowerCase();
      if (aId === q && bId !== q) return -1;
      if (bId === q && aId !== q) return 1;
      if (aId.startsWith(q) && !bId.startsWith(q)) return -1;
      if (bId.startsWith(q) && !aId.startsWith(q)) return 1;
      return 0;
    });

    return combined.slice(0, 8);
  }, [query, projects, apiProjects]);

  const totalResults = filteredDocuments.length + filteredProjects.length;

  const handleDocumentClick = (doc: UploadedReportDocument) => {
    onSelectDocument(doc);
    setIsOpen(false);
    setQuery('');
  };

  const handleProjectClick = (code: string) => {
    onSelectProject(code);
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < totalResults ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : totalResults - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = query.trim();

      // 1. If an item was navigated to via arrow keys
      if (selectedIndex >= 0 && selectedIndex < filteredDocuments.length) {
        handleDocumentClick(filteredDocuments[selectedIndex]);
        return;
      } else if (selectedIndex >= filteredDocuments.length) {
        const projIndex = selectedIndex - filteredDocuments.length;
        if (filteredProjects[projIndex]) {
          handleProjectClick(filteredProjects[projIndex].id);
          return;
        }
      }

      // 2. Default Enter action: if there are project matches, select the top one
      if (filteredProjects.length > 0) {
        handleProjectClick(filteredProjects[0].id);
        return;
      }

      // 3. If trimmed query is provided and looks like a project id, open it directly
      if (trimmed) {
        handleProjectClick(trimmed);
        return;
      }

      // 4. Otherwise if document match exists, select it
      if (filteredDocuments.length > 0) {
        handleDocumentClick(filteredDocuments[0]);
        return;
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSearchClick = () => {
    const trimmed = query.trim();
    if (trimmed) {
      if (filteredProjects.length > 0) {
        handleProjectClick(filteredProjects[0].id);
        return;
      }
      handleProjectClick(trimmed);
      return;
    }
    inputRef.current?.focus();
    setIsOpen(true);
  };

  return (
    <div
      ref={containerRef}
      id="navbar-report-search-container"
      className="relative flex items-center mr-2 sm:mr-3.5 -translate-x-1 sm:-translate-x-2"
    >
      {/* Search Input Box */}
      <div className="relative flex items-center">
        {/* Clickable Search Icon / Loading Spinner */}
        <button
          type="button"
          id="navbar-search-btn"
          onClick={handleSearchClick}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#0F9D8C] hover:text-white transition-colors focus:outline-none cursor-pointer"
          title={query.trim() ? `Search for "${query.trim()}"` : 'Search by project ID or name...'}
          aria-label="Search by project ID or name"
        >
          {isLoadingApi ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F9D8C]" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
        </button>

        <input
          ref={inputRef}
          id="navbar-report-search-input"
          type="text"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setIsOpen(val.trim().length > 0);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (query.trim().length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search by project ID or name..."
          className={`w-[200px] sm:w-[230px] md:w-[260px] ${query ? 'pr-6' : 'pr-2.5'} pl-8 py-1.5 rounded-md text-xs bg-[#192A5C] border border-[#354E91] text-white placeholder-slate-300 focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] transition-all`}
        />

        {/* Clear Button (only shown when user has typed) */}
        {query && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
            <button
              type="button"
              id="navbar-search-clear-btn"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
                setApiProjects([]);
                inputRef.current?.focus();
              }}
              className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Live Search Results Dropdown */}
      {isOpen && (
        <div
          id="navbar-report-search-dropdown"
          className="absolute top-full right-0 mt-2 w-[320px] sm:w-[460px] md:w-[500px] lg:w-[540px] bg-white rounded-xl shadow-2xl border border-[#CBD5E1] text-[#1E293B] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header bar of results */}
          <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-2.5 flex items-center justify-between text-[11px] text-[#64748B]">
            <div className="flex items-center gap-1.5 min-w-0">
              {isLoadingApi ? (
                <Loader2 className="w-3.5 h-3.5 text-[#0F9D8C] animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-[#0F9D8C] shrink-0" />
              )}
              <span className="font-semibold text-[#101A3D] truncate">
                {query.trim() ? `Search for "${query}"` : 'Uploaded Reports & Official Documents'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isLoadingApi && (
                <span className="text-[10px] text-[#0F9D8C] font-medium animate-pulse">
                  Searching 1,847 projects...
                </span>
              )}
              <span className="font-medium">
                {totalResults} {totalResults === 1 ? 'result' : 'results'}
              </span>
            </div>
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#F1F5F9] p-2">
            {/* Section 1: Project Reports & Records from MoSPI Dataset */}
            {filteredProjects.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
                  <span>Monitored Infrastructure Projects ({filteredProjects.length})</span>
                  <span className="text-[9px] text-[#0F9D8C] font-normal">Click to View Details</span>
                </div>
                <div className="space-y-1 mt-1">
                  {filteredProjects.map((p, pIdx) => {
                    const globalIdx = filteredDocuments.length + pIdx;
                    const isSelected = selectedIndex === globalIdx;
                    const isCritical = p.risk_level === 'critical';
                    const isHigh = p.risk_level === 'high';

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleProjectClick(p.id)}
                        className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#EBF8F7] border border-[#0F9D8C]/30 text-[#101A3D]'
                            : 'hover:bg-[#F8FAFC] text-[#1E293B]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#101A3D] shrink-0 mt-0.5">
                          <FolderGit2 className="w-4 h-4 text-[#0F9D8C]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                            <span className="font-mono-code font-bold text-[11px] text-[#0F9D8C] bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/60 shrink-0">
                              #{p.id}
                            </span>
                            <span className="font-semibold text-xs text-[#101A3D] truncate">
                              {p.name}
                            </span>
                            {!isNormalUser && (
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 ${
                                  isCritical
                                    ? 'bg-[#FEE2E2] text-[#DC2626]'
                                    : isHigh
                                    ? 'bg-[#FEF3C7] text-[#D97706]'
                                    : 'bg-[#DCFCE7] text-[#16A34A]'
                                }`}
                              >
                                Tier {isCritical ? '1' : isHigh ? '2' : '3'}
                              </span>
                            )}
                            {isNormalUser && p.physical_progress_pct !== undefined && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-[#E6F6F4] text-[#0F9D8C] shrink-0">
                                {p.physical_progress_pct}% Progress
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-[#64748B] mt-0.5 truncate">
                            <span className="truncate">{p.sector}</span>
                            <span>·</span>
                            <span className="truncate">{p.ministry}</span>
                            {p.approved_cost > 0 && (
                              <>
                                <span>·</span>
                                <span className="shrink-0">Budget: ₹{p.approved_cost.toLocaleString()} Cr</span>
                              </>
                            )}
                          </div>
                          {p.cost_overrun_pct && p.cost_overrun_pct > 0 ? (
                            <div className="flex items-center gap-2 text-[10px] text-[#DC2626] mt-0.5 font-medium">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>+{p.cost_overrun_pct}% Cost Overrun</span>
                              {p.delay_months ? <span>· Delay: {p.delay_months} mos</span> : null}
                              {p.physical_progress_pct !== undefined && (
                                <span className="text-slate-500">· {p.physical_progress_pct}% Done</span>
                              )}
                            </div>
                          ) : p.physical_progress_pct !== undefined ? (
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                              <span>Physical Progress: {p.physical_progress_pct}%</span>
                              {p.delay_months ? <span>· Delay: {p.delay_months} mos</span> : null}
                            </div>
                          ) : null}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 self-center" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Uploaded Report Documents */}
            {filteredDocuments.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
                  <span>Uploaded Monthly Reports & Audits ({filteredDocuments.length})</span>
                  <span className="text-[9px] text-[#0F9D8C] font-normal">Click to Inspect</span>
                </div>
                <div className="space-y-1 mt-1">
                  {filteredDocuments.map((doc, idx) => {
                    const isSelected = selectedIndex === idx;
                    const isPdf = doc.fileType === 'pdf';
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => handleDocumentClick(doc)}
                        className={`w-full text-left p-2.5 rounded-lg flex items-start gap-3 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#EBF8F7] border border-[#0F9D8C]/30 text-[#101A3D]'
                            : 'hover:bg-[#F8FAFC] text-[#1E293B]'
                        }`}
                      >
                        <div className="w-8 h-8 rounded bg-[#101A3D] flex items-center justify-center text-[#0F9D8C] shrink-0 mt-0.5">
                          {isPdf ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-[#101A3D] truncate">
                              {doc.title}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] shrink-0 uppercase">
                              {doc.cycle}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] line-clamp-1 mt-0.5">
                            {doc.summary}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-[#94A3B8] mt-1 font-mono-code">
                            <span>{doc.fileName}</span>
                            <span>·</span>
                            <span>{doc.fileSize}</span>
                            <span>·</span>
                            <span className="text-[#0F9D8C] font-semibold">{doc.status}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0 self-center" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Zero results message */}
            {totalResults === 0 && (
              <div className="p-6 text-center text-xs text-[#64748B]">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-[#101A3D]">
                  {isLoadingApi ? 'Searching project registry...' : `No records found for "${query}"`}
                </p>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  {isLoadingApi
                    ? 'Checking 1,847 MoSPI infrastructure projects...'
                    : 'Search by official Project ID (e.g. "705453"), project name (e.g. "Dahod"), or month ("April 2026")'}
                </p>
                {!isLoadingApi && query.trim() && (
                  <button
                    type="button"
                    onClick={() => handleProjectClick(query.trim())}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F9D8C] hover:bg-[#0d8778] text-white text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    <span>Open Project ID #{query.trim()} directly</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer tip bar */}
          <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] px-4 py-2 flex items-center justify-between text-[10px] text-[#94A3B8]">
            <div className="flex items-center gap-3">
              <span>Use <kbd className="px-1 py-0.5 bg-white border border-[#CBD5E1] rounded font-mono text-[9px]">↑</kbd> <kbd className="px-1 py-0.5 bg-white border border-[#CBD5E1] rounded font-mono text-[9px]">↓</kbd> to navigate</span>
              <span><kbd className="px-1 py-0.5 bg-white border border-[#CBD5E1] rounded font-mono text-[9px]">Enter</kbd> to select</span>
              <span><kbd className="px-1 py-0.5 bg-white border border-[#CBD5E1] rounded font-mono text-[9px]">Esc</kbd> to close</span>
            </div>
            <span className="text-[#0F9D8C] font-semibold">1,847 Projects Monitored</span>
          </div>
        </div>
      )}
    </div>
  );
};
