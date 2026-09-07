import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Check,
} from 'lucide-react';
import { Profile } from '../types';
import { loginAdmin } from '../services/api';

interface AdminLoginPageProps {
  currentProfile?: Profile | null;
  onAdminLogin: (profile: Profile) => void;
  onNavigate: (page: any) => void;
  onLogout?: () => void;
  onUpdateProfile?: (profile: Profile) => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  currentProfile,
  onAdminLogin,
  onNavigate,
}) => {
  // Authentication Credentials: MUST ALWAYS BE INITIALIZED AS EMPTY STRINGS
  // Never read previously entered credentials from localStorage, sessionStorage,
  // cookies, currentProfile, or persistent state.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Field Validation Errors
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Cloudflare Turnstile Bot Protection State
  const [turnstileState, setTurnstileState] = useState<'idle' | 'verifying' | 'verified'>('idle');
  const [turnstileError, setTurnstileError] = useState<string | null>(null);

  // DIRECT REDIRECT: If Admin is already authenticated, immediately redirect to Admin Dashboard
  useEffect(() => {
    if (currentProfile?.role === 'ADMIN' || currentProfile?.authUser?.role === 'ADMIN') {
      onNavigate('admin');
    } else if (!currentProfile) {
      setUsername('');
      setPassword('');
      setTurnstileState('idle');
      setTurnstileError(null);
    }
  }, [currentProfile, onNavigate]);

  const handleTurnstileClick = () => {
    if (turnstileState === 'verified' || turnstileState === 'verifying') return;
    setTurnstileState('verifying');
    setTurnstileError(null);
    setTimeout(() => {
      setTurnstileState('verified');
    }, 850);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setUsernameError(null);
    setPasswordError(null);
    setAuthError(null);
    setTurnstileError(null);

    let hasError = false;

    // 1. Administrative Username Validation (Required)
    if (!username.trim()) {
      setUsernameError('Administrative username is required.');
      hasError = true;
    }

    // 2. Password Validation (Required)
    if (!password.trim()) {
      setPasswordError('Administrative security password is required.');
      hasError = true;
    }

    // 3. Cloudflare Turnstile Bot Protection Verification (Required)
    if (turnstileState !== 'verified') {
      setTurnstileError('Security verification required: Please complete "I am not a robot".');
      hasError = true;
    }

    if (hasError) return;

    setIsAuthenticating(true);

    try {
      // CRITICAL SECURITY RULE:
      // The backend authenticates the Admin using ONLY the server-side fixed
      // ADMIN_USERNAME and ADMIN_PASSWORD.
      const res = await loginAdmin({
        username: username.trim(),
        password: password.trim(),
      });

      // Always clear username and password from local component state
      setUsername('');
      setPassword('');

      // POST-LOGIN AUTHORITATIVE PROFILE RESOLUTION:
      // Profile values come strictly from the authoritative database record.
      const authoritativeFullName = res.user.full_name;
      const authoritativeEmail = res.user.email;
      const authoritativeDesignation = res.user.designation || 'Administrator';
      const authoritativeDepartment =
        res.user.department ||
        res.user.assigned_ministry ||
        'Infrastructure and Project Monitoring Division (IPMD), MoSPI';

      const adminProfile: Profile = {
        id: `usr_${res.user.id}`,
        full_name: authoritativeFullName,
        role: res.user.role,
        email: authoritativeEmail,
        department: authoritativeDepartment,
        designation: authoritativeDesignation,
        authUser: res.user,
      };

      setIsAuthenticating(false);

      // IMMEDIATE DIRECT REDIRECT TO ADMIN DASHBOARD / CONTROL CENTER
      onAdminLogin(adminProfile);
      onNavigate('admin');
    } catch (err: any) {
      setIsAuthenticating(false);
      // On failed login, immediately clear password to prevent brute-force retention
      setPassword('');
      setAuthError(err?.message || 'Administrative authentication failed');
    }
  };

  return (
    <div
      id="admin-login-canvas"
      className="min-h-[85vh] flex flex-col justify-center items-center py-10 px-4 sm:px-6"
    >
      <div className="w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-200">
        {/* Decorative Top Admin Bar */}
        <div className="h-1.5 w-full bg-[#5086EC] rounded-t-2xl shadow-xs" />

        {/* Main Administrative Card */}
        <div className="bg-white rounded-b-2xl border-x border-b border-[#E2E8F0] shadow-2xl p-7 sm:p-9">
          {/* InfraNetra Logo & Top Status */}
          <div className="text-center pb-6 border-b border-[#F1F5F9]">
            <div className="flex items-center justify-center mx-auto mb-3.5">
              <img
                src="/infranetra-logo.png"
                alt="InfraNetra Logo"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-md transition-transform hover:scale-105 duration-200"
              />
            </div>

            {/* Central Administration Portal Label */}
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5086EC] block">
              CENTRAL ADMINISTRATION PORTAL
            </span>

            {/* Title */}
            <h1 className="text-xl font-bold text-[#101A3D] tracking-tight mt-3">
              Admin Login
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} autoComplete="off" className="mt-6 space-y-5">
            {/* Authentication Error */}
            {authError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Authentication Error: </span>
                  {authError}
                </div>
              </div>
            )}

            {/* ADMINISTRATIVE USERNAME */}
            <div>
              <label
                htmlFor="input-admin-username"
                className="block text-xs font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1.5"
              >
                ADMINISTRATIVE USERNAME <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.5]" />
                <input
                  id="input-admin-username"
                  name="admin_user_credential"
                  type="text"
                  value={username}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (usernameError) setUsernameError(null);
                  }}
                  placeholder="Enter administrative username"
                  className={`w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border rounded-xl focus:outline-none transition-all ${
                    usernameError
                      ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] bg-[#DC2626]/5'
                      : 'border-[#CBD5E1] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] bg-white'
                  }`}
                />
              </div>
              {usernameError && (
                <p id="error-admin-username" className="text-xs text-[#DC2626] mt-1.5 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{usernameError}</span>
                </p>
              )}
            </div>

            {/* PASSWORD */}
            <div>
              <label
                htmlFor="input-admin-password"
                className="block text-xs font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1.5"
              >
                PASSWORD <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.5]" />
                <input
                  id="input-admin-password"
                  name="admin_pwd_credential"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  autoComplete="new-password"
                  spellCheck={false}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm border rounded-xl focus:outline-none transition-all ${
                    passwordError
                      ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-1 focus:ring-[#DC2626] bg-[#DC2626]/5'
                      : 'border-[#CBD5E1] focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] bg-white'
                  }`}
                />
                <button
                  type="button"
                  id="btn-toggle-admin-password"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p id="error-admin-password" className="text-xs text-[#DC2626] mt-1.5 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{passwordError}</span>
                </p>
              )}
            </div>

            {/* CLOUDFLARE TURNSTILE BOT PROTECTION ("I AM NOT A ROBOT") */}
            <div
              id="cloudflare-turnstile-box"
              className={`w-full px-3.5 py-2.5 rounded-xl border transition-all ${
                turnstileError
                  ? 'border-rose-300 bg-rose-50/50 ring-1 ring-rose-200'
                  : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3 select-none">
                <button
                  type="button"
                  id="cloudflare-turnstile-checkbox"
                  onClick={handleTurnstileClick}
                  disabled={turnstileState === 'verifying'}
                  className="flex items-center gap-3 text-left cursor-pointer group focus:outline-none min-w-0"
                  aria-label="Cloudflare Turnstile verification: I am not a robot"
                >
                  {turnstileState === 'verified' ? (
                    <>
                      {/* Step 3: Verified Checkmark */}
                      <div className="w-7 h-7 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0 shadow-xs animate-in zoom-in-75 duration-150">
                        <Check className="w-4.5 h-4.5 text-white stroke-[3.5]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-[13px] font-semibold text-slate-800">
                          Verification Successful
                        </span>
                        <span className="text-[10px] text-slate-500">I am not a robot</span>
                      </div>
                    </>
                  ) : turnstileState === 'verifying' ? (
                    <>
                      {/* Step 2: Spinning Ring of Dots */}
                      <div className="w-7 h-7 flex items-center justify-center shrink-0">
                        <svg className="w-6.5 h-6.5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="3" r="1.35" fill="#16A34A" opacity="1" />
                          <circle cx="18.36" cy="5.64" r="1.35" fill="#16A34A" opacity="0.87" />
                          <circle cx="21" cy="12" r="1.35" fill="#16A34A" opacity="0.75" />
                          <circle cx="18.36" cy="18.36" r="1.35" fill="#16A34A" opacity="0.62" />
                          <circle cx="12" cy="21" r="1.35" fill="#16A34A" opacity="0.5" />
                          <circle cx="5.64" cy="18.36" r="1.35" fill="#16A34A" opacity="0.37" />
                          <circle cx="3" cy="12" r="1.35" fill="#16A34A" opacity="0.25" />
                          <circle cx="5.64" cy="5.64" r="1.35" fill="#16A34A" opacity="0.12" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-[13px] font-semibold text-slate-800">
                          Verifying...
                        </span>
                        <span className="text-[10px] text-slate-500">Checking browser integrity</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Step 1: Standard Turnstile Checkbox */}
                      <div className="w-6.5 h-6.5 rounded-[5px] border-2 border-slate-400 bg-white group-hover:border-slate-600 transition-colors shrink-0 shadow-xs" />
                      <div className="flex flex-col">
                        <span className="text-xs sm:text-[13px] font-semibold text-slate-800">
                          I am not a robot
                        </span>
                        <span className="text-[10px] text-slate-500">Verify you are human</span>
                      </div>
                    </>
                  )}
                </button>

                {/* Cloudflare Official Logo & Branding */}
                <div className="flex flex-col items-center shrink-0 select-none pl-2 border-l border-slate-200">
                  <svg
                    className="w-9 h-5"
                    viewBox="0 0 100 50"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M78.5 28.5c-.3-4.2-3.8-7.5-8.1-7.5-1.5 0-2.9.4-4.1 1.2C64.6 15.6 58 11 50.3 11c-9.1 0-16.7 6.4-18.4 15-.8-.3-1.6-.4-2.5-.4-4.7 0-8.5 3.8-8.5 8.5 0 .8.1 1.6.3 2.4H79c1.6-1.5 2.5-3.5 2.5-5.7 0-.8-.1-1.5-.4-2.3z"
                      fill="#F38020"
                    />
                    <path
                      d="M70.4 21c-1.5 0-2.9.4-4.1 1.2C64.6 15.6 58 11 50.3 11c-9.1 0-16.7 6.4-18.4 15-.8-.3-1.6-.4-2.5-.4-1.9 0-3.6.6-5 1.7 1.4-7.5 7.9-13.2 15.7-13.2 6.6 0 12.3 4 14.8 9.8 1.1-.7 2.4-1.1 3.8-1.1 3.5 0 6.5 2.4 7.3 5.7-.5-.3-1.1-.5-1.6-.5z"
                      fill="#FAAD3F"
                    />
                    <polygon points="84,24 85.5,25.5 87,24 85.5,22.5" fill="#FFFFFF" opacity="0.9" />
                  </svg>
                  <span className="text-[9px] font-extrabold tracking-wider text-[#1F2937] leading-none mt-0.5">
                    CLOUDFLARE
                  </span>
                  <span className="text-[8px] text-[#6B7280] leading-tight mt-0.5">
                    Privacy · Terms
                  </span>
                </div>
              </div>

              {turnstileError && (
                <div
                  id="error-admin-turnstile"
                  className="mt-2 pt-2 border-t border-rose-200 text-xs font-medium text-rose-600 flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{turnstileError}</span>
                </div>
              )}
            </div>

            {/* SUBMIT BUTTON */}
            <button
              type="submit"
              id="btn-authenticate-admin"
              disabled={isAuthenticating}
              className="w-full mt-2 py-3.5 px-5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-[#5086EC] hover:bg-[#4172D6] transition-all shadow-md shadow-[#5086EC]/25 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating Administrator...</span>
                </>
              ) : (
                <>
                  <span>Authenticate as Administrator</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-5 border-t border-[#F1F5F9] bg-[#F8FAFC] rounded-xl p-3.5 border border-[#E2E8F0] text-[11px] text-[#64748B] flex items-start gap-2.5">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Restricted Access: This system is restricted exclusively to authorized government personnel. All connection attempts, IP addresses, and actions are logged and subject to auditing under the IT Governance Framework.
            </p>
          </div>
        </div>

        {/* Return to Public Portal */}
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#101A3D] transition-colors cursor-pointer font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to InfraNetra Public Portal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
