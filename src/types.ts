export type RiskTier = 'low' | 'medium' | 'high' | 'critical';

export interface Project {
  project_code: string; // PK e.g. MORTH-NH44-PKG4
  name: string;
  ministry: string;
  sector: string;
  state: string;
  approved_cost: number; // in Rs. Crores
  epc_contractor: string | null;
  sanction_date?: string;
  target_completion?: string;
  nodal_officer?: string | null;
  length_or_capacity?: string;
}

export interface ProjectMonthlySnapshot {
  id: string;
  project_code: string;
  report_month: string;
  revised_cost: number; // in Rs. Crores
  expenditure: number; // in Rs. Crores
  physical_progress_pct: number; // 0-100
  expected_progress_pct: number; // 0-100
  time_risk: number; // 0-100
  cost_risk: number; // 0-100
  implementation_risk: number; // 0-100
  overall_risk: number; // 0-100
  risk_tier: RiskTier;
  delay_months: number;
  cost_overrun_pct: number;
  last_updated_relative: string;
  last_updated_absolute: string;
}

export interface EarlyWarning {
  id: string;
  project_code: string;
  report_month: string;
  severity: RiskTier;
  detected_signals: string[];
  recommended_action: string;
  dismissed: boolean;
  created_at: string;
}

export interface ParseJob {
  id: string;
  report_month: string;
  uploaded_by: string;
  status: 'processing' | 'completed' | 'failed';
  rows_total: number;
  rows_matched: number;
  rows_failed: number;
  warnings: string[];
  unmatched_rows?: {
    row_num: number;
    raw_project_name: string;
    ministry: string;
    reason: string;
  }[];
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: string;
  email: string;
  department: string;
  designation?: string | null;
  authUser?: AuthUser;
}

export interface ProjectWithSnapshot extends Project {
  latest_snapshot: ProjectMonthlySnapshot;
  active_warnings_count: number;
  warnings: EarlyWarning[];
  historical_snapshots: ProjectMonthlySnapshot[];
}

export interface FilterState {
  search: string;
  ministry: string;
  sector: string;
  state: string;
  risk_tier: string;
  sort_by: string;
  sort_order: 'asc' | 'desc';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  referenced_project_codes?: string[];
  suggested_followups?: string[];
}

export interface UploadedReportDocument {
  id: string;
  title: string;
  cycle: string;
  fileName: string;
  fileType: 'pdf' | 'xlsx' | 'csv';
  fileSize: string;
  uploadedAt: string;
  uploadedBy: string;
  department: string;
  totalProjects: number;
  matchedCount: number;
  flaggedCount: number;
  status: 'Audited & Ingested' | 'OCR Parsed' | 'Discrepancies Flagged';
  summary: string;
  highlights: string[];
}

export type UserRole = 'ADMIN' | 'MINISTRY' | 'PROJECT_MANAGER' | 'PUBLIC';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  assigned_ministry?: string | null;
  assigned_project_id?: number | null;
  assigned_project_code?: string | null;
  assigned_project_name?: string | null;
  created_at?: string;
  approved_at?: string | null;
  clerk_user_id?: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  expires_in?: number;
}

export interface ApprovalRequest {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  ministry?: string | null;
  designation?: string | null;
  phone?: string | null;
  project_id?: number | null;
  project_code?: string | null;
  project_name?: string | null;
}

export interface AuditLogItem {
  id: number;
  actor_user_id: number | null;
  actor_username: string | null;
  actor_role: string | null;
  action: string;
  target_resource: string | null;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface DailyUpdatePayload {
  update_date?: string;
  today_physical_progress: number;
  cumulative_physical_progress?: number;
  today_expenditure_cr: number;
  cumulative_expenditure_cr?: number;
  current_milestone?: string;
  milestone_status?: 'ON_SCHEDULE' | 'DELAYED' | 'COMPLETED';
  target_completion_date?: string;
  issues_risks?: string;
  remarks?: string;
}

export interface DailyUpdateRecord {
  id: number;
  project_id: number;
  manager_user_id: number;
  update_date: string;
  today_physical_progress: number;
  cumulative_physical_progress: number;
  today_expenditure_cr: number;
  cumulative_expenditure_cr: number;
  current_milestone: string | null;
  milestone_status: string | null;
  target_completion_date: string | null;
  issues_risks: string | null;
  remarks: string | null;
  recalculated_overall_risk: number | null;
  recalculated_risk_tier: string | null;
  recalculated_anomaly_score: number | null;
  recalculated_ml_prediction: string | null;
  created_at: string;
  updated_at: string;
}
