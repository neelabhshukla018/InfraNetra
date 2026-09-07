import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  User,
  Building2,
  Lock,
  Mail,
  CheckCircle2,
  ArrowRight,
  KeyRound,
  Check,
  Loader2,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { Profile } from '../types';
import { AVAILABLE_PROFILES } from '../data/mockData';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignIn: (profile: Profile) => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  onClose,
  onSignIn,
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState<string>(AVAILABLE_PROFILES[0].id);
  const [customEmail, setCustomEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [useCustom, setUseCustom] = useState(false);

  // Cloudflare Turnstile Bot Protection State
  const [turnstileState, setTurnstileState] = useState<'idle' | 'verifying' | 'verified'>('idle');
  const [turnstileError, setTurnstileError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTurnstileState('idle');
      setTurnstileError(null);
      setEmailError(null);
      setPasswordError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTurnstileClick = () => {
    if (turnstileState === 'verified' || turnstileState === 'verifying') return;
    setTurnstileState('verifying');
    setTurnstileError(null);
    setTimeout(() => {
      setTurnstileState('verified');
    }, 850);
  };

  const handleSelectOfficer = (profile: Profile) => {
    if (turnstileState !== 'verified') {
      setTurnstileError('Security verification required: Please complete "I am not a robot".');
      return;
    }
    onSignIn(profile);
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setTurnstileError(null);

    let hasError = false;
    if (!customEmail.trim()) {
      setEmailError('Official email is required.');
      hasError = true;
    } else if (!customEmail.includes('@')) {
      setEmailError('Please enter a valid official email address.');
      hasError = true;
    }

    if (!customPassword.trim()) {
      setPasswordError('PIN or password is required.');
      hasError = true;
    } else if (customPassword.length < 6) {
      setPasswordError('PIN or password must be at least 6 characters.');
      hasError = true;
    }

    if (turnstileState !== 'verified') {
      setTurnstileError('Security verification required: Please complete "I am not a robot".');
      hasError = true;
    }

    if (hasError) return;

    const fallbackProfile: Profile = {
      id: 'usr_custom',
      full_name: customEmail ? customEmail.split('@')[0].toUpperCase() : 'MoSPI Officer',
      role: 'Project Monitoring Official',
      email: customEmail || 'officer@mospi.gov.in',
      department: 'Infrastructure and Project Monitoring Division (IPMD)',
    };
    onSignIn(fallbackProfile);
    onClose();
  };

  const renderTurnstileWidget = () => (
    <div
      id="cloudflare-turnstile-widget"
      className={`px-4 py-3 rounded-md border transition-all ${
        turnstileError
          ? 'border-rose-300 bg-rose-50/40 ring-1 ring-rose-200'
          : 'border-[#E5E7EB] bg-[#F9FAFB]'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Checkbox and Status Label */}
        <button
          type="button"
          id="cloudflare-turnstile-checkbox"
          onClick={handleTurnstileClick}
          disabled={turnstileState === 'verifying'}
          className="flex items-center gap-3.5 text-left cursor-pointer select-none group focus:outline-none"
          aria-label="Cloudflare Turnstile verification"
        >
          {turnstileState === 'verified' ? (
            <>
              {/* Green circle with white checkmark */}
              <div className="w-8 h-8 rounded-full bg-[#15803D] flex items-center justify-center shrink-0 shadow-xs">
                <Check className="w-5 h-5 text-white stroke-[3.5]" />
              </div>
              {/* Success! text matching screenshot */}
              <span className="text-[17px] font-normal text-[#1F2937] tracking-tight">
                Success!
              </span>
            </>
          ) : turnstileState === 'verifying' ? (
            <>
              <div className="w-8 h-8 flex items-center justify-center shrink-0">
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
              <span className="text-sm font-normal text-slate-600">
                Verifying...
              </span>
            </>
          ) : (
            <>
              <div className="w-7 h-7 rounded border border-slate-300 bg-white hover:border-slate-400 transition-colors shrink-0 shadow-xs" />
              <span className="text-sm font-normal text-[#1F2937]">
                Verify you are human
              </span>
            </>
          )}
        </button>

        {/* Cloudflare Official Logo matching screenshot */}
        <div className="flex flex-col items-center shrink-0 select-none pl-2">
          <svg
            className="w-8 h-4.5"
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
          </svg>
          <span className="text-[10px] font-extrabold tracking-wider text-[#1F2937] leading-none mt-0.5">
            CLOUDFLARE
          </span>
          <span className="text-[8.5px] text-slate-500 leading-tight mt-0.5">
            Privacy · Terms
          </span>
        </div>
      </div>

      {turnstileError && (
        <div className="mt-2 pt-2 border-t border-rose-200 text-[11px] font-medium text-rose-600 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{turnstileError}</span>
        </div>
      )}
    </div>
  );

  return (
    <div
      id="signin-modal-backdrop"
      className="fixed inset-0 z-50 bg-[#0F172A]/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="signin-modal-container"
        className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1B2B5B] text-white px-6 py-4 flex items-center justify-between border-b border-[#293B77]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/20 p-1 shadow-xs">
              <img
                src="/infranetra-logo.png"
                alt="InfraNetra Logo"
                className="w-full h-full object-contain drop-shadow-xs"
              />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#0F9D8C] tracking-wider uppercase block">
                Government of India · MoSPI
              </span>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Officer Sign In · IPMD Portal
              </h2>
            </div>
          </div>
          <button
            id="close-signin-modal"
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-[#283C7D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-slate-700">
          <p className="text-slate-600 leading-relaxed">
            Select an authorized MoSPI officer profile below or use your official NIC/Gov credentials to authenticate:
          </p>

          {!useCustom ? (
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Authorized Officer Accounts
              </span>
              <div className="space-y-2">
                {AVAILABLE_PROFILES.map((prof) => {
                  const isSelected = selectedProfileId === prof.id;
                  return (
                    <button
                      key={prof.id}
                      type="button"
                      onClick={() => setSelectedProfileId(prof.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'border-[#0F9D8C] bg-teal-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#1B2B5B] text-[#0F9D8C] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#101A3D] text-xs truncate">
                              {prof.full_name}
                            </span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D8C] shrink-0" />
                          </div>
                          <p className="text-[11px] text-[#0F9D8C] font-medium leading-snug">
                            {prof.role}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {prof.email}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-[#0F9D8C] shrink-0 mt-2" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Cloudflare Turnstile Verification */}
              {renderTurnstileWidget()}

              <button
                type="button"
                id="btn-signin-profile"
                onClick={() => {
                  const prof = AVAILABLE_PROFILES.find((p) => p.id === selectedProfileId) || AVAILABLE_PROFILES[0];
                  handleSelectOfficer(prof);
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0F9D8C] hover:bg-[#0d8778] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <span>Sign In with Selected Profile</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setUseCustom(true)}
                  className="text-[11px] text-slate-500 hover:text-[#101A3D] underline cursor-pointer"
                >
                  Or enter custom Government credentials
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Official Gov Email Address
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => {
                      setCustomEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    placeholder="officer@mospi.gov.in"
                    className={`w-full pl-8 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 ${
                      emailError
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                        : 'border-slate-300 focus:border-[#0F9D8C] focus:ring-[#0F9D8C]'
                    }`}
                  />
                </div>
                {emailError && (
                  <p className="text-[11px] text-[#DC2626] mt-1 font-medium leading-tight">
                    {emailError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  NIC SSO / Parichay PIN
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={customPassword}
                    onChange={(e) => {
                      setCustomPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="••••••••"
                    className={`w-full pl-8 pr-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 ${
                      passwordError
                        ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                        : 'border-slate-300 focus:border-[#0F9D8C] focus:ring-[#0F9D8C]'
                    }`}
                  />
                </div>
                {passwordError && (
                  <p className="text-[11px] text-[#DC2626] mt-1 font-medium leading-tight">
                    {passwordError}
                  </p>
                )}
              </div>

              {/* Cloudflare Turnstile Verification */}
              {renderTurnstileWidget()}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUseCustom(false)}
                  className="w-1/3 py-2 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2 px-4 rounded-lg bg-[#0F9D8C] hover:bg-[#0d8778] text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-2.5 text-[10px] text-slate-500 flex items-center justify-end">
          <span>Protected by Cloudflare Turnstile</span>
        </div>
      </div>
    </div>
  );
};
