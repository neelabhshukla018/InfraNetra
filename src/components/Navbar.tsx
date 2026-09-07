import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  MapPin,
  AlertTriangle,
  FileText,
  User,
  Mail,
  Building2,
  CheckCircle2,
  ChevronDown,
  LogOut,
  LogIn,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { Profile, ProjectWithSnapshot, UploadedReportDocument } from '../types';
import { ReportSearchBar } from './ReportSearchBar';
import { AdminProfileSettingsModal } from './AdminProfileSettingsModal';

export type NavPage = 'dashboard' | 'projects' | 'map' | 'warnings' | 'detail' | 'about' | 'admin' | 'admin-login' | 'login';

interface NavbarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage, projectCode?: string) => void;
  onSelectProject: (projectCode: string) => void;
  onSelectDocument: (doc: UploadedReportDocument) => void;
  projects: ProjectWithSnapshot[];
  onOpenUpload?: () => void;
  onOpenAiAssistant?: () => void;
  activeCriticalWarningsCount: number;
  profile: Profile | null;
  onLogout: () => void;
  onLogin: () => void;
  onRegister?: () => void;
  onOpenMinistryApprovals?: () => void;
  onUpdateProfile?: (updatedProfile: Profile) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  onSelectProject,
  onSelectDocument,
  projects,
  onOpenUpload: _onOpenUpload,
  onOpenAiAssistant: _onOpenAiAssistant,
  activeCriticalWarningsCount,
  profile,
  onLogout,
  onLogin,
  onRegister,
  onOpenMinistryApprovals,
  onUpdateProfile,
}) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileContainerRef.current &&
        !profileContainerRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
      if (
        headerRef.current &&
        !headerRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsProfileOpen(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsProfileOpen(false);
    }, 180);
  };

  const handleToggleClick = () => {
    setIsProfileOpen((prev) => !prev);
  };

  const [leftOffset, setLeftOffset] = useState<number | null>(null);

  useEffect(() => {
    const updateOffset = () => {
      const targetLetter = document.getElementById('brand-letter-t');
      const container = document.getElementById('main-navbar-container');
      if (targetLetter && container) {
        const letterRect = targetLetter.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const offset = letterRect.left - containerRect.left;
        if (offset > 0) {
          setLeftOffset(Math.round(offset));
        }
      }
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);
    if (document.fonts?.ready) {
      document.fonts.ready.then(updateOffset);
    }
    const t1 = setTimeout(updateOffset, 50);
    const t2 = setTimeout(updateOffset, 250);

    return () => {
      window.removeEventListener('resize', updateOffset);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const isAdminMode =
    currentPage === 'admin' ||
    currentPage === 'admin-login' ||
    profile?.role === 'ADMIN' ||
    profile?.authUser?.role === 'ADMIN';

  return (
    <header
      ref={headerRef}
      id="main-top-navbar"
      className={`w-full h-14 shrink-0 text-white z-40 px-2.5 sm:px-4 lg:px-5 relative shadow-xs transition-colors duration-200 ${
        isAdminMode
          ? 'bg-[#5086EC] border-b border-[#4175DF]'
          : 'bg-[#233876] border-b border-[#354E91]'
      }`}
    >
      <div id="main-navbar-container" className="w-full max-w-[99%] 2xl:max-w-[1920px] mx-auto h-full flex items-center justify-between relative">
        {/* Primary Navigation Links (Shifted to left, aligned with letter 't' of InfraNetra) */}
        <div className="flex items-center flex-1 min-w-0">
          <nav
            id="navbar-center-menu"
            aria-label="Main navigation"
            style={leftOffset !== null ? { paddingLeft: `${leftOffset}px` } : undefined}
            className="hidden md:flex items-center space-x-1 lg:space-x-1.5 z-10 pl-[146px] sm:pl-[152px]"
          >
        {/* Dashboard Link (Always visible in center) */}
        <button
          id="nav-link-dashboard"
          type="button"
          onClick={() => onNavigate('dashboard')}
          className={`group flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-lg text-xs lg:text-[13px] tracking-wide transition-all cursor-pointer ${
            currentPage === 'dashboard'
              ? 'bg-white/20 text-white font-bold shadow-xs border border-white/25 backdrop-blur-xs'
              : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
          }`}
        >
          <LayoutDashboard className={`w-4 h-4 stroke-[1.8] transition-colors ${currentPage === 'dashboard' ? 'text-[#2DD4BF]' : 'text-white/85 group-hover:text-white'}`} />
          <span>Dashboard</span>
        </button>

        {/* Projects Link (Public & Authenticated) */}
        <button
          id="nav-link-projects"
          type="button"
          onClick={() => onNavigate('projects')}
          className={`group flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-lg text-xs lg:text-[13px] tracking-wide transition-all cursor-pointer ${
            currentPage === 'projects' || currentPage === 'detail'
              ? 'bg-white/20 text-white font-bold shadow-xs border border-white/25 backdrop-blur-xs'
              : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
          }`}
        >
          <FolderGit2 className={`w-4 h-4 stroke-[1.8] transition-colors ${currentPage === 'projects' || currentPage === 'detail' ? 'text-[#2DD4BF]' : 'text-white/85 group-hover:text-white'}`} />
          <span>Projects</span>
        </button>

        {/* Map Link (Public & Authenticated) */}
        <button
          id="nav-link-map"
          type="button"
          onClick={() => onNavigate('map')}
          className={`group flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-lg text-xs lg:text-[13px] tracking-wide transition-all cursor-pointer ${
            currentPage === 'map'
              ? 'bg-white/20 text-white font-bold shadow-xs border border-white/25 backdrop-blur-xs'
              : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
          }`}
        >
          <MapPin className={`w-4 h-4 stroke-[1.8] transition-colors ${currentPage === 'map' ? 'text-[#2DD4BF]' : 'text-white/85 group-hover:text-white'}`} />
          <span>Map</span>
        </button>

        {/* Early Warning Center (Visible only when authenticated) */}
        {profile && (
          <button
            id="nav-link-warnings"
            type="button"
            onClick={() => onNavigate('warnings')}
            className={`group flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-lg text-xs lg:text-[13px] tracking-wide transition-all relative cursor-pointer ${
              currentPage === 'warnings'
                ? 'bg-white/20 text-white font-bold shadow-xs border border-white/25 backdrop-blur-xs'
                : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 stroke-[1.8] shrink-0 transition-colors ${currentPage === 'warnings' ? 'text-[#2DD4BF]' : 'text-white/85 group-hover:text-white'}`} />
            <span className="flex items-center gap-1">
              <span>Early Warnings</span>
              {activeCriticalWarningsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DC2626] text-white leading-none shadow-xs">
                  {activeCriticalWarningsCount}
                </span>
              )}
            </span>
          </button>
        )}

        {/* About Us Link (Public & Authenticated) */}
        <button
          id="nav-link-about"
          type="button"
          onClick={() => onNavigate('about')}
          className={`group flex items-center gap-1.5 px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-lg text-xs lg:text-[13px] tracking-wide transition-all cursor-pointer ${
            currentPage === 'about'
              ? 'bg-white/20 text-white font-bold shadow-xs border border-white/25 backdrop-blur-xs'
              : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
          }`}
        >
          <FileText className={`w-4 h-4 stroke-[1.8] transition-colors ${currentPage === 'about' ? 'text-[#2DD4BF]' : 'text-white/85 group-hover:text-white'}`} />
          <span>About Us</span>
        </button>

        {/* Admin Center Link (Visible when in Admin Mode / Admin Authenticated) */}
        {isAdminMode && (
          <button
            id="nav-link-admin"
            type="button"
            onClick={() => onNavigate('admin')}
            className={`group flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3.5 py-1.5 lg:py-2 rounded-lg text-xs lg:text-[13px] tracking-wide transition-all relative cursor-pointer ${
              currentPage === 'admin'
                ? 'bg-white/20 text-white font-bold shadow-xs border border-white/25 backdrop-blur-xs'
                : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
            }`}
          >
            <Shield className={`w-4 h-4 stroke-[1.8] shrink-0 transition-colors ${currentPage === 'admin' ? 'text-[#2DD4BF]' : 'text-white/85 group-hover:text-white'}`} />
            <span>Admin Center</span>
          </button>
        )}
      </nav>
      </div>

      {/* Right Navigation & Utility Controls (Search & Profile/Auth) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 z-10 ml-auto">
        {/* Report & Document Search Bar (Accessible to both normal users and officers) */}
        <ReportSearchBar
          projects={projects}
          onSelectProject={onSelectProject}
          onSelectDocument={onSelectDocument}
          isNormalUser={!profile}
        />

        {/* User Profile / Auth State */}
        {profile ? (
          <div
            ref={profileContainerRef}
            className={`relative flex items-center pl-2 border-l ${isAdminMode ? 'border-white/30' : 'border-[#354E91]'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              id="profile-avatar-trigger"
              type="button"
              onClick={handleToggleClick}
              aria-expanded={isProfileOpen}
              aria-haspopup="true"
              aria-label="View user profile details"
              className={`relative w-9 h-9 rounded-full border transition-all flex items-center justify-center cursor-pointer focus:outline-none ${
                isProfileOpen
                  ? 'border-[#0F9D8C] ring-2 ring-[#0F9D8C]/30 bg-[#314B92] text-[#0F9D8C]'
                  : isAdminMode
                  ? 'bg-white/20 border-white/30 hover:border-white hover:bg-white/30 text-white'
                  : 'bg-[#314B92]/70 border-[#3E5CA8] hover:border-slate-300 hover:bg-[#314B92] text-slate-200'
              }`}
              title="Click or hover to view profile details and logout"
            >
              <User className="w-4.5 h-4.5" />
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 rounded-full ${isAdminMode ? 'border-[#5086EC]' : 'border-[#233876]'}`}
                title="Active session"
              />
            </button>

            {/* Floating Profile Details Card */}
            {isProfileOpen && (
              <div
                id="profile-dropdown-card"
                role="dialog"
                aria-label="User Profile Details"
                className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Header with Avatar & Basic Info */}
                <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-teal-50 border border-[#0F9D8C]/30 flex items-center justify-center text-[#0F9D8C] font-semibold text-sm shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-semibold text-[#101A3D] truncate">
                        {profile.full_name}
                      </h3>
                      <span title="Verified MoSPI Officer" className="inline-flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D8C] shrink-0" />
                      </span>
                    </div>
                    <p className="text-xs text-[#0F9D8C] font-medium leading-snug mt-0.5">
                      {profile.role}
                    </p>
                  </div>
                </div>

                {/* Detailed Attributes */}
                <div className="py-3 space-y-2 text-xs">
                  {(profile.designation || profile.authUser?.designation) && (
                    <div className="flex items-start gap-2 text-slate-600">
                      <Shield className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                      <span className="leading-tight text-slate-700 font-medium">
                        {profile.designation || profile.authUser?.designation}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-slate-600">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <span className="leading-tight text-slate-700">
                      {profile.department}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-[11px] text-slate-600 truncate">
                      {profile.email}
                    </span>
                  </div>
                </div>

                {/* Status & Context Footer */}
                <div className="pt-2.5 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Active Officer Session
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    MoSPI · IPMD
                  </span>
                </div>

                {/* Role Specific Shortcuts */}
                {(profile.authUser?.role === 'MINISTRY' || profile.role === 'MINISTRY') && onOpenMinistryApprovals && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onOpenMinistryApprovals();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
                    >
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>PM Approvals</span>
                    </button>
                  </div>
                )}
                {(profile.authUser?.role === 'ADMIN' || profile.role === 'ADMIN') && (
                  <div className="pt-2 space-y-1.5">
                    <button
                      type="button"
                      id="btn-nav-admin-control-center"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onNavigate('admin');
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#101A3D] bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Admin Control Center</span>
                    </button>
                  </div>
                )}

                {/* Logout Action Option */}
                <div className="pt-2 mt-1 border-t border-slate-100">
                  <button
                    id="btn-logout"
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    <span>Log Out of Account</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={`flex items-center pl-2 border-l ${isAdminMode ? 'border-white/30' : 'border-[#293B77]'}`}>
            <button
              id="btn-nav-login"
              type="button"
              onClick={onLogin}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                isAdminMode
                  ? 'bg-white text-[#5086EC] hover:bg-blue-50 border border-white'
                  : 'bg-[#0F9D8C] hover:bg-[#0d8778] text-white border border-[#0d8778]'
              }`}
              title="Sign in to your account"
            >
              <LogIn className={`w-3.5 h-3.5 ${isAdminMode ? 'text-[#5086EC]' : 'text-white'}`} />
              <span>Login</span>
            </button>
          </div>
        )}

        {/* Mobile menu toggle (visible on < md) */}
        <button
          id="btn-mobile-menu-toggle"
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="md:hidden p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-[#283C7D] transition-colors focus:outline-none cursor-pointer"
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>
      </div>
      {/* Mobile Navigation Dropdown Menu */}
      {isMobileMenuOpen && (
        <div
          id="mobile-nav-dropdown"
          className={`md:hidden absolute top-14 left-0 right-0 border-b px-4 py-3 shadow-xl z-50 flex flex-col gap-1.5 animate-in slide-in-from-top-2 duration-150 ${
            isAdminMode
              ? 'bg-[#4175DF] border-[#5086EC]'
              : 'bg-[#1D2E62] border-[#354E91]'
          }`}
        >
          <button
            id="mobile-nav-link-dashboard"
            type="button"
            onClick={() => {
              onNavigate('dashboard');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer ${
              currentPage === 'dashboard'
                ? 'bg-white/20 text-white font-bold border border-white/25 shadow-xs'
                : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 ${currentPage === 'dashboard' ? 'text-[#2DD4BF]' : 'text-white/85'}`} />
            <span>Dashboard</span>
          </button>

          <button
            id="mobile-nav-link-map"
            type="button"
            onClick={() => {
              onNavigate('map');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer ${
              currentPage === 'map'
                ? 'bg-white/20 text-white font-bold border border-white/25 shadow-xs'
                : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
            }`}
          >
            <MapPin className={`w-4 h-4 ${currentPage === 'map' ? 'text-[#2DD4BF]' : 'text-white/85'}`} />
            <span>Map</span>
          </button>

          <button
            id="mobile-nav-link-projects"
            type="button"
            onClick={() => {
              onNavigate('projects');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer ${
              currentPage === 'projects' || currentPage === 'detail'
                ? 'bg-white/20 text-white font-bold border border-white/25 shadow-xs'
                : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
            }`}
          >
            <FolderGit2 className={`w-4 h-4 ${currentPage === 'projects' || currentPage === 'detail' ? 'text-[#2DD4BF]' : 'text-white/85'}`} />
            <span>Projects</span>
          </button>

          {profile && (
            <button
              id="mobile-nav-link-warnings"
              type="button"
              onClick={() => {
                onNavigate('warnings');
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer ${
                currentPage === 'warnings'
                  ? 'bg-white/20 text-white font-bold border border-white/25 shadow-xs'
                  : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className={`w-4 h-4 ${currentPage === 'warnings' ? 'text-[#2DD4BF]' : 'text-white/85'}`} />
                <span>Early Warning Center</span>
              </div>
              {activeCriticalWarningsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#DC2626] text-white shadow-xs">
                  {activeCriticalWarningsCount}
                </span>
              )}
            </button>
          )}

          <button
            id="mobile-nav-link-about"
            type="button"
            onClick={() => {
              onNavigate('about');
              setIsMobileMenuOpen(false);
            }}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer ${
              currentPage === 'about'
                ? 'bg-white/20 text-white font-bold border border-white/25 shadow-xs'
                : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
            }`}
          >
            <FileText className={`w-4 h-4 ${currentPage === 'about' ? 'text-[#2DD4BF]' : 'text-white/85'}`} />
            <span>About Us</span>
          </button>

          {isAdminMode && (
            <button
              id="mobile-nav-link-admin"
              type="button"
              onClick={() => {
                onNavigate('admin');
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all text-left cursor-pointer ${
                currentPage === 'admin'
                  ? 'bg-white/20 text-white font-bold border border-white/25 shadow-xs'
                  : 'text-white/90 hover:text-white hover:bg-white/15 font-semibold'
              }`}
            >
              <Shield className={`w-4 h-4 ${currentPage === 'admin' ? 'text-[#2DD4BF]' : 'text-white/85'}`} />
              <span>Admin Center</span>
            </button>
          )}
        </div>
      )}
      {profile && (
        <AdminProfileSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          profile={profile}
          onProfileUpdated={(up) => {
            if (onUpdateProfile) onUpdateProfile(up);
          }}
        />
      )}
    </header>
  );
};

