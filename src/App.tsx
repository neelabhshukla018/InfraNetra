import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Navbar, NavPage } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { EarlyWarningPage } from './pages/EarlyWarningPage';
import { MapPage } from './pages/MapPage';
import { AboutUsPage } from './pages/AboutUsPage';
import { FlashReportUploadModal } from './components/FlashReportUploadModal';
import { AiAssistantSlideover } from './components/AiAssistantSlideover';
import { LiveParseBanner } from './components/LiveParseBanner';
import { DocumentReportModal } from './components/DocumentReportModal';
import { LoginPage } from './pages/LoginPage';
import { AdminCenterPage } from './pages/AdminCenterPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { GovernmentHeader } from './components/GovernmentHeader';
import { MinistryManagerApprovalsModal } from './components/MinistryManagerApprovalsModal';
import { getCurrentUser, logoutUser, getAuthToken, clearAuthToken } from './services/api';
import { INITIAL_PROJECTS, INITIAL_PARSE_JOBS } from './data/mockData';
import { ProjectWithSnapshot, ParseJob, UploadedReportDocument, Profile } from './types';
import { Upload, LogOut, Sparkles } from 'lucide-react';

export type AppState = 'PUBLIC' | 'AUTHENTICATING' | 'AUTHENTICATED' | 'LOGIN_MODAL_OPEN' | 'ACCESS_DENIED';

export default function App() {
  const [projects, setProjects] = useState<ProjectWithSnapshot[]>(INITIAL_PROJECTS);
  
  // Explicit top-level application state, defaulting strictly to PUBLIC
  const [appState, setAppState] = useState<AppState>('PUBLIC');

  // Session state initialized from verified token, defaulting strictly to public read-only (null)
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isMinistryApprovalsOpen, setIsMinistryApprovalsOpen] = useState(false);

  // Validate session token with authoritative server on startup
  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setProfile(null);
        setAppState('PUBLIC');
        setIsAuthModalOpen(false);
        return;
      }
      setAppState('AUTHENTICATING');
      try {
        const { user } = await getCurrentUser();
        if (!user || user.status !== 'APPROVED') {
          console.warn('Session user is not approved; resetting to public.');
          clearAuthToken();
          setProfile(null);
          setAppState('PUBLIC');
          setIsAuthModalOpen(false);
          return;
        }
        const verifiedProfile: Profile = {
          id: `usr_${user.id}`,
          full_name: user.full_name,
          role: user.role,
          email: user.email,
          department: user.department || user.assigned_ministry || (user.assigned_project_code ? `Project: ${user.assigned_project_code}` : (user.designation || 'Central Administration')),
          designation: user.designation || null,
          authUser: user,
        };
        setProfile(verifiedProfile);
        setAppState('AUTHENTICATED');
      } catch (err) {
        console.warn('Session verification failed on mount:', err);
        clearAuthToken();
        setProfile(null);
        setAppState('PUBLIC');
        setIsAuthModalOpen(false);
      }
    };
    initAuth();
  }, []);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [logoutToast, setLogoutToast] = useState(false);

  const openLogin = () => {
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  };

  const openRegister = () => {
    setAuthModalMode('signup');
    setIsAuthModalOpen(true);
  };

  const handleLogin = (newProfile: Profile) => {
    setProfile(newProfile);
    setAppState('AUTHENTICATED');
    setIsAuthModalOpen(false);
    setCurrentPage('dashboard');
  };

  const handleAdminLogin = (adminProfile: Profile) => {
    setProfile(adminProfile);
    setAppState('AUTHENTICATED');
    setIsAuthModalOpen(false);
    navigateTo('admin');
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).Clerk?.signOut) {
        await (window as any).Clerk.signOut();
      }
    } catch (clerkErr) {
      console.warn('Clerk signOut on app logout:', clerkErr);
    }
    await logoutUser();
    clearAuthToken();
    setProfile(null);
    setAppState('PUBLIC');
    setIsAuthModalOpen(false);
    setCurrentPage('dashboard');
    window.history.replaceState({}, '', '/');
    setLogoutToast(true);
    setTimeout(() => setLogoutToast(false), 4000);
  };

  // Navigation state
  const [currentPage, setCurrentPage] = useState<NavPage>('dashboard');
  const [selectedProjectCode, setSelectedProjectCode] = useState<string | null>(null);
  const [tierFilterForProjects, setTierFilterForProjects] = useState<string | null>(null);

  // Modals & Slideovers
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [activeParseJob, setActiveParseJob] = useState<ParseJob | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<UploadedReportDocument | null>(null);

  // Parse path, query parameters & hash on initial load
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get('page');

      // Check if path is /projects/:code
      const projectMatch = window.location.pathname.match(/\/projects\/([A-Za-z0-9_\-]+)/);
      if (projectMatch) {
        const code = projectMatch[1];
        setSelectedProjectCode(code);
        setCurrentPage('detail');
        return;
      }

      if (pageParam === 'map' || path.includes('/map') || hash.includes('map')) {
        setCurrentPage('map');
        setSelectedProjectCode(null);
        return;
      }

      if (pageParam === 'projects' || path.includes('/projects')) {
        const tier = params.get('tier');
        if (tier) setTierFilterForProjects(tier);
        setCurrentPage('projects');
        setSelectedProjectCode(null);
        return;
      }

      if (pageParam === 'warnings' || path.includes('/warnings')) {
        if (!profile) {
          setIsAuthModalOpen(true);
          setAuthModalMode('login');
          setCurrentPage('dashboard');
          return;
        }
        setCurrentPage('warnings');
        setSelectedProjectCode(null);
        return;
      }

      if (pageParam === 'about' || path.includes('/about') || hash.includes('about')) {
        setCurrentPage('about');
        setSelectedProjectCode(null);
        return;
      }

      if (pageParam === 'admin-login' || path.includes('/admin-login') || hash.includes('admin-login')) {
        if (profile?.authUser?.role === 'ADMIN' || profile?.role === 'ADMIN') {
          setCurrentPage('admin');
          window.history.replaceState({}, '', '/admin');
        } else {
          setCurrentPage('admin-login');
        }
        setSelectedProjectCode(null);
        return;
      }

      if (pageParam === 'admin' || path === '/admin') {
        if (profile?.authUser?.role !== 'ADMIN' && profile?.role !== 'ADMIN') {
          setCurrentPage('admin-login');
        } else {
          setCurrentPage('admin');
        }
        setSelectedProjectCode(null);
        return;
      }

      if (pageParam === 'login' || path === '/login') {
        setIsAuthModalOpen(true);
        setAuthModalMode('login');
        setCurrentPage('dashboard');
        return;
      }

      if (pageParam === 'register' || pageParam === 'signup' || path === '/register' || path === '/signup') {
        setIsAuthModalOpen(true);
        setAuthModalMode('signup');
        setCurrentPage('dashboard');
        return;
      }

      if (pageParam === 'detail') {
        const codeParam = params.get('code');
        if (codeParam) setSelectedProjectCode(codeParam);
        setCurrentPage('detail');
        return;
      }

      setCurrentPage('dashboard');
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [profile]);

  const navigateTo = (page: NavPage, projectCode?: string, hash?: string) => {
    setCurrentPage(page);
    if (page === 'detail' && projectCode) {
      setSelectedProjectCode(projectCode);
      const url = `/?page=detail&code=${projectCode}${hash ? '#' + hash : ''}`;
      window.history.pushState({}, '', url);
      if (hash) {
        setTimeout(() => {
          const el = document.getElementById(hash);
          el?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else if (page === 'projects') {
      setSelectedProjectCode(null);
      window.history.pushState({}, '', '/?page=projects');
    } else if (page === 'map') {
      setSelectedProjectCode(null);
      window.history.pushState({}, '', '/?page=map');
    } else if (page === 'warnings') {
      if (!profile) {
        setIsAuthModalOpen(true);
        setAuthModalMode('login');
        return;
      }
      setSelectedProjectCode(null);
      window.history.pushState({}, '', '/?page=warnings');
    } else if (page === 'about') {
      setSelectedProjectCode(null);
      window.history.pushState({}, '', '/?page=about');
    } else if (page === 'admin-login') {
      setSelectedProjectCode(null);
      if (profile?.authUser?.role === 'ADMIN' || profile?.role === 'ADMIN') {
        window.history.pushState({}, '', '/admin');
        setCurrentPage('admin');
      } else {
        window.history.pushState({}, '', '/admin-login');
      }
    } else if (page === 'admin') {
      setSelectedProjectCode(null);
      if (profile?.authUser?.role !== 'ADMIN' && profile?.role !== 'ADMIN') {
        window.history.pushState({}, '', '/admin-login');
        setCurrentPage('admin-login');
      } else {
        window.history.pushState({}, '', '/admin');
      }
    } else if (page === 'login') {
      setSelectedProjectCode(null);
      openLogin();
    } else {
      setSelectedProjectCode(null);
      window.history.pushState({}, '', '/');
    }
  };

  const handleSelectProject = (projectCode: string, hash?: string) => {
    navigateTo('detail', projectCode, !profile ? undefined : hash);
  };

  const handleFilterProjectsByTier = (tier?: string) => {
    setTierFilterForProjects(tier || null);
    setCurrentPage('projects');
    const url = tier ? `/?page=projects&tier=${tier}` : '/?page=projects';
    window.history.pushState({}, '', url);
  };

  const handleUploadSuccess = (job: ParseJob) => {
    setActiveParseJob(job);
  };

  // Find currently selected project object (supporting any project_id from the database)
  const activeProject = useMemo<ProjectWithSnapshot>(() => {
    const cleanCode = (selectedProjectCode || '').trim();
    const found = projects.find(
      (p) =>
        p.project_code.toLowerCase() === cleanCode.toLowerCase() ||
        (p as any).project_id === cleanCode
    );
    if (found) return found;
    if (cleanCode) {
      return {
        project_code: cleanCode,
        name: `Project #${cleanCode}`,
        ministry: 'Central Sector',
        sector: 'Infrastructure',
        state: 'India',
        approved_cost: 0,
        epc_contractor: 'N/A',
        sanction_date: 'N/A',
        target_completion: 'N/A',
        nodal_officer: 'N/A',
        length_or_capacity: 'N/A',
        latest_snapshot: {
          id: `snap-${cleanCode}`,
          project_code: cleanCode,
          report_month: 'Current Snapshot',
          revised_cost: 0,
          expenditure: 0,
          physical_progress_pct: 0,
          expected_progress_pct: 0,
          time_risk: 0,
          cost_risk: 0,
          implementation_risk: 0,
          overall_risk: 0,
          risk_tier: 'low',
          delay_months: 0,
          cost_overrun_pct: 0,
          last_updated_relative: 'Current',
          last_updated_absolute: 'Current',
        },
        active_warnings_count: 0,
        warnings: [],
        historical_snapshots: [],
      };
    }
    return projects[0];
  }, [projects, selectedProjectCode]);

  // Active critical warnings count
  const criticalWarningsCount = projects.reduce(
    (acc, p) => acc + p.warnings.filter((w) => !w.dismissed && w.severity === 'critical').length,
    0
  );

  const mainScrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top of main viewport when navigating between pages
  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentPage, selectedProjectCode]);

  return (
    <div className="h-screen w-full overflow-hidden bg-[#F8FAFC] text-[#1E293B] flex flex-col antialiased">
      {/* Official Government of India Top Banner & Emblem Header */}
      <GovernmentHeader
        onNavigateHome={() => navigateTo('dashboard')}
        onSkipToMain={() => {
          navigateTo('dashboard');
          mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Main Command Navigation Bar */}
      <Navbar
        currentPage={currentPage}
        onNavigate={(page) => navigateTo(page)}
        onSelectProject={handleSelectProject}
        onSelectDocument={(doc) => setSelectedDocument(doc)}
        projects={projects}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        activeCriticalWarningsCount={criticalWarningsCount}
        profile={profile}
        onLogout={handleLogout}
        onLogin={openLogin}
        onRegister={openRegister}
        onOpenMinistryApprovals={() => setIsMinistryApprovalsOpen(true)}
        onUpdateProfile={(updated) => setProfile(updated)}
      />

      {/* Scrollable Viewport - Scrollbar track starts strictly below the navbar */}
      <div
        id="main-scroll-viewport"
        ref={mainScrollRef}
        className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col"
      >
        {/* Realtime Live Parse Status Banner (Authenticated officers only) */}
        {profile && (
          <LiveParseBanner
            job={activeParseJob}
            onDismiss={() => setActiveParseJob(null)}
            onViewDetails={() => setIsUploadOpen(true)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 pt-6 pb-12 px-2.5 sm:px-4 lg:px-5 w-full max-w-[99%] 2xl:max-w-[1920px] mx-auto">
        {currentPage === 'dashboard' && (
          <DashboardPage
            projects={projects}
            onSelectProject={handleSelectProject}
            onNavigateProjects={handleFilterProjectsByTier}
            onNavigateWarnings={() => navigateTo('warnings')}
            onNavigateMap={() => navigateTo('map')}
            onOpenUpload={() => setIsUploadOpen(true)}
            isNormalUser={!profile}
            onOpenLogin={openLogin}
            onOpenRegister={openRegister}
          />
        )}

        {currentPage === 'projects' && (
          <ProjectsPage
            projects={projects}
            onSelectProject={handleSelectProject}
            initialTierFilter={tierFilterForProjects}
            isNormalUser={!profile}
            onOpenLogin={openLogin}
            currentProfile={profile}
          />
        )}

        {currentPage === 'map' && (
          <MapPage
            projects={projects}
            onSelectProject={handleSelectProject}
            isNormalUser={!profile}
          />
        )}

        {currentPage === 'detail' && activeProject && (
          <ProjectDetailPage
            project={activeProject}
            onBack={() => navigateTo('projects')}
            onSelectProject={handleSelectProject}
            onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
            isNormalUser={!profile}
            onOpenLogin={openLogin}
            currentProfile={profile}
          />
        )}

        {currentPage === 'warnings' && (
          profile ? (
            <EarlyWarningPage
              projects={projects}
              onSelectProject={handleSelectProject}
            />
          ) : (
            <DashboardPage
              projects={projects}
              onSelectProject={handleSelectProject}
              onNavigateProjects={handleFilterProjectsByTier}
              onNavigateWarnings={() => navigateTo('warnings')}
              onNavigateMap={() => navigateTo('map')}
              onOpenUpload={() => setIsUploadOpen(true)}
              isNormalUser={!profile}
              onOpenLogin={openLogin}
              onOpenRegister={openRegister}
            />
          )
        )}

        {currentPage === 'about' && (
          <AboutUsPage
            onNavigate={(page, code) => {
              if (code) {
                handleSelectProject(code);
              } else {
                navigateTo(page);
              }
            }}
          />
        )}

        {currentPage === 'admin-login' && (
          <AdminLoginPage
            currentProfile={profile}
            onAdminLogin={handleAdminLogin}
            onNavigate={navigateTo}
            onLogout={handleLogout}
            onUpdateProfile={(updated) => setProfile(updated)}
          />
        )}

        {currentPage === 'admin' && (
          <AdminCenterPage
            currentProfile={profile}
            onNavigate={navigateTo}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Upload Flash Report Action Bar - Displayed only for authenticated officers */}
      {profile && (currentPage === 'dashboard' || currentPage === 'projects') && (
        <div className="w-full max-w-[99%] 2xl:max-w-[1920px] mx-auto px-2.5 sm:px-4 lg:px-5 pb-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#101A3D] flex items-center justify-center text-[#0F9D8C] shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#101A3D]">
                  Project Monitoring Reports
                </div>
                <p className="text-[11px] text-[#64748B]">
                  Upload official monthly reports (PDF / Excel) to track project costs, milestone delays, and key risks.
                </p>
              </div>
            </div>
            <button
              id="btn-upload-flash-report"
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded text-xs font-semibold bg-[#101A3D] hover:bg-[#1E2A5E] text-white shadow-xs transition-colors shrink-0 cursor-pointer"
              title="Upload official monthly project monitoring reports"
            >
              <Upload className="w-3.5 h-3.5 text-[#0F9D8C]" />
              <span>Upload Flash Report</span>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-[#E2E8F0] py-5 px-3 sm:px-6 text-xs text-[#64748B] mt-auto">
        <div className="w-full max-w-[99%] 2xl:max-w-[1920px] mx-auto flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-center leading-relaxed">
          <button
            type="button"
            onClick={() => navigateTo('about')}
            className="font-bold text-[#101A3D] hover:text-[#0F9D8C] transition-colors cursor-pointer"
          >
            InfraNetra
          </button>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={() => navigateTo('about')}
            className="hover:text-[#101A3D] hover:underline transition-colors cursor-pointer font-medium"
          >
            About Us
          </button>
          <span className="text-slate-300">·</span>
          <a
            href="https://ipm.mospi.gov.in/AboutUs/AboutIPMD"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#101A3D] hover:underline transition-colors font-medium cursor-pointer"
            title="Infrastructure and Project Monitoring Division (IPMD) Official Portal"
          >
            Infrastructure and Project Monitoring Division (IPMD)
          </a>
          <span className="text-slate-300">·</span>
          <a
            href="https://www.mospi.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#101A3D] hover:underline transition-colors font-medium cursor-pointer"
            title="Ministry of Statistics and Programme Implementation (MoSPI) Official Portal"
          >
            Ministry of Statistics and Programme Implementation (MoSPI)
          </a>
          <span className="text-slate-300">·</span>
          <a
            href="https://paimana.mospi.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#101A3D] hover:underline transition-colors font-medium cursor-pointer"
            title="MoSPI PAIMANA Flash Report Monitoring Portal"
          >
            MoSPI PAIMANA Flash Report Monitoring
          </a>
          <span className="text-slate-300">·</span>
          <a
            href="https://indiainvestmentgrid.gov.in/national-infrastructure-pipeline"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#101A3D] hover:underline transition-colors font-medium cursor-pointer"
            title="National Infrastructure Pipeline Portal"
          >
            National Infrastructure Pipeline
          </a>
          <span className="text-slate-300">·</span>
          <a
            href="https://www.india.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#101A3D] hover:underline transition-colors font-medium cursor-pointer"
            title="National Portal of India — Government of India"
          >
            Government of India
          </a>
          <span className="text-slate-300">·</span>
          <button
            id="footer-link-login-admin"
            type="button"
            onClick={() => navigateTo('admin-login')}
            className="hover:text-[#4F46E5] hover:underline transition-colors cursor-pointer font-medium text-slate-500"
          >
            Login as Admin
          </button>
        </div>
      </footer>
      </div>

      {/* Upload Flash Report PDF Dropzone Modal */}
      <FlashReportUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Grounded AI Assistant Slideover (Public & Authenticated) */}
      <AiAssistantSlideover
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        projects={projects}
        onSelectProject={handleSelectProject}
      />

      {/* Uploaded Report Document Dossier Inspection Modal */}
      <DocumentReportModal
        document={selectedDocument}
        onClose={() => setSelectedDocument(null)}
        onNavigateToProjects={() => {
          setSelectedDocument(null);
          if (profile) {
            navigateTo('projects');
          } else {
            navigateTo('dashboard');
          }
        }}
        onOpenUploadAudit={() => {
          setSelectedDocument(null);
          if (profile) {
            setIsUploadOpen(true);
          } else {
            openLogin();
          }
        }}
        isNormalUser={!profile}
      />

      {/* Officer Login / Register Modal - Only mounted when explicitly opened by user */}
      {isAuthModalOpen && (
        <LoginPage
          isModal
          isOpen={isAuthModalOpen}
          initialMode={authModalMode}
          currentProfile={profile}
          onLogout={handleLogout}
          onClose={() => setIsAuthModalOpen(false)}
          onLogin={(newProfile) => {
            handleLogin(newProfile);
            setIsAuthModalOpen(false);
            setLogoutToast(false);
          }}
        />
      )}

      {/* Ministry Manager Approvals Modal */}
      <MinistryManagerApprovalsModal
        isOpen={isMinistryApprovalsOpen}
        onClose={() => setIsMinistryApprovalsOpen(false)}
        ministryName={profile?.authUser?.assigned_ministry || profile?.department}
      />

      {/* Fixed Modern Floating AI Chatbot Action Button (Bottom Right) */}
      {!isAiAssistantOpen && (
        <button
          id="btn-floating-ask-ai"
          type="button"
          onClick={() => setIsAiAssistantOpen(true)}
          aria-label="Open InfraNetra AI Risk Intelligence Assistant"
          className="fixed bottom-6 right-6 z-50 group flex items-center gap-2.5 pl-3 pr-4 py-2.5 bg-[#101A3D] hover:bg-[#1E2A5E] text-white rounded-full shadow-2xl border border-[#0F9D8C]/50 hover:border-[#0F9D8C] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0F9D8C]"
        >
          <div className="relative w-8 h-8 rounded-full bg-[#0F9D8C] flex items-center justify-center text-white shrink-0 shadow-md group-hover:bg-[#0d8778] transition-colors">
            <Sparkles className="w-4 h-4 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#101A3D] animate-pulse" />
          </div>
          <span className="text-[13px] font-bold tracking-tight text-white group-hover:text-teal-200 transition-colors">
            Ask AI
          </span>
        </button>
      )}

      {/* Logout Notification Banner */}
      {logoutToast && (
        <div
          id="logout-notification-toast"
          className="fixed bottom-24 right-6 z-50 blurry-grey-card text-[#101A3D] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-[#101A3D]">Logged Out</p>
            <p className="text-[#475569] text-[11px]">Your officer session has ended.</p>
          </div>
          <button
            type="button"
            onClick={openLogin}
            className="ml-2 px-3 py-1 rounded bg-[#0F9D8C] hover:bg-[#0d8778] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Sign In
          </button>
        </div>
      )}
    </div>
  );
}
