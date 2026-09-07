/// <reference types="vite/client" />
import type {
  ApprovalRequest,
  AuditLogItem,
  AuthResponse,
  AuthUser,
  DailyUpdatePayload,
  DailyUpdateRecord,
} from '../types';

// Detect if running locally in development / local browser
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname === '0.0.0.0');

const envApiUrl = (((import.meta as any).env?.VITE_API_URL as string) || '').trim().replace(/^["']|["']$/g, '');
const isEnvUrlLocalhost = envApiUrl.includes('127.0.0.1') || envApiUrl.includes('localhost');

// In production, NEVER fall back to 127.0.0.1:8000 (which points to the end-user's local computer).
// Only use configured public HTTPS backend URL if available.
// In local development, preserve http://127.0.0.1:8000 fallback so local dev workflow is 100% untouched.
export const API_BASE_URL: string = (!isLocalhost && isEnvUrlLocalhost)
  ? ''
  : (envApiUrl || (isLocalhost ? 'http://127.0.0.1:8000' : ''));

export const IS_LIVE_BACKEND_AVAILABLE: boolean = Boolean(
  isLocalhost ? true : (API_BASE_URL && !isEnvUrlLocalhost)
);

const AUTH_TOKEN_KEY = 'infranetra_auth_token';

let memoryToken: string | null = null;

export function getAuthToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const stored = localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
    if (stored) {
      memoryToken = stored;
      return stored;
    }
  } catch {}
  return null;
}

export function setAuthToken(token: string): void {
  memoryToken = token;
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {}
}

export function clearAuthToken(): void {
  memoryToken = null;
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {}
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers });
}

export interface BackendCheckResponse {
  message: string;
}

export interface ExtractedProjectRecord {
  project_id: string;
  project_name: string;
  agency?: string;
  ministry?: string;
  sector?: string;
  state?: string;
  start_date?: string;
  original_completion_date?: string;
  revised_completion_date?: string;
  actual_completion_date?: string;
  original_cost?: number | null;
  revised_cost?: number | null;
  expenditure?: number | null;
  physical_progress?: number | null;
  report_month: string;
  source_page?: number;
  source_pages?: number[];
  source_section?: string;
}

export interface ValidationReport {
  total_rows_extracted: number;
  valid_project_rows: number;
  summary_rows_removed: number;
  header_rows_removed: number;
  duplicate_rows_detected: number;
  invalid_rows: number;
  records_with_missing_fields: number;
}

export interface CanonicalMetrics {
  raw_rows: number;
  valid_project_rows: number;
  unique_project_count: number;
  projects_appearing_in_multiple_sections: number;
  projects_with_missing_fields: number;
}

export interface IngestFlashReportResponse {
  success: boolean;
  message: string;
  filename: string;
  report_month: string;
  total_pages: number;
  pages_with_text: number;
  records_extracted: number;
  records: ExtractedProjectRecord[];
  canonical_records?: ExtractedProjectRecord[];
  canonical_metrics?: CanonicalMetrics;
  validation_report?: ValidationReport;
  preview?: {
    tables_detected: number;
    text_sample: string;
    sample_records: ExtractedProjectRecord[];
  };
  file_size_bytes?: number;
}

export async function checkBackend(): Promise<BackendCheckResponse> {
  if (!isLocalhost && !API_BASE_URL) {
    throw new Error('Public InfraNetra backend service is not yet deployed. Live backend remains pending.');
  }
  try {
    const response = await fetch(`${API_BASE_URL}/`);
    if (!response.ok) {
      throw new Error(`Backend request failed with status: ${response.status}`);
    }
    return response.json();
  } catch (err: any) {
    if (err?.name === 'TypeError' && (err?.message === 'Failed to fetch' || err?.message?.includes('fetch'))) {
      throw new Error(
        isLocalhost
          ? `Backend unavailable at ${API_BASE_URL}. Ensure FastAPI is running on http://127.0.0.1:8000.`
          : `Live InfraNetra backend at ${API_BASE_URL || 'remote URL'} is currently unreachable.`
      );
    }
    throw err;
  }
}

export async function uploadFlashReport(
  file: File,
  reportMonth: string
): Promise<IngestFlashReportResponse> {
  if (!isLocalhost && !API_BASE_URL) {
    throw new Error('Public InfraNetra backend service is not yet deployed. Live backend remains pending.');
  }
  const normMonthDate = formatReportMonthDate(reportMonth);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('report_month', normMonthDate);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/ingest-flash-report`, {
      method: 'POST',
      body: formData,
      // Do NOT manually set Content-Type header so browser sets multipart boundary automatically
    });
  } catch (netErr: any) {
    if (netErr?.name === 'TypeError' && (netErr?.message === 'Failed to fetch' || netErr?.message?.includes('fetch'))) {
      throw new Error(
        isLocalhost
          ? `Backend unavailable at ${API_BASE_URL}. Please ensure FastAPI is running on http://127.0.0.1:8000.`
          : `Live InfraNetra backend at ${API_BASE_URL || 'remote URL'} is currently unreachable.`
      );
    }
    throw netErr;
  }

  if (!response.ok) {
    let errorDetail = `Upload failed with HTTP ${response.status}`;
    try {
      const errorJson = await response.json();
      if (errorJson?.detail) {
        errorDetail = errorJson.detail;
      }
    } catch {
      // response was not JSON
    }

    if (response.status === 404) {
      throw new Error(`Endpoint not found (POST /api/ingest-flash-report). Verify backend route.`);
    } else if (response.status === 400) {
      throw new Error(`Invalid PDF: ${errorDetail}`);
    } else if (response.status === 500) {
      throw new Error(`HTTP 500: PDF extraction failed (${errorDetail})`);
    }

    throw new Error(errorDetail);
  }

  return response.json();
}

export interface SaveDatasetResponse {
  success: boolean;
  report_month: string;
  records_received: number;
  records_inserted_or_updated: number;
  failed_records: number;
  storage_backend?: string;
  supabase_connected?: boolean;
}

export interface DatasetSummaryResponse {
  report_month: string;
  total_projects: number;
  total_original_cost?: number;
  total_revised_cost?: number;
  total_expenditure?: number;
  supabase_connected: boolean;
  storage_backend?: string;
  verified_at?: string;
}

/**
 * Formats report month strings like '2026-04', '2026-05', '2026-05-01', or 'May 2026'
 * into readable 'Month Year' (e.g. 'April 2026', 'May 2026').
 * Does NOT hard-code month names; uses Intl.DateTimeFormat with UTC dates.
 */
export function formatReportMonth(rawMonth?: string): string {
  if (!rawMonth) return 'April 2026';
  const trimmed = rawMonth.trim();

  // If already in 'Month Year' format
  if (/^[A-Za-z]+ \d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // Match YYYY-MM or YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const monthIndex = parseInt(isoMatch[2], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      const d = new Date(Date.UTC(year, monthIndex, 1));
      const monthName = d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
      return `${monthName} ${year}`;
    }
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }

  return trimmed;
}

/**
 * Normalizes report month to ISO 'YYYY-MM' format for snapshot identification and API params.
 */
export function formatSnapshotCycle(rawMonth?: string): string {
  if (!rawMonth) return '2026-04';
  const trimmed = rawMonth.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}`;
  }

  const months: Record<string, string> = {
    january: '01', jan: '01',
    february: '02', feb: '02',
    march: '03', mar: '03',
    april: '04', apr: '04',
    may: '05',
    june: '06', jun: '06',
    july: '07', jul: '07',
    august: '08', aug: '08',
    september: '09', sep: '09', sept: '09',
    october: '10', oct: '10',
    november: '11', nov: '11',
    december: '12', dec: '12',
  };

  const parts = trimmed.toLowerCase().split(/\s+/);
  if (parts.length === 2) {
    if (months[parts[0]] && /^\d{4}$/.test(parts[1])) {
      return `${parts[1]}-${months[parts[0]]}`;
    }
    if (months[parts[1]] && /^\d{4}$/.test(parts[0])) {
      return `${parts[0]}-${months[parts[1]]}`;
    }
  }

  // Check any month name occurrence
  const lower = trimmed.toLowerCase();
  for (const [mName, mNum] of Object.entries(months)) {
    if (new RegExp(`\\b${mName}\\b`).test(lower) || lower === mName) {
      const yrMatch = lower.match(/\b(20\d{2})\b/);
      const yr = yrMatch ? yrMatch[1] : '2026';
      return `${yr}-${mNum}`;
    }
  }

  return '2026-04';
}

/**
 * Normalizes report month to ISO 'YYYY-MM-01' format for exact database column persistence and API payloads.
 */
export function formatReportMonthDate(rawMonth?: string): string {
  if (!rawMonth) return '2026-04-01';
  const trimmed = rawMonth.trim();
  const fullMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (fullMatch) {
    return `${fullMatch[1]}-${fullMatch[2].padStart(2, '0')}-01`;
  }
  const cycle = formatSnapshotCycle(trimmed);
  return `${cycle}-01`;
}

export interface AvailableMonthItem {
  report_month: string;
  label: string;
  project_count: number;
  record_count?: number;
  available?: boolean;
}

export async function getAvailableMonths(): Promise<AvailableMonthItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/months`);
  if (!response.ok) {
    throw new Error(`Failed to fetch available months: HTTP ${response.status}`);
  }
  return response.json();
}

export interface MonthDatasetStatus {
  report_month: string;
  label: string;
  available: boolean;
  record_count: number;
}

export interface DatasetsMonthsResponse {
  months: MonthDatasetStatus[];
}

export async function getDatasetsMonths(): Promise<DatasetsMonthsResponse> {
  const response = await fetch(`${API_BASE_URL}/api/datasets/months`);
  if (!response.ok) {
    throw new Error(`Failed to fetch dataset months: HTTP ${response.status}`);
  }
  return response.json();
}

export async function saveDataset(
  reportMonth: string,
  records?: ExtractedProjectRecord[]
): Promise<SaveDatasetResponse> {
  const normMonthDate = formatReportMonthDate(reportMonth);
  const response = await fetch(`${API_BASE_URL}/api/datasets/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      report_month: normMonthDate,
      records: records && records.length > 0 ? records : undefined,
    }),
  });

  if (!response.ok) {
    let errDetail = `Save failed with HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.detail) errDetail = errJson.detail;
    } catch {}
    throw new Error(errDetail);
  }

  return response.json();
}

export async function saveAprilDataset(records?: ExtractedProjectRecord[]): Promise<SaveDatasetResponse> {
  return saveDataset('2026-04', records);
}

export async function getDatasetSummary(reportMonth: string = '2026-04'): Promise<DatasetSummaryResponse> {
  const normMonth = formatSnapshotCycle(reportMonth);
  const response = await fetch(`${API_BASE_URL}/api/datasets/${normMonth}/summary`);
  if (!response.ok) {
    throw new Error(`Failed to fetch database summary: HTTP ${response.status}`);
  }
  return response.json();
}

// =====================================================================
// DYNAMIC ENDPOINTS CONNECTED DIRECTLY TO DATABASE
// =====================================================================

export interface DashboardMetrics {
  total_monitored_projects: number;
  total_original_cost_cr: number;
  total_revised_cost_cr: number;
  total_cost_overrun_cr: number;
  cost_overrun_pct: number;
  projects_with_cost_overrun: number;
  total_expenditure_cr: number;
  expenditure_pct_of_revised: number;
  projects_with_time_overrun: number;
  projects_ongoing: number;
  projects_completed: number;
}

export interface SectorMetric {
  sector: string;
  project_count: number;
  original_cost: number;
  revised_cost: number;
  cost_overrun_amount: number;
  expenditure: number;
  cost_overrun_count: number;
  time_overrun_count: number;
}

export interface TopProjectItem {
  project_id: string;
  project_name: string;
  sector: string;
  state: string;
  original_cost: number;
  revised_cost: number;
  overrun_amount: number;
  cost_overrun_pct: number;
  delay_months: number;
  risk_score: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  physical_progress?: number | null;
}

export interface DashboardSummaryData {
  report_month: string;
  report_month_label: string;
  available_months: MonthDatasetStatus[];
  metrics: DashboardMetrics;
  risk_distribution: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  sector_breakdown: SectorMetric[];
  top_cost_overruns: TopProjectItem[];
  top_critical_projects: TopProjectItem[];
}

export async function getDashboardSummary(reportMonth?: string): Promise<DashboardSummaryData> {
  const q = reportMonth ? `?report_month=${encodeURIComponent(formatReportMonthDate(reportMonth))}` : '';
  const res = await authFetch(`${API_BASE_URL}/api/dashboard/summary${q}`);
  if (!res.ok) throw new Error(`Dashboard summary request failed: ${res.status}`);
  return res.json();
}

export interface RegistryProject {
  project_id: string;
  project_name: string;
  agency: string;
  ministry: string;
  sector: string;
  state: string;
  status: 'Completed' | 'Ongoing';
  start_date: string;
  original_completion_date: string;
  revised_completion_date: string;
  actual_completion_date: string;
  original_cost: number | null;
  revised_cost: number | null;
  cost_overrun_amount: number;
  cost_overrun_pct: number;
  expenditure: number | null;
  physical_progress: number | null;
  delay_months: number;
  progress_delta?: number | null;
  risk_score: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  report_month: string;
}

export interface ProjectsRegistryResponse {
  projects: RegistryProject[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  report_month: string;
}

export async function getProjectsRegistry(params: {
  reportMonth?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sector?: string;
  state?: string;
  status?: string;
  riskLevel?: string;
  sortBy?: string;
  sortDir?: string;
} = {}): Promise<ProjectsRegistryResponse> {
  const query = new URLSearchParams();
  if (params.reportMonth) query.set('report_month', formatReportMonthDate(params.reportMonth));
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('page_size', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.sector && params.sector !== 'all') query.set('sector', params.sector);
  if (params.state && params.state !== 'all') query.set('state', params.state);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.riskLevel && params.riskLevel !== 'ALL') query.set('risk_level', params.riskLevel);
  if (params.sortBy) query.set('sort_by', params.sortBy);
  if (params.sortDir) query.set('sort_dir', params.sortDir);

  const res = await authFetch(`${API_BASE_URL}/api/projects?${query.toString()}`);
  if (!res.ok) throw new Error(`Projects query failed: ${res.status}`);
  return res.json();
}

export interface ProjectSnapshotDetail {
  report_month: string;
  report_month_label: string;
  original_cost: number | null;
  revised_cost: number | null;
  cost_overrun_amount: number;
  cost_overrun_pct: number;
  expenditure: number | null;
  physical_progress: number | null;
  original_completion_date: string | null;
  revised_completion_date: string | null;
  actual_completion_date: string | null;
  source_section?: string;
  source_pages?: string;
}

export interface LiveScheduleRisk {
  schedule_analysis_available: boolean;
  unavailability_reason?: string | null;
  is_completed?: boolean;
  start_date?: string | null;
  original_completion_date?: string | null;
  revised_completion_date?: string | null;
  actual_completion_date?: string | null;
  today: string;
  planned_duration_days?: number | null;
  elapsed_days?: number | null;
  time_elapsed_baseline_percentage?: number | null;
  elapsed_percentage?: number | null;
  physical_progress_percentage?: number | null;
  progress_gap?: number | null;
  progress_gap_label?: string;
  time_elapsed_label?: string;
  active_deadline_type: 'ORIGINAL' | 'REVISED' | 'NONE';
  active_deadline?: string | null;
  days_to_active_deadline?: number | null;
  days_to_original_deadline?: number | null;
  days_to_revised_deadline?: number | null;
  extension_days?: number | null;
  extension_label?: string;
  original_deadline_status: string;
  revised_deadline_status: string;
  deadline_display_status?: string;
  schedule_risk_score: number;
  schedule_risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  schedule_risk_reasons: string[];
  score_breakdown?: {
    deadline_status_score: number;
    progress_gap_score: number;
    deadline_proximity_score: number;
    schedule_extension_score: number;
  };
  disclaimer?: string;
}

export interface ProjectDetailResponse {
  project_id: string;
  project_name: string;
  agency: string;
  ministry: string;
  sector: string;
  state: string;
  status: 'Completed' | 'Ongoing';
  start_date: string;
  original_completion_date: string;
  revised_completion_date: string;
  actual_completion_date: string;
  financials: {
    original_cost_cr: number | null;
    revised_cost_cr: number | null;
    cost_overrun_amount_cr: number;
    cost_overrun_pct: number;
    expenditure_cr: number | null;
    physical_progress_pct: number | null;
  };
  schedule: {
    delay_months: number;
    progress_delta?: number | null;
  };
  risk_assessment: {
    score: number;
    level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    cost_overrun_pct: number;
    delay_months: number;
    progress_delta?: number | null;
    components: {
      cost_overrun_score: number;
      schedule_extension_score: number;
      progress_velocity_score: number;
      capital_exposure_score: number;
    };
  };
  early_warnings: EarlyWarningSignal[];
  ml_predictions: {
    predicted_cost_overrun_pct: number;
    predicted_escalation_amount_cr: number;
    predicted_delay_months: number;
    model_confidence: {
      cost_prediction: number;
      delay_prediction: number;
    };
    key_risk_drivers: string[];
  };
  live_schedule_risk?: LiveScheduleRisk;
  snapshots: ProjectSnapshotDetail[];
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetailResponse> {
  const cleanId = encodeURIComponent(projectId.trim());
  const res = await authFetch(`${API_BASE_URL}/api/projects/${cleanId}`);
  if (!res.ok) throw new Error(`Project detail fetch failed: ${res.status}`);
  return res.json();
}

export interface CreateProjectPayload {
  project_name: string;
  project_id?: string;
  agency?: string;
  sector?: string;
  state?: string;
  original_cost?: number;
  revised_cost?: number;
  start_date?: string;
  original_completion_date?: string;
  report_month?: string;
  assign_pm?: boolean;
  pm_username?: string;
  pm_password?: string;
  pm_email?: string;
  pm_full_name?: string;
  pm_phone?: string;
  pm_designation?: string;
}

export async function createProject(
  payload: CreateProjectPayload
): Promise<{ success: boolean; message: string; project: any; pm_user?: any }> {
  const res = await authFetch(`${API_BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Failed to create project (${res.status})` }));
    throw new Error(err.detail || 'Failed to create project');
  }
  return res.json();
}

export interface MapMarkerProject {
  project_id: string;
  project_name: string;
  sector: string;
  state: string;
  lat: number;
  lng: number;
  location_accuracy: string;
  original_cost: number;
  revised_cost: number;
  expenditure: number | null;
  physical_progress: number | null;
  delay_months: number;
  risk_score: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'Completed' | 'Ongoing';
}

export interface StateAggregate {
  state: string;
  project_count: number;
  total_cost_cr: number;
  critical_projects: number;
  average_delay_months: number;
}

export interface MapProjectsResponse {
  report_month: string;
  total_markers: number;
  markers: MapMarkerProject[];
  state_aggregates: StateAggregate[];
}

export async function getMapProjects(reportMonth?: string): Promise<MapProjectsResponse> {
  const q = reportMonth ? `?report_month=${encodeURIComponent(formatReportMonthDate(reportMonth))}` : '';
  const res = await authFetch(`${API_BASE_URL}/api/map/projects${q}`);
  if (!res.ok) throw new Error(`Map projects query failed: ${res.status}`);
  return res.json();
}

export interface EarlyWarningSignal {
  id: string;
  project_id: string;
  project_name: string;
  category: 'COST_ESCALATION' | 'SCHEDULE_EXTENSION' | 'PROGRESS_DECLINE' | 'PROGRESS_STAGNATION' | 'EXPENDITURE_DIVERGENCE';
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  metric: string;
  report_month: string;
}

export interface EarlyWarningsResponse {
  report_month: string;
  total_warnings: number;
  warnings: EarlyWarningSignal[];
}

export async function getEarlyWarnings(params: {
  reportMonth?: string;
  severity?: string;
  limit?: number;
} = {}): Promise<EarlyWarningsResponse> {
  const query = new URLSearchParams();
  if (params.reportMonth) query.set('report_month', formatReportMonthDate(params.reportMonth));
  if (params.severity && params.severity !== 'ALL') query.set('severity', params.severity);
  if (params.limit) query.set('limit', String(params.limit));

  const res = await authFetch(`${API_BASE_URL}/api/early-warnings?${query.toString()}`);
  if (!res.ok) throw new Error(`Early warnings query failed: ${res.status}`);
  return res.json();
}

export interface MonthlyTrendItem {
  report_month: string;
  label: string;
  project_count: number;
  original_cost_cr: number;
  revised_cost_cr: number;
  cost_overrun_cr: number;
  cost_overrun_pct: number;
  expenditure_cr: number;
  cost_overrun_projects: number;
  delayed_projects: number;
}

export async function getMonthlyAnalytics(): Promise<{ monthly_trends: MonthlyTrendItem[] }> {
  const res = await fetch(`${API_BASE_URL}/api/analytics/monthly`);
  if (!res.ok) throw new Error(`Monthly analytics query failed: ${res.status}`);
  return res.json();
}

export interface MLTrainingStatsResponse {
  total_infrastructure_rows: number;
  rows_with_valid_actual_date: number;
  rows_with_valid_original_date: number;
  rows_with_valid_revised_date: number;
  valid_time_training_records: number;
  time_overrun_projects: number;
  valid_cost_training_records: number;
  cost_overrun_projects: number;
  cost_model_mae_pct?: number;
  time_model_mae_months?: number;
  time_training_constraint?: string;
}

export async function getMLTrainingStats(): Promise<MLTrainingStatsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ml/training-stats`);
  if (!res.ok) throw new Error(`ML training stats query failed: ${res.status}`);
  return res.json();
}

export async function predictProjectRisk(projectId: string, payload?: any): Promise<any> {
  const cleanId = encodeURIComponent(projectId.trim());
  const res = await fetch(`${API_BASE_URL}/api/ml/predict/${cleanId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) throw new Error(`ML prediction failed: ${res.status}`);
  return res.json();
}

// =====================================================================
// AUTHENTICATION & ACCESS CONTROL APIS
// =====================================================================

export async function loginAdmin(payload: {
  username: string;
  password: string;
  full_name?: string;
  email?: string;
  designation?: string;
  department?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login/admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Login failed (${res.status})` }));
    throw new Error(err.detail || 'Admin authentication failed');
  }
  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function updateProfile(data: {
  full_name?: string;
  email?: string;
  designation?: string;
  department?: string;
}): Promise<{ success: boolean; user: AuthUser }> {
  const res = await authFetch(`${API_BASE_URL}/api/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Profile update failed (${res.status})` }));
    throw new Error(err.detail || 'Profile update failed');
  }
  return res.json();
}

export async function loginMinistry(payload: { username: string; password: string; ministry: string }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login/ministry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Login failed (${res.status})` }));
    throw new Error(err.detail || 'Ministry authentication failed');
  }
  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function loginProjectManager(payload: { username: string; password: string; project_id: number | string }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login/pm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Login failed (${res.status})` }));
    throw new Error(err.detail || 'Project Manager authentication failed');
  }
  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function registerMinistry(payload: {
  username: string;
  password: string;
  email: string;
  full_name: string;
  ministry: string;
  phone?: string;
  designation?: string;
  clerk_user_id?: string;
}): Promise<{ message: string; user_id: number; status: string }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register/ministry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Registration failed (${res.status})` }));
    throw new Error(err.detail || 'Ministry registration failed');
  }
  return res.json();
}

export async function registerProjectManager(payload: {
  username: string;
  password: string;
  email: string;
  full_name: string;
  project_id: number | string;
  phone?: string;
  designation?: string;
  clerk_user_id?: string;
}): Promise<{ message: string; user_id: number; status: string }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register/pm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Registration failed (${res.status})` }));
    throw new Error(err.message || err.detail || 'Project Manager registration failed');
  }
  return res.json();
}

export async function loginClerk(clerkToken: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login/clerk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${clerkToken}`,
    },
    body: JSON.stringify({ clerk_token: clerkToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Clerk authentication failed (${res.status})` }));
    throw new Error(err.detail || 'Clerk authentication failed');
  }
  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function getCurrentUser(): Promise<{ user: AuthUser }> {
  const res = await authFetch(`${API_BASE_URL}/api/auth/me`);
  if (!res.ok) {
    clearAuthToken();
    const err = await res.json().catch(() => ({ detail: `Failed to verify session (${res.status})` }));
    throw new Error(err.detail || 'Session invalid');
  }
  return res.json();
}

export async function logoutUser(): Promise<{ message: string }> {
  try {
    const res = await authFetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
    clearAuthToken();
    return res.json();
  } catch {
    clearAuthToken();
    return { message: 'Logged out' };
  }
}

// =====================================================================
// ADMIN APPROVALS & AUDIT LOGS
// =====================================================================

export async function getAdminPendingApprovals(): Promise<{ pending_users: ApprovalRequest[] }> {
  const res = await authFetch(`${API_BASE_URL}/api/admin/approvals/pending`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Failed to fetch approvals (${res.status})` }));
    throw new Error(err.detail || 'Failed to fetch pending approvals');
  }
  const data = await res.json();

  // Primary path: backend now returns pending_users (unified list)
  if (Array.isArray(data.pending_users)) {
    return { pending_users: data.pending_users as ApprovalRequest[] };
  }

  // Fallback path: legacy backend returns separate ministries + managers arrays.
  // Merge them here so the frontend always receives a unified pending_users list.
  const ministryUsers: ApprovalRequest[] = (data.ministries || []).map((r: any) => ({
    id: r.id ?? r.user_id,
    username: r.username ?? '',
    full_name: r.full_name ?? '',
    email: r.email ?? '',
    role: 'MINISTRY' as const,
    status: (r.status ?? 'PENDING') as any,
    created_at: r.created_at ?? r.registration_date ?? '',
    ministry: r.assigned_ministry ?? r.ministry ?? r.selected_ministry ?? '',
    designation: r.designation ?? null,
    phone: r.phone ?? null,
  }));

  const managerUsers: ApprovalRequest[] = (data.managers || []).map((r: any) => ({
    id: r.id ?? r.user_id,
    username: r.username ?? '',
    full_name: r.full_name ?? '',
    email: r.email ?? '',
    role: 'PROJECT_MANAGER' as const,
    status: (r.status ?? 'PENDING') as any,
    created_at: r.created_at ?? r.registration_date ?? '',
    ministry: r.ministry ?? '',
    designation: r.designation ?? null,
    phone: r.phone ?? null,
    project_id: r.project_id ?? null,
    project_code: r.project_code ?? (r.project_id ? String(r.project_id) : null),
    project_name: r.project_name ?? null,
  }));

  const merged = [...ministryUsers, ...managerUsers].sort((a, b) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? '')
  );

  return { pending_users: merged };
}

export async function approveUserByAdmin(
  userId: number,
  role: string,
  assignmentId?: number
): Promise<{ message: string; user_id: number; status: string }> {
  const res = await authFetch(`${API_BASE_URL}/api/admin/approvals/${userId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, assignment_id: assignmentId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Approval failed (${res.status})` }));
    throw new Error(err.message || err.detail || 'Approval failed');
  }
  return res.json();
}

export async function rejectUserByAdmin(
  userId: number,
  reason?: string
): Promise<{ message: string; user_id: number; status: string }> {
  const res = await authFetch(`${API_BASE_URL}/api/admin/approvals/${userId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || 'Rejected by administrator' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Rejection failed (${res.status})` }));
    throw new Error(err.detail || 'Rejection failed');
  }
  return res.json();
}

export async function suspendUserByAdmin(
  userId: number,
  reason?: string
): Promise<{ message: string; user_id: number; status: string }> {
  const res = await authFetch(`${API_BASE_URL}/api/admin/approvals/${userId}/suspend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || 'Suspended by administrator' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Suspension failed (${res.status})` }));
    throw new Error(err.detail || 'Suspension failed');
  }
  return res.json();
}

export async function getAdminAuditLogs(limit: number = 100, offset: number = 0): Promise<{ logs: AuditLogItem[] }> {
  const res = await authFetch(`${API_BASE_URL}/api/admin/audit-logs?limit=${limit}&offset=${offset}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Audit logs request failed (${res.status})` }));
    throw new Error(err.detail || 'Audit logs request failed');
  }
  return res.json();
}

// =====================================================================
// MINISTRY MANAGER APPROVALS
// =====================================================================

export async function getMinistryPendingManagers(): Promise<{ pending_managers: ApprovalRequest[] }> {
  const res = await authFetch(`${API_BASE_URL}/api/ministry/managers/pending`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Failed to fetch manager approvals (${res.status})` }));
    throw new Error(err.detail || 'Failed to fetch manager approvals');
  }
  return res.json();
}

export async function approveManagerByMinistry(
  userId: number,
  projectId?: number
): Promise<{ message: string; user_id: number; status: string }> {
  const res = await authFetch(`${API_BASE_URL}/api/ministry/managers/${userId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Manager approval failed (${res.status})` }));
    throw new Error(err.message || err.detail || 'Manager approval failed');
  }
  return res.json();
}

export async function rejectManagerByMinistry(
  userId: number,
  reason?: string
): Promise<{ message: string; user_id: number; status: string }> {
  const res = await authFetch(`${API_BASE_URL}/api/ministry/managers/${userId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || 'Rejected by ministry authority' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Manager rejection failed (${res.status})` }));
    throw new Error(err.detail || 'Manager rejection failed');
  }
  return res.json();
}

export async function suspendManagerByMinistry(
  userId: number,
  reason?: string
): Promise<{ message: string; user_id: number; status: string }> {
  const res = await authFetch(`${API_BASE_URL}/api/ministry/managers/${userId}/suspend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || 'Suspended by ministry authority' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Manager suspension failed (${res.status})` }));
    throw new Error(err.detail || 'Manager suspension failed');
  }
  return res.json();
}

// =====================================================================
// PROJECT MANAGER DAILY UPDATES
// =====================================================================

export async function submitDailyProjectUpdate(
  payload: DailyUpdatePayload
): Promise<{ message: string; update: DailyUpdateRecord }> {
  const res = await authFetch(`${API_BASE_URL}/api/pm/daily-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Daily update failed (${res.status})` }));
    throw new Error(err.detail || 'Daily update submission failed');
  }
  return res.json();
}

export async function getProjectDailyUpdates(
  projectId: number
): Promise<{ project_id: number; updates: DailyUpdateRecord[] }> {
  const res = await authFetch(`${API_BASE_URL}/api/pm/daily-updates/${projectId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Daily updates fetch failed (${res.status})` }));
    throw new Error(err.detail || 'Daily updates fetch failed');
  }
  return res.json();
}

export interface ProjectLookupResult {
  found: boolean;
  project_id: string;
  project_name: string;
  ministry: string;
  approval_authority: string;
  has_active_pm: boolean;
  active_pm_username?: string | null;
}

export async function lookupProject(projectId: string): Promise<ProjectLookupResult> {
  const cleanId = encodeURIComponent(projectId.trim());
  const res = await fetch(`${API_BASE_URL}/api/projects/lookup/${cleanId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Project ID not found in the InfraNetra project registry.' }));
    throw new Error(err.detail || 'Project ID not found in the InfraNetra project registry.');
  }
  return res.json();
}

export interface MinistryVerificationResult {
  valid: boolean;
  ministry: string;
  message: string;
}

export async function getMinistriesList(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/api/ministries/list`);
  if (!res.ok) {
    throw new Error('Failed to fetch authoritative ministries list');
  }
  const data = await res.json();
  return data.ministries || [];
}

export async function verifyMinistry(name: string): Promise<MinistryVerificationResult> {
  const cleanName = encodeURIComponent(name.trim());
  const res = await fetch(`${API_BASE_URL}/api/ministries/verify?name=${cleanName}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Ministry not found in the InfraNetra Ministry registry.' }));
    throw new Error(err.detail || 'Ministry not found in the InfraNetra Ministry registry.');
  }
  return res.json();
}

