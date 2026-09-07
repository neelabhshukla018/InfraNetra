import React, { useState, useEffect } from 'react';
import {
  Shield,
  LayoutDashboard,
  Clock,
  UserCheck,
  Users,
  AlertTriangle,
  CheckCircle2,
  Lock,
  LogOut,
  ArrowLeft,
  KeyRound,
  FileText,
  Search,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  ShieldCheck,
  Server,
  Activity,
} from 'lucide-react';
import { Profile, ApprovalRequest, AuditLogItem } from '../types';
import {
  getAdminPendingApprovals,
  approveUserByAdmin,
  rejectUserByAdmin,
  suspendUserByAdmin,
  getAdminAuditLogs,
} from '../services/api';

interface AdminCenterPageProps {
  currentProfile: Profile | null;
  onNavigate: (page: any) => void;
  onLogout: () => void;
}

type AdminTab = 'dashboard' | 'approvals' | 'audit_logs' | 'user_and_time' | 'profile_security';

interface ActivityLogItem {
  id: string;
  timestamp: string;
  user: string;
  department: string;
  activity: string;
  status: 'Completed' | 'Success' | 'Logged' | 'Pending Approval';
}

const INITIAL_ACTIVITIES: ActivityLogItem[] = [
  {
    id: 'act-1',
    timestamp: '06 Sep 2026, 14:48 IST',
    user: 'Dr. Rajeshwar Sharma, IAS',
    department: 'MoSPI IPMD',
    activity: 'Published July 2026 Flash Report Snapshot (2,101 Projects)',
    status: 'Success',
  },
  {
    id: 'act-2',
    timestamp: '06 Sep 2026, 12:15 IST',
    user: 'Er. Sunil Gokhale',
    department: 'MoRTH Highways',
    activity: 'Reviewed 18 Cost Overrun Warnings for Delhi-Mumbai Corridor',
    status: 'Logged',
  },
  {
    id: 'act-3',
    timestamp: '06 Sep 2026, 09:14 IST',
    user: 'Dr. Rajeshwar Sharma, IAS',
    department: 'MoSPI IPMD',
    activity: 'Administrator Two-Factor Verification Session Started',
    status: 'Success',
  },
  {
    id: 'act-4',
    timestamp: '05 Sep 2026, 17:30 IST',
    user: 'R. K. Verma, Chief Engineer',
    department: 'Railway Board',
    activity: 'Queried High Risk Critical Milestone Milestones',
    status: 'Logged',
  },
  {
    id: 'act-5',
    timestamp: '05 Sep 2026, 15:45 IST',
    user: 'A. K. Singhal, Dir.',
    department: 'MoPNG Monitoring',
    activity: 'Exported Gas Pipeline Infrastructure Dossier',
    status: 'Completed',
  },
  {
    id: 'act-6',
    timestamp: '05 Sep 2026, 11:20 IST',
    user: 'Automated Risk Bot',
    department: 'Platform Engine',
    activity: 'Scheduled Machine Learning Recalculation Run',
    status: 'Success',
  },
  {
    id: 'act-7',
    timestamp: '04 Sep 2026, 16:10 IST',
    user: 'V. Ramanathan',
    department: 'NHAI Project Cell',
    activity: 'Requested Agency Officer Registration Verification',
    status: 'Pending Approval',
  },
];

export const AdminCenterPage: React.FC<AdminCenterPageProps> = ({
  currentProfile,
  onNavigate,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Real backend approvals & audit states
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [processingUserId, setProcessingUserId] = useState<number | null>(null);

  const fetchPendingApprovals = async () => {
    setApprovalsLoading(true);
    setApprovalError(null);
    try {
      const data = await getAdminPendingApprovals();
      setPendingApprovals(data.pending_users || []);
    } catch (err: any) {
      setApprovalError(err?.message || 'Failed to load pending registrations.');
    } finally {
      setApprovalsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLogsLoading(true);
    try {
      const data = await getAdminAuditLogs(100, 0);
      setAuditLogs(data.logs || []);
    } catch (err: any) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
    fetchAuditLogs();
  }, []);

  const handleAdminApprove = async (req: ApprovalRequest) => {
    setProcessingUserId(req.id);
    setApprovalFeedback(null);
    setApprovalError(null);
    try {
      await approveUserByAdmin(req.id, req.role, req.project_id || undefined);
      setApprovalFeedback(`Successfully approved ${req.role} user "${req.username}".`);
      await fetchPendingApprovals();
      await fetchAuditLogs();
    } catch (err: any) {
      setApprovalError(err?.message || 'Approval action failed.');
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleAdminReject = async (req: ApprovalRequest) => {
    const reason = window.prompt(`Enter rejection reason for ${req.username}:`, 'Rejected by Administrator');
    if (reason === null) return;
    setProcessingUserId(req.id);
    setApprovalFeedback(null);
    setApprovalError(null);
    try {
      await rejectUserByAdmin(req.id, reason);
      setApprovalFeedback(`User "${req.username}" was rejected.`);
      await fetchPendingApprovals();
      await fetchAuditLogs();
    } catch (err: any) {
      setApprovalError(err?.message || 'Rejection failed.');
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleAdminSuspend = async (req: ApprovalRequest) => {
    const reason = window.prompt(`Enter suspension reason for ${req.username}:`, 'Suspended by Administrator');
    if (reason === null) return;
    setProcessingUserId(req.id);
    setApprovalFeedback(null);
    setApprovalError(null);
    try {
      await suspendUserByAdmin(req.id, reason);
      setApprovalFeedback(`User "${req.username}" has been suspended.`);
      await fetchPendingApprovals();
      await fetchAuditLogs();
    } catch (err: any) {
      setApprovalError(err?.message || 'Suspension failed.');
    } finally {
      setProcessingUserId(null);
    }
  };

  // Change Password state (frontend-only interactive)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Admin user data (using actual profile if admin, or official default)
  const adminName = currentProfile?.full_name || 'Dr. Rajeshwar Sharma, IAS';
  const adminEmail = currentProfile?.email || 'r.sharma@mospi.gov.in';
  const adminRole = currentProfile?.role || 'MoSPI Joint Secretary & Platform Admin';
  const adminDept = currentProfile?.department || 'Infrastructure and Project Monitoring Division (IPMD), MoSPI';

  // Admin access & permissions state (interactive frontend UI)
  const [permissions, setPermissions] = useState({
    read: true,
    write: true,
    execute: true,
  });

  const togglePermission = (key: 'read' | 'write' | 'execute') => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const allPermissionsEnabled = permissions.read && permissions.write && permissions.execute;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current administrative password.');
      return;
    }
    if (!newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long with numbers and symbols.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    // Frontend demo validation feedback
    setPasswordSuccess('Password validated successfully. Security credentials updated.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSuccess(null), 4000);
  };

  const filteredActivities = INITIAL_ACTIVITIES.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.user.toLowerCase().includes(q) ||
      item.activity.toLowerCase().includes(q) ||
      item.department.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200 p-2 sm:p-5 rounded-2xl bg-[#EEF2F8]">
      {/* Top Banner & Navigation Container - Unified Light Blurry Grey Frosted Glassmorphism Card */}
      <div className="blurry-grey-card rounded-2xl p-5 sm:p-6 text-[#101A3D] shadow-md border border-slate-300/80 relative overflow-hidden">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white shadow-xs text-[#101A3D] flex items-center justify-center shrink-0 border border-slate-200 p-1.5 transition-transform hover:scale-105">
              <img
                src="/infranetra-logo.png"
                alt="InfraNetra Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[#101A3D] tracking-tight">
                  Government Project Admin Center
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100/90 text-emerald-800 border border-emerald-300/70 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Authorized Administrator Access
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                Infrastructure and Project Monitoring Division (IPMD) · Ministry of Statistics and Programme Implementation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/90 border border-slate-200/90 text-xs text-slate-700 font-medium shadow-xs">
              <div className="relative">
                <div className="w-6 h-6 rounded-full bg-[#101A3D] text-white flex items-center justify-center font-bold text-xs">
                  {adminName.charAt(0) || 'A'}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[#10B981] border-2 border-white rounded-full"></span>
              </div>
              <span className="truncate max-w-[140px] font-semibold text-[#101A3D]">{adminName}</span>
            </div>

            <button
              type="button"
              id="btn-back-to-portal"
              onClick={() => onNavigate('dashboard')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-[#101A3D] border border-slate-200 transition-all cursor-pointer shrink-0 shadow-xs hover:border-slate-300"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
              <span>Back to Portal</span>
            </button>
          </div>
        </div>

        {/* Divider Line */}
        <div className="h-px bg-slate-300/80 my-4" />

        {/* Admin Navigation Options - Integrated Row inside the Blurry Grey Card */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            id="nav-admin-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#101A3D] text-white shadow-sm font-bold'
                : 'bg-white/80 hover:bg-white text-slate-700 hover:text-[#101A3D] border border-slate-200/90 shadow-xs'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 ${activeTab === 'dashboard' ? 'text-[#0F9D8C]' : 'text-slate-500'}`} />
            <span>Admin Dashboard</span>
          </button>

          <button
            type="button"
            id="nav-admin-approvals"
            onClick={() => {
              setActiveTab('approvals');
              fetchPendingApprovals();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'approvals'
                ? 'bg-[#101A3D] text-white shadow-sm font-bold'
                : 'bg-white/80 hover:bg-white text-slate-700 hover:text-[#101A3D] border border-slate-200/90 shadow-xs'
            }`}
          >
            <UserCheck className={`w-4 h-4 ${activeTab === 'approvals' ? 'text-[#0F9D8C]' : 'text-slate-500'}`} />
            <span>Role Approvals</span>
            {pendingApprovals.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DC2626] text-white shadow-xs">
                {pendingApprovals.length}
              </span>
            )}
          </button>

          <button
            type="button"
            id="nav-admin-audit-logs"
            onClick={() => {
              setActiveTab('audit_logs');
              fetchAuditLogs();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'audit_logs'
                ? 'bg-[#101A3D] text-white shadow-sm font-bold'
                : 'bg-white/80 hover:bg-white text-slate-700 hover:text-[#101A3D] border border-slate-200/90 shadow-xs'
            }`}
          >
            <FileText className={`w-4 h-4 ${activeTab === 'audit_logs' ? 'text-[#0F9D8C]' : 'text-slate-500'}`} />
            <span>Audit Trail</span>
          </button>

          <button
            type="button"
            id="nav-admin-user-time"
            onClick={() => setActiveTab('user_and_time')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'user_and_time'
                ? 'bg-[#101A3D] text-white shadow-sm font-bold'
                : 'bg-white/80 hover:bg-white text-slate-700 hover:text-[#101A3D] border border-slate-200/90 shadow-xs'
            }`}
          >
            <Clock className={`w-4 h-4 ${activeTab === 'user_and_time' ? 'text-[#0F9D8C]' : 'text-slate-500'}`} />
            <span>Logged In User & Time</span>
          </button>

          <button
            type="button"
            id="nav-admin-profile-security"
            onClick={() => setActiveTab('profile_security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'profile_security'
                ? 'bg-[#101A3D] text-white shadow-sm font-bold'
                : 'bg-white/80 hover:bg-white text-slate-700 hover:text-[#101A3D] border border-slate-200/90 shadow-xs'
            }`}
          >
            <Shield className={`w-4 h-4 ${activeTab === 'profile_security' ? 'text-[#0F9D8C]' : 'text-slate-500'}`} />
            <span>Admin Profile & Security</span>
          </button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 1. ADMIN DASHBOARD VIEW                                    */}
      {/* ========================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* 4 Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Total Users
                </span>
                <div className="w-9 h-9 rounded-lg bg-[#5086EC]/10 text-[#5086EC] flex items-center justify-center">
                  <Users className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#1E293B]">1,248</span>
                <span className="text-xs font-semibold text-[#16A34A]">+12% this month</span>
              </div>
              <p className="text-[11px] text-[#64748B] mt-1">Verified Central & State Ministry users</p>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Pending Registrations
                </span>
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#1E293B]">18</span>
                <span className="text-xs font-semibold text-amber-600">Awaiting IPMD review</span>
              </div>
              <p className="text-[11px] text-[#64748B] mt-1">Implementing agency applications</p>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Active Users
                </span>
                <div className="w-9 h-9 rounded-lg bg-[#5086EC]/10 text-[#5086EC] flex items-center justify-center">
                  <UserCheck className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#1E293B]">142</span>
                <span className="text-xs font-semibold text-[#5086EC]">Active Sessions</span>
              </div>
              <p className="text-[11px] text-[#64748B] mt-1">Currently analyzing project dashboards</p>
            </div>

            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                  Recent Admin Activity
                </span>
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Activity className="w-4.5 h-4.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#1E293B]">24</span>
                <span className="text-xs font-semibold text-[#64748B]">Past 24 Hours</span>
              </div>
              <p className="text-[11px] text-[#64748B] mt-1">Audit events logged across ministries</p>
            </div>
          </div>

          {/* Agency Pipeline & System Status Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agency Registration Pipeline */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
                <div>
                  <h3 className="font-bold text-base text-[#1E293B]">
                    Agency Registration Queue
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Implementation agencies requesting official platform credentials
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#5086EC] bg-[#5086EC]/10 px-2.5 py-1 rounded-full">
                  18 Requests Total
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  {
                    agency: 'National Highways Authority of India (NHAI)',
                    ministry: 'MoRTH',
                    officer: 'V. Ramanathan (General Manager - Technical)',
                    pendingCount: '4 Requests',
                    time: '15 mins ago',
                  },
                  {
                    agency: 'Railway Board Monitoring Cell',
                    ministry: 'Ministry of Railways',
                    officer: 'S. K. Verma (Executive Director Planning)',
                    pendingCount: '6 Requests',
                    time: '1 hour ago',
                  },
                  {
                    agency: 'NTPC Renewable Energy Projects Cell',
                    ministry: 'Ministry of Power',
                    officer: 'Amitabh Sen (Chief Project Officer)',
                    pendingCount: '5 Requests',
                    time: '3 hours ago',
                  },
                  {
                    agency: 'Inland Waterways Authority of India',
                    ministry: 'Ministry of Ports, Shipping and Waterways',
                    officer: 'Capt. S. Sengupta (Director Infra)',
                    pendingCount: '3 Requests',
                    time: 'Yesterday',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-[#1E293B]">
                          {item.agency}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                          {item.ministry}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] mt-1">
                        Applicant: <span className="text-[#1E293B] font-medium">{item.officer}</span> · {item.time}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                        {item.pendingCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Platform Status & Security Governance */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs">
                <h3 className="font-bold text-base text-[#1E293B] mb-1">
                  System Health & Services
                </h3>
                <p className="text-xs text-[#64748B] mb-4">
                  Real-time status of government infrastructure nodes
                </p>

                <div className="space-y-3">
                  {[
                    { label: 'Platform Core Services', status: 'Operational', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                    { label: 'MoSPI PAIMANA Connector', status: 'Synchronized', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                    { label: 'Risk Recalculation Engine', status: 'Active (v2.4)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                    { label: 'Two-Factor Auth Gateway', status: 'Enforced', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                    { label: 'Database Replication Node', status: 'Connected', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                  ].map((srv, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                      <span className="font-medium text-[#1E293B] flex items-center gap-2">
                        <Server className="w-3.5 h-3.5 text-slate-400" />
                        {srv.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${srv.color}`}>
                        {srv.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4.5 rounded-xl bg-[#5086EC]/5 border border-[#5086EC]/20 text-xs text-[#1E293B]">
                <div className="flex items-center gap-2 font-bold text-sm text-[#5086EC] mb-1.5">
                  <ShieldCheck className="w-4.5 h-4.5" />
                  <span>Central Security Notice</span>
                </div>
                <p className="text-[#475569] leading-relaxed">
                  Admin session activity is logged under Section 12 of the Information Technology Governance Guidelines. Ensure all approved agency accounts map strictly to official government domains.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 2. LOGGED IN USER & TIME (Combined User Info + Activity)  */}
      {/* ========================================================== */}
      {activeTab === 'user_and_time' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top Section: Split between Logged In User and Login Time Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* A. LOGGED IN USER CARD */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#5086EC]/10 text-[#5086EC] flex items-center justify-center font-bold text-sm">
                    RS
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[#1E293B]">{adminName}</h3>
                    <span className="text-xs text-[#64748B] font-mono">{adminEmail}</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Active Verified
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  <span className="text-[#64748B] block font-medium uppercase text-[10px] tracking-wider">
                    Administrative Role
                  </span>
                  <span className="font-semibold text-[#1E293B] mt-1 block">
                    {adminRole}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  <span className="text-[#64748B] block font-medium uppercase text-[10px] tracking-wider">
                    Department / Division
                  </span>
                  <span className="font-semibold text-[#1E293B] mt-1 block">
                    {adminDept}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  <span className="text-[#64748B] block font-medium uppercase text-[10px] tracking-wider">
                    Security Clearance
                  </span>
                  <span className="font-semibold text-[#5086EC] mt-1 block">
                    Central Ministry Level 1 (Full Access)
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  <span className="text-[#64748B] block font-medium uppercase text-[10px] tracking-wider">
                    Officer Identification
                  </span>
                  <span className="font-semibold text-[#1E293B] mt-1 block font-mono">
                    GOI-IPMD-ADM-001
                  </span>
                </div>
              </div>
            </div>

            {/* B. LOGIN & TIME INFORMATION */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
                <div>
                  <h3 className="font-bold text-base text-[#1E293B]">Session & Timestamp Info</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">Active session details & network verification</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#5086EC]/10 text-[#5086EC] flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  <span className="text-[#64748B] block font-medium uppercase text-[10px] tracking-wider">
                    Current Login Time
                  </span>
                  <span className="font-semibold text-[#1E293B] mt-1 block font-mono">
                    Today, 09:14 AM IST
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  <span className="text-[#64748B] block font-medium uppercase text-[10px] tracking-wider">
                    Last Login
                  </span>
                  <span className="font-semibold text-[#1E293B] mt-1 block font-mono">
                    Yesterday, 05:42 PM IST
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  <span className="text-[#64748B] block font-medium uppercase text-[10px] tracking-wider">
                    Last Active
                  </span>
                  <span className="font-semibold text-[#16A34A] mt-1 block">
                    Just now (Active Session)
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  <span className="text-[#64748B] block font-medium uppercase text-[10px] tracking-wider">
                    Session Status & Protocol
                  </span>
                  <span className="font-semibold text-[#1E293B] mt-1 block font-mono">
                    Active · TLS 1.3 (IP: 10.42.18.9)
                  </span>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                <span className="text-emerald-800 font-medium">
                  Two-Factor Authentication token verified for this workstation
                </span>
                <span className="font-bold text-emerald-700">Valid 8h</span>
              </div>
            </div>
          </div>

          {/* C. RECENT ACTIVITY & DIRECTORY ACTIVITY TABLE */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
              <div>
                <h3 className="font-bold text-base text-[#1E293B]">Recent Administrative Activity Log</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Combined activity log for registered officers, administrators & automated ingestion tasks
                </p>
              </div>

              {/* Search filter */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by user, action or department..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#5086EC] focus:ring-1 focus:ring-[#5086EC]"
                />
              </div>
            </div>

            {/* Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[#64748B] uppercase text-[10px] tracking-wider font-semibold">
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">User & Organization</th>
                    <th className="py-3 px-3">Activity Description</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredActivities.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                        {row.timestamp}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#1E293B]">{row.user}</div>
                        <div className="text-[11px] text-[#64748B]">{row.department}</div>
                      </td>
                      <td className="py-3 px-3 text-[#1E293B] font-medium">
                        {row.activity}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            row.status === 'Success' || row.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : row.status === 'Logged'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredActivities.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No activity records found matching "{searchQuery}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 3. ADMIN PROFILE & SECURITY VIEW                           */}
      {/* ========================================================== */}
      {activeTab === 'profile_security' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Admin Profile Card */}
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs space-y-5">
              <div className="text-center pb-5 border-b border-[#F1F5F9]">
                <div className="w-16 h-16 rounded-full bg-[#5086EC] text-white flex items-center justify-center font-bold text-xl mx-auto mb-3 shadow-md shadow-indigo-200">
                  RS
                </div>
                <h3 className="font-bold text-lg text-[#1E293B]">{adminName}</h3>
                <p className="text-xs text-[#64748B] font-mono mt-0.5">{adminEmail}</p>
                <div className="mt-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#5086EC]/10 text-[#5086EC] border border-[#5086EC]/20">
                    Platform Administrator
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">Official Designation</span>
                  <span className="font-semibold text-[#1E293B]">{adminRole}</span>
                </div>

                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">Division / Ministry</span>
                  <span className="font-semibold text-[#1E293B]">{adminDept}</span>
                </div>

                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">Administrative Access Node</span>
                  <span className="font-semibold text-[#1E293B] font-mono">GOI-IPMD-NODE-01 (Delhi)</span>
                </div>

                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">Account Status</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active & Verified
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Admin Center</span>
                </button>
              </div>
            </div>

            {/* Right Column: Security Settings & Password Change */}
            <div className="lg:col-span-2 space-y-6">
              {/* Admin Access & Permissions Card */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
                  <div>
                    <h3 className="font-bold text-base text-[#1E293B]">Admin Access & Permissions</h3>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Configure granular operational permissions for the authenticated administrator session
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#64748B] font-medium">Status:</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        allPermissionsEnabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          allPermissionsEnabled ? 'bg-emerald-500' : 'bg-amber-500'
                        } animate-pulse`}
                      ></span>
                      {allPermissionsEnabled ? 'Full System Access' : 'Custom / Restricted Access'}
                    </span>
                  </div>
                </div>

                {/* Authority Level Banner */}
                <div className="mt-5 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#64748B] block">
                      Authority Level
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <ShieldCheck className="w-5 h-5 text-[#5086EC]" />
                      <span className="text-base font-bold text-[#1E293B]">Full System Authority</span>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-xs font-semibold text-[#5086EC]">
                    Administrative Master Role
                  </div>
                </div>

                {/* Permissions List */}
                <div className="mt-6">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">
                    Permissions:
                  </div>

                  <div className="space-y-3">
                    {/* Read Permission */}
                    <div
                      onClick={() => togglePermission('read')}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 select-none ${
                        permissions.read
                          ? 'bg-white border-indigo-200 hover:border-[#5086EC] shadow-xs'
                          : 'bg-slate-50/70 border-slate-200 opacity-70 hover:opacity-90'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold transition-colors ${
                            permissions.read
                              ? 'bg-[#5086EC] text-white shadow-xs'
                              : 'bg-slate-200 text-slate-400 border border-slate-300'
                          }`}
                        >
                          {permissions.read ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="text-xs">✕</span>}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#1E293B]">Read</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                permissions.read
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {permissions.read ? 'READ = Enabled' : 'READ = Disabled'}
                            </span>
                          </div>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            View projects, reports and system data
                          </p>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={permissions.read}
                        aria-label="Toggle Read Permission"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePermission('read');
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#5086EC] focus:ring-offset-2 ${
                          permissions.read ? 'bg-[#5086EC]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            permissions.read ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Write Permission */}
                    <div
                      onClick={() => togglePermission('write')}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 select-none ${
                        permissions.write
                          ? 'bg-white border-indigo-200 hover:border-[#5086EC] shadow-xs'
                          : 'bg-slate-50/70 border-slate-200 opacity-70 hover:opacity-90'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold transition-colors ${
                            permissions.write
                              ? 'bg-[#5086EC] text-white shadow-xs'
                              : 'bg-slate-200 text-slate-400 border border-slate-300'
                          }`}
                        >
                          {permissions.write ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="text-xs">✕</span>}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#1E293B]">Write</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                permissions.write
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {permissions.write ? 'WRITE = Enabled' : 'WRITE = Disabled'}
                            </span>
                          </div>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            Add, edit and update records
                          </p>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={permissions.write}
                        aria-label="Toggle Write Permission"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePermission('write');
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#5086EC] focus:ring-offset-2 ${
                          permissions.write ? 'bg-[#5086EC]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            permissions.write ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Execute Permission */}
                    <div
                      onClick={() => togglePermission('execute')}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 select-none ${
                        permissions.execute
                          ? 'bg-white border-indigo-200 hover:border-[#5086EC] shadow-xs'
                          : 'bg-slate-50/70 border-slate-200 opacity-70 hover:opacity-90'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold transition-colors ${
                            permissions.execute
                              ? 'bg-[#5086EC] text-white shadow-xs'
                              : 'bg-slate-200 text-slate-400 border border-slate-300'
                          }`}
                        >
                          {permissions.execute ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="text-xs">✕</span>}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#1E293B]">Execute</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                permissions.execute
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {permissions.execute ? 'EXECUTE = Enabled' : 'EXECUTE = Disabled'}
                            </span>
                          </div>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            Run administrative actions and system operations
                          </p>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={permissions.execute}
                        aria-label="Toggle Execute Permission"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePermission('execute');
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#5086EC] focus:ring-offset-2 ${
                          permissions.execute ? 'bg-[#5086EC]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                            permissions.execute ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Password Card */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs">
                <div className="pb-4 border-b border-[#F1F5F9]">
                  <h3 className="font-bold text-base text-[#1E293B]">Change Administrative Password</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Update your administrative credentials. Minimum 8 characters required.
                  </p>
                </div>

                <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B] mb-1.5">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#5086EC] focus:ring-1 focus:ring-[#5086EC]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B] mb-1.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#5086EC] focus:ring-1 focus:ring-[#5086EC]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E293B] mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#5086EC] focus:ring-1 focus:ring-[#5086EC]"
                    />
                  </div>

                  {passwordError && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700 flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{passwordSuccess}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#5086EC] hover:bg-[#4172D6] text-white transition-all shadow-xs cursor-pointer flex items-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Update Administrative Password</span>
                  </button>
                </form>
              </div>

              {/* Security Governance Settings */}
              <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs">
                <h3 className="font-bold text-base text-[#1E293B] mb-1">
                  Administrative Security Controls
                </h3>
                <p className="text-xs text-[#64748B] mb-4">
                  Security policies enforced on the Government Project Admin Center
                </p>

                <div className="space-y-4 text-xs">
                  <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#1E293B]">Two-Factor Authentication (2FA)</div>
                      <div className="text-slate-500 mt-0.5">
                        Required for all official ministerial and platform admin logins via OTP
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                      Enforced
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#1E293B]">Session Inactivity Timeout</div>
                      <div className="text-slate-500 mt-0.5">
                        Automatic termination of idle administrative browser sessions
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200">
                      30 Minutes
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#1E293B]">Audit Trail Logging Policy</div>
                      <div className="text-slate-500 mt-0.5">
                        Immutable cryptographic activity records persisted for 365 days
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 4. REAL PENDING ROLE APPROVALS VIEW                         */}
      {/* ========================================================== */}
      {activeTab === 'approvals' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#F1F5F9]">
              <div>
                <h3 className="font-bold text-base text-[#1E293B]">Pending User Registration Approvals</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Review, approve, reject, or suspend Ministry Officers and Project Managers
                </p>
              </div>
              <button
                type="button"
                onClick={fetchPendingApprovals}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Refresh Queue
              </button>
            </div>

            {approvalFeedback && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{approvalFeedback}</span>
              </div>
            )}

            {approvalError && (
              <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{approvalError}</span>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {approvalsLoading ? (
                <div className="py-12 flex justify-center items-center text-xs text-slate-500 gap-2">
                  <Clock className="w-4 h-4 animate-spin text-[#5086EC]" />
                  <span>Loading pending queue...</span>
                </div>
              ) : pendingApprovals.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-sm text-slate-700">No Pending Approvals</p>
                  <p className="text-xs text-slate-500 mt-1">All registrations have been reviewed.</p>
                </div>
              ) : (
                pendingApprovals.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#1E293B]">{req.full_name}</span>
                        <span className="font-mono text-[11px] px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-medium">
                          @{req.username}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          req.role === 'MINISTRY' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
                        }`}>
                          {req.role}
                        </span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">
                          {req.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                        <div>
                          <span className="text-slate-400 font-medium">Email: </span>
                          <span className="font-mono text-slate-700">{req.email}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Phone: </span>
                          <span className="text-slate-700">{req.phone || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Designation: </span>
                          <span className="text-slate-700">{req.designation || 'Officer'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium">Ministry: </span>
                          <strong className="text-[#1E293B]">{req.ministry || 'N/A'}</strong>
                        </div>
                      </div>
                      {req.role === 'PROJECT_MANAGER' && (
                        <div className="text-slate-700 font-medium pt-0.5">
                          <span className="text-slate-400">Assigned Project: </span>
                          <strong>{req.project_code || `Project ID ${req.project_id}`}</strong> {req.project_name && `(${req.project_name})`}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 pt-0.5">
                        Registration Date: {req.created_at ? new Date(req.created_at).toLocaleString() : 'Recent'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={processingUserId === req.id}
                        onClick={() => handleAdminApprove(req)}
                        className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={processingUserId === req.id}
                        onClick={() => handleAdminReject(req)}
                        className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={processingUserId === req.id}
                        onClick={() => handleAdminSuspend(req)}
                        className="px-2.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 5. IMMUTABLE AUDIT TRAIL LOGS VIEW                         */}
      {/* ========================================================== */}
      {activeTab === 'audit_logs' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F1F5F9]">
              <div>
                <h3 className="font-bold text-base text-[#1E293B]">Platform Security Audit Trail</h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Immutable cryptographic audit records of registrations, approvals, daily updates, and administrative changes
                </p>
              </div>
              <button
                type="button"
                onClick={fetchAuditLogs}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
              >
                Refresh Logs
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              {auditLogsLoading ? (
                <div className="py-12 flex justify-center items-center text-xs text-slate-500 gap-2">
                  <Clock className="w-4 h-4 animate-spin text-[#5086EC]" />
                  <span>Loading audit records...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="font-semibold text-sm text-slate-700">No Audit Records Found</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] bg-slate-50">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Actor</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Target</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {log.actor_username || 'SYSTEM'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {log.actor_role || 'SYSTEM'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-indigo-700">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 font-mono text-[11px]">
                          {log.target_resource ? `${log.target_resource}:${log.target_id || ''}` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={log.details || ''}>
                          {log.details || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                          {log.ip_address || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
