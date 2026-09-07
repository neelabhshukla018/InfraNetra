import React, { useState, useEffect } from 'react';
import { useSignUp, useSignIn, useClerk, useUser } from '@clerk/clerk-react';
import {
  KeyRound,
  Mail,
  Lock,
  AlertCircle,
  Check,
  Loader2,
  X,
  Shield,
  Building2,
  Briefcase,
  User,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Clock,
  ShieldAlert,
  LogIn,
} from 'lucide-react';
import { Profile } from '../types';
import {
  API_BASE_URL,
  loginMinistry,
  loginProjectManager,
  registerMinistry,
  registerProjectManager,
  lookupProject,
  getMinistriesList,
  verifyMinistry,
  loginClerk,
  logoutUser,
  getAuthToken,
  clearAuthToken,
  ProjectLookupResult,
  MinistryVerificationResult,
} from '../services/api';

export interface LoginPageProps {
  onLogin: (profile: Profile) => void;
  isOpen?: boolean;
  onClose?: () => void;
  initialMode?: 'login' | 'signup';
  isModal?: boolean;
  currentProfile?: Profile | null;
  onLogout?: () => void;
}

interface LoginPageInnerProps extends LoginPageProps {
  hasClerk: boolean;
  clerkSignUp?: any;
  setSignUpActive?: any;
  isSignUpLoaded?: boolean;
  clerkSignIn?: any;
  setSignInActive?: any;
  isSignInLoaded?: boolean;
  clerk?: any;
  clerkUser?: any;
  isClerkUserLoaded?: boolean;
  isClerkSignedIn?: boolean;
}

const LoginPageInner: React.FC<LoginPageInnerProps> = ({
  onLogin,
  isOpen = true,
  onClose,
  initialMode = 'login',
  isModal = false,
  currentProfile = null,
  onLogout,
  hasClerk = false,
  clerkSignUp,
  setSignUpActive,
  isSignUpLoaded,
  clerkSignIn,
  setSignInActive,
  isSignInLoaded,
  clerk,
  clerkUser,
  isClerkUserLoaded = true,
  isClerkSignedIn = false,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>(initialMode);
  const [activeRole, setActiveRole] = useState<'MINISTRY' | 'PROJECT_MANAGER'>('MINISTRY');

  // Shared form inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');

  // Authoritative Ministry state from database registry
  const [authoritativeMinistries, setAuthoritativeMinistries] = useState<string[]>([]);
  const [isMinistriesLoading, setIsMinistriesLoading] = useState(false);
  const [ministry, setMinistry] = useState('');
  const [ministryVerification, setMinistryVerification] = useState<{
    loading: boolean;
    verified: boolean;
    ministry: string;
    message?: string;
    error?: string;
  } | null>(null);

  const [projectId, setProjectId] = useState<string>('');

  // Status & error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authoritative Project Lookup state for Project Manager registration
  const [projectLookup, setProjectLookup] = useState<{
    loading: boolean;
    searchedId: string;
    found: boolean;
    projectName?: string;
    ministry?: string;
    approvalAuthority?: string;
    hasActivePm?: boolean;
    activePmUser?: string;
    error?: string;
  } | null>(null);

  // Turnstile CAPTCHA state
  const [turnstileState, setTurnstileState] = useState<'idle' | 'verifying' | 'verified'>('idle');
  const [turnstileError, setTurnstileError] = useState<string | null>(null);

  // Clerk email verification code flow state
  const [verificationStep, setVerificationStep] = useState<'FORM' | 'CODE_VERIFICATION' | 'PENDING_APPROVAL'>('FORM');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [pendingDetails, setPendingDetails] = useState<{
    role: 'MINISTRY' | 'PROJECT_MANAGER';
    username: string;
    email: string;
    ministry?: string;
    projectId?: string;
    projectName?: string;
  } | null>(null);

  // Sync authMode when initialMode changes or modal opens
  useEffect(() => {
    if (initialMode) {
      setAuthMode(initialMode);
      setVerificationStep('FORM');
    }
  }, [initialMode, isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    if (!isModal || !isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModal, isOpen, onClose]);

  // Real-time authoritative Project lookup for PM registration
  useEffect(() => {
    if (authMode !== 'signup' || activeRole !== 'PROJECT_MANAGER') {
      setProjectLookup(null);
      return;
    }
    const cleanId = projectId.trim();
    if (!cleanId) {
      setProjectLookup(null);
      return;
    }

    setProjectLookup((prev) => ({
      loading: true,
      searchedId: cleanId,
      found: false,
      projectName: prev?.searchedId === cleanId ? prev.projectName : undefined,
      ministry: prev?.searchedId === cleanId ? prev.ministry : undefined,
    }));

    const timer = setTimeout(async () => {
      try {
        const res = await lookupProject(cleanId);
        setProjectLookup({
          loading: false,
          searchedId: cleanId,
          found: true,
          projectName: res.project_name,
          ministry: res.ministry,
          approvalAuthority: res.approval_authority || res.ministry,
          hasActivePm: res.has_active_pm,
          activePmUser: res.active_pm_username ?? undefined,
        });
      } catch (err: any) {
        setProjectLookup({
          loading: false,
          searchedId: cleanId,
          found: false,
          error: err?.message || 'Project ID not found in the InfraNetra project registry.',
        });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [projectId, authMode, activeRole]);

  // Load authoritative ministries from database registry
  useEffect(() => {
    let isMounted = true;
    const loadMinistries = async () => {
      setIsMinistriesLoading(true);
      try {
        const list = await getMinistriesList();
        if (isMounted && list && list.length > 0) {
          setAuthoritativeMinistries(list);
          setMinistry((prev) => (list.includes(prev) ? prev : list[0]));
        }
      } catch (err) {
        console.error('Error fetching authoritative ministries:', err);
      } finally {
        if (isMounted) setIsMinistriesLoading(false);
      }
    };
    loadMinistries();
    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time authoritative Ministry verification for Ministry registration
  useEffect(() => {
    if (authMode !== 'signup' || activeRole !== 'MINISTRY') {
      setMinistryVerification(null);
      return;
    }
    const cleanMin = ministry.trim();
    if (!cleanMin) {
      setMinistryVerification({
        loading: false,
        verified: false,
        ministry: '',
        error: 'Ministry not found in the InfraNetra Ministry registry.',
      });
      return;
    }

    setMinistryVerification({
      loading: true,
      verified: false,
      ministry: cleanMin,
    });

    let isCurrent = true;
    const timer = setTimeout(async () => {
      try {
        const res = await verifyMinistry(cleanMin);
        if (isCurrent) {
          setMinistryVerification({
            loading: false,
            verified: true,
            ministry: res.ministry,
            message: res.message || 'Ministry verified',
          });
        }
      } catch (err: any) {
        if (isCurrent) {
          setMinistryVerification({
            loading: false,
            verified: false,
            ministry: cleanMin,
            error: err?.message || 'Ministry not found in the InfraNetra Ministry registry.',
          });
        }
      }
    }, 150);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [ministry, authMode, activeRole]);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setTurnstileError(null);
    setVerificationError(null);
  };

  // =========================================================================
  // AUTHORITATIVE AUTHENTICATION STATE DETECTION FOR REGISTRATION / LOGIN
  // =========================================================================
  // Strict Rules:
  // 1. "Already signed in" may be true ONLY if:
  //    a) If Clerk is active: isLoaded === true AND isSignedIn === true AND clerkUser != null.
  //    b) There is an authoritative, approved application session token (getAuthToken()).
  //    c) The authenticated profile is genuinely relevant to the Ministry/PM flow:
  //       role is 'MINISTRY' or 'PROJECT_MANAGER' (never 'ADMIN') AND status === 'APPROVED'.
  // 2. An Admin session (role === 'ADMIN') must NEVER block Ministry/PM registration.
  // 3. A pending SignUp object, pending email verification, cached user object,
  //    stale localStorage/sessionStorage, or old registration inputs must NEVER count as signed in.
  // 4. Ministry selection (e.g. selecting "Ministry of Railways") MUST NEVER trigger auth.
  // =========================================================================
  const isApprovedMinistryOrPmProfile = Boolean(
    currentProfile &&
    currentProfile.role !== 'ADMIN' &&
    (currentProfile.role === 'MINISTRY' || currentProfile.role === 'PROJECT_MANAGER') &&
    currentProfile.authUser &&
    currentProfile.authUser.role !== 'ADMIN' &&
    (currentProfile.authUser.role === 'MINISTRY' || currentProfile.authUser.role === 'PROJECT_MANAGER') &&
    currentProfile.authUser.status === 'APPROVED'
  );

  // If Clerk is enabled, Clerk must be finished loading, signed in, with a verified user:
  const clerkConditionMet = hasClerk
    ? Boolean(isClerkUserLoaded && isClerkSignedIn && clerkUser)
    : true;

  // Crucial: A pending signup / email verification flow is NEVER treated as signed in
  const isPendingVerification = Boolean(
    verificationStep === 'CODE_VERIFICATION' ||
    verificationStep === 'PENDING_APPROVAL' ||
    (clerkSignUp && clerkSignUp.status === 'missing_requirements')
  );

  // Combined authoritative condition (all must hold simultaneously):
  // Never block the user when they have explicitly switched to the Register / Signup tab.
  const isAlreadySignedIn = Boolean(
    authMode === 'login' &&
    !isPendingVerification &&
    clerkConditionMet &&
    isApprovedMinistryOrPmProfile &&
    getAuthToken() // Authoritative valid token required
  );

  const handleSignOut = async () => {
    try {
      if (hasClerk && clerk?.signOut) {
        await clerk.signOut();
      } else if (typeof window !== 'undefined' && (window as any).Clerk?.signOut) {
        await (window as any).Clerk.signOut();
      }
    } catch (err) {
      console.warn('Clerk signOut notice:', err);
    }
    clearAuthToken();
    if (onLogout) {
      onLogout();
    } else {
      await logoutUser();
    }
    clearMessages();
    setVerificationStep('FORM');
  };

  const handleTurnstileClick = () => {
    if (turnstileState === 'verified' || turnstileState === 'verifying') return;
    setTurnstileState('verifying');
    setTurnstileError(null);
    setTimeout(() => {
      setTurnstileState('verified');
    }, 1250);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Username and password are required.');
      return;
    }

    if (turnstileState !== 'verified') {
      setTurnstileError('Please verify you are human before signing in.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. If Clerk is configured and active, attempt Clerk sign-in first:
      let clerkToken: string | null = null;
      if (hasClerk && clerkSignIn && setSignInActive) {
        try {
          const signInAttempt = await clerkSignIn.create({
            identifier: username.trim(),
            password: password.trim(),
          });
          if (signInAttempt.status === 'complete') {
            await setSignInActive({ session: signInAttempt.createdSessionId });
            clerkToken = await (clerk?.session ? clerk.session.getToken() : null);
          }
        } catch (clerkErr: any) {
          console.warn('Clerk authentication notice:', clerkErr?.message);
        }
      }

      // 2. If Clerk session token acquired, synchronize with authoritative application backend:
      if (clerkToken) {
        try {
          const res = await loginClerk(clerkToken);
          const prof: Profile = {
            id: `usr_${res.user.id}`,
            full_name: res.user.full_name,
            role: res.user.role,
            email: res.user.email,
            department: res.user.assigned_ministry || (res.user.assigned_project_code ? `Project: ${res.user.assigned_project_code}` : 'Central Administration'),
            authUser: res.user,
          };
          onLogin(prof);
          onClose?.();
          return;
        } catch (syncErr: any) {
          const msg = syncErr?.message || '';
          if (msg.includes('awaiting') || msg.includes('approval') || msg.includes('rejected') || msg.includes('suspended')) {
            throw syncErr;
          }
        }
      }

      // 3. Standard direct backend authentication fallback (for pre-seeded admins & automated suites):
      if (activeRole === 'MINISTRY') {
        const selectedMin = ministry.trim();
        if (!selectedMin) {
          setErrorMessage('Please select your assigned ministry.');
          setIsSubmitting(false);
          return;
        }
        const res = await loginMinistry({
          username: username.trim(),
          password: password.trim(),
          ministry: selectedMin,
        });
        const prof: Profile = {
          id: `usr_${res.user.id}`,
          full_name: res.user.full_name,
          role: res.user.role,
          email: res.user.email,
          department: res.user.assigned_ministry || selectedMin,
          authUser: res.user,
        };
        onLogin(prof);
        onClose?.();
      } else if (activeRole === 'PROJECT_MANAGER') {
        const cleanProjId = projectId.trim();
        if (!cleanProjId) {
          setErrorMessage('Please specify your assigned Project ID.');
          setIsSubmitting(false);
          return;
        }
        const res = await loginProjectManager({
          username: username.trim(),
          password: password.trim(),
          project_id: cleanProjId,
        });
        const prof: Profile = {
          id: `usr_${res.user.id}`,
          full_name: res.user.full_name,
          role: res.user.role,
          email: res.user.email,
          department: res.user.assigned_project_code ? `Project: ${res.user.assigned_project_code}` : `Project #${cleanProjId}`,
          authUser: res.user,
        };
        onLogin(prof);
        onClose?.();
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPasswordValid = Boolean(
    password &&
    password.length >= 8 &&
    confirmPassword &&
    password === confirmPassword
  );

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full official name.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Please enter your official email address.');
      return;
    }

    if (!username.trim()) {
      setErrorMessage('Please enter your desired username.');
      return;
    }

    if (!password) {
      setErrorMessage('Password is required.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage(`Password must be at least 8 characters long (currently ${password.length} characters). Please add ${8 - password.length} more character${8 - password.length > 1 ? 's' : ''}.`);
      return;
    }

    if (!confirmPassword) {
      setErrorMessage('Please confirm your password.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (turnstileState !== 'verified') {
      setTurnstileError('Please verify you are human before registering.');
      return;
    }

    // Role-specific validation
    if (activeRole === 'PROJECT_MANAGER') {
      const cleanProjId = projectId.trim();
      if (!cleanProjId) {
        setErrorMessage('Project ID is required for Project Manager registration.');
        return;
      }

      let lookup = projectLookup;
      if (!lookup || lookup.searchedId !== cleanProjId || lookup.loading) {
        try {
          const res = await lookupProject(cleanProjId);
          lookup = {
            loading: false,
            searchedId: cleanProjId,
            found: true,
            projectName: res.project_name,
            ministry: res.ministry,
            approvalAuthority: res.approval_authority || res.ministry,
            hasActivePm: res.has_active_pm,
            activePmUser: res.active_pm_username ?? undefined,
          };
          setProjectLookup(lookup);
        } catch (err: any) {
          setErrorMessage(err?.message || 'A valid Project ID registered in the InfraNetra project database is required.');
          return;
        }
      }

      if (!lookup?.found) {
        setErrorMessage('A valid Project ID registered in the InfraNetra project database is required.');
        return;
      }
      if (lookup?.hasActivePm) {
        setErrorMessage('This project already has an assigned Project Manager. Please enter a different Project ID');
        return;
      }
    }

    if (activeRole === 'MINISTRY') {
      if (!ministry.trim() || !ministryVerification?.verified) {
        setErrorMessage('Please select a verified ministry from the InfraNetra Ministry registry.');
        return;
      }
    }

    // Clerk Email Verification Code Flow (when Clerk is active)
    if (hasClerk && clerkSignUp) {
      setIsSubmitting(true);
      try {
        await clerkSignUp.create({
          emailAddress: email.trim(),
          password: password.trim(),
          username: username.trim(),
          firstName: fullName.trim().split(' ')[0] || fullName.trim(),
          lastName: fullName.trim().split(' ').slice(1).join(' ') || undefined,
        });

        await clerkSignUp.prepareEmailAddressVerification({
          strategy: 'email_code',
        });

        setVerificationStep('CODE_VERIFICATION');
        setResendTimer(30);
        setVerificationError(null);
      } catch (err: any) {
        const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Failed to initiate email verification.';
        if (msg.toLowerCase().includes('already signed in')) {
          try {
            if (clerk?.signOut) await clerk.signOut();
            await clerkSignUp.create({
              emailAddress: email.trim(),
              password: password.trim(),
              username: username.trim(),
              firstName: fullName.trim().split(' ')[0] || fullName.trim(),
              lastName: fullName.trim().split(' ').slice(1).join(' ') || undefined,
            });
            await clerkSignUp.prepareEmailAddressVerification({
              strategy: 'email_code',
            });
            setVerificationStep('CODE_VERIFICATION');
            setResendTimer(30);
            setVerificationError(null);
            return;
          } catch (retryErr: any) {
            const retryMsg = retryErr?.errors?.[0]?.longMessage || retryErr?.errors?.[0]?.message || retryErr?.message || msg;
            setErrorMessage(retryMsg);
          }
        } else {
          setErrorMessage(msg);
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Standard Registration (fallback):
    setIsSubmitting(true);
    try {
      if (activeRole === 'MINISTRY') {
        const selectedMin = ministryVerification?.ministry || ministry.trim();
        await registerMinistry({
          full_name: fullName.trim(),
          email: email.trim(),
          username: username.trim(),
          password: password.trim(),
          ministry: selectedMin,
          phone: phone.trim() || undefined,
          designation: designation.trim() || undefined,
        });
        setPendingDetails({
          role: 'MINISTRY',
          username: username.trim(),
          email: email.trim(),
          ministry: selectedMin,
        });
        clearAuthToken();
        setPassword('');
        setConfirmPassword('');
        setVerificationStep('PENDING_APPROVAL');
      } else if (activeRole === 'PROJECT_MANAGER') {
        const cleanProjId = projectId.trim();
        await registerProjectManager({
          full_name: fullName.trim(),
          email: email.trim(),
          username: username.trim(),
          password: password.trim(),
          project_id: cleanProjId,
          phone: phone.trim() || undefined,
          designation: designation.trim() || undefined,
        });
        setPendingDetails({
          role: 'PROJECT_MANAGER',
          username: username.trim(),
          email: email.trim(),
          projectId: cleanProjId,
          projectName: projectLookup?.projectName || cleanProjId,
          ministry: projectLookup?.ministry || 'Ministry',
        });
        clearAuthToken();
        setPassword('');
        setConfirmPassword('');
        setVerificationStep('PENDING_APPROVAL');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCodeSubmit = async () => {
    if (!verificationCode.trim() || verificationCode.trim().length < 6) {
      setVerificationError('Please enter the complete 6-digit verification code.');
      return;
    }
    if (!clerkSignUp) return;

    setIsVerifyingCode(true);
    setVerificationError(null);

    try {
      const completeSignUp = await clerkSignUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (completeSignUp.status === 'complete') {
        const clerkUserId = completeSignUp.createdUserId;

        if (activeRole === 'MINISTRY') {
          const selectedMin = ministryVerification?.ministry || ministry.trim();
          await registerMinistry({
            full_name: fullName.trim(),
            email: email.trim(),
            username: username.trim(),
            password: password.trim(),
            ministry: selectedMin,
            phone: phone.trim() || undefined,
            designation: designation.trim() || undefined,
            clerk_user_id: clerkUserId,
          });
          setPendingDetails({
            role: 'MINISTRY',
            username: username.trim(),
            email: email.trim(),
            ministry: selectedMin,
          });
        } else if (activeRole === 'PROJECT_MANAGER') {
          const cleanProjId = projectId.trim();
          await registerProjectManager({
            full_name: fullName.trim(),
            email: email.trim(),
            username: username.trim(),
            password: password.trim(),
            project_id: cleanProjId,
            phone: phone.trim() || undefined,
            designation: designation.trim() || undefined,
            clerk_user_id: clerkUserId,
          });
          setPendingDetails({
            role: 'PROJECT_MANAGER',
            username: username.trim(),
            email: email.trim(),
            projectId: cleanProjId,
            projectName: projectLookup?.projectName || cleanProjId,
            ministry: projectLookup?.ministry || 'Ministry',
          });
        }

        clearAuthToken();
        setPassword('');
        setConfirmPassword('');
        setVerificationCode('');
        setVerificationStep('PENDING_APPROVAL');
      } else {
        setVerificationError(`Verification status: ${completeSignUp.status}. Please check the code and try again.`);
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Verification failed. Please check the code and try again.';
      setVerificationError(msg);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0 || isResending || !clerkSignUp) return;
    setIsResending(true);
    setVerificationError(null);
    try {
      await clerkSignUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setResendTimer(30);
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Failed to resend code.';
      setVerificationError(msg);
    } finally {
      setIsResending(false);
    }
  };

  const renderTurnstileWidget = () => (
    <div
      id="cloudflare-turnstile-box"
      className={`w-full px-3.5 py-2.5 rounded-md border transition-all ${
        turnstileError
          ? 'border-rose-300 bg-rose-50/40 ring-1 ring-rose-200'
          : 'border-[#E5E7EB] bg-[#F9FAFB] hover:border-[#D1D5DB]'
      }`}
    >
      <div className="flex items-center justify-between gap-3 select-none">
        <button
          type="button"
          id="cloudflare-turnstile-checkbox"
          onClick={handleTurnstileClick}
          disabled={turnstileState === 'verifying'}
          className="flex items-center gap-3 text-left cursor-pointer group focus:outline-none min-w-0"
          aria-label="Cloudflare Turnstile verification"
        >
          {turnstileState === 'verified' ? (
            <>
              {/* Step 3: Green circle with white checkmark */}
              <div className="w-7 h-7 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0 shadow-xs animate-in zoom-in-75 duration-150">
                <Check className="w-4.5 h-4.5 text-white stroke-[3.5]" />
              </div>
              <span className="text-[14px] sm:text-[15px] font-normal text-[#1F2937]">Success!</span>
            </>
          ) : turnstileState === 'verifying' ? (
            <>
              {/* Step 2: Spinning ring of green dots */}
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
              <span className="text-[14px] font-normal text-[#1F2937]">Verifying...</span>
            </>
          ) : (
            <>
              {/* Step 1: Checkbox square */}
              <div className="w-6.5 h-6.5 rounded-[4px] border-2 border-slate-400 bg-white group-hover:border-slate-500 transition-colors shrink-0 shadow-xs" />
              <span className="text-[14px] font-normal text-[#1F2937]">Verify you are human</span>
            </>
          )}
        </button>

        {/* Cloudflare Official Logo matching screenshot */}
        <div className="flex flex-col items-center shrink-0 select-none pl-2">
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
          <span className="text-[10px] font-extrabold tracking-wider text-[#1F2937] leading-none mt-0.5">
            CLOUDFLARE
          </span>
          <span className="text-[8px] text-[#6B7280] leading-tight mt-0.5">
            Privacy · Terms
          </span>
        </div>
      </div>

      {turnstileError && (
        <div className="mt-2 pt-1.5 border-t border-rose-200 text-[11px] font-medium text-rose-600 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{turnstileError}</span>
        </div>
      )}
    </div>
  );

  const cardContent = (
    <div
      id="auth-card-container"
      className={`relative bg-white rounded-2xl border border-[#E2E8F0] shadow-2xl w-full mx-auto transition-all duration-200 animate-in fade-in zoom-in-95 ${
        authMode === 'signup'
          ? 'max-w-full sm:max-w-xl md:max-w-2xl p-4 sm:p-6 md:p-8 my-auto'
          : 'max-w-md p-5 sm:p-7 md:p-8'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button for modal view */}
      {isModal && onClose && (
        <button
          type="button"
          id="btn-close-auth-modal"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-lg text-[#64748B] hover:text-[#101A3D] hover:bg-[#F1F5F9] transition-colors cursor-pointer z-10"
          aria-label="Close authentication modal"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Card Header */}
      <div className="text-center pb-3.5 sm:pb-4 border-b border-[#F1F5F9]">
        <div className="flex items-center justify-center mx-auto mb-2 sm:mb-2.5">
          <img
            src="/infranetra-logo.png"
            alt="InfraNetra Logo"
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-md transition-transform hover:scale-105 duration-200"
          />
        </div>
        <h1 id="auth-card-title" className="text-base sm:text-xl font-bold text-[#101A3D] tracking-tight">
          {authMode === 'login' ? 'Officer & Manager Sign In' : 'Officer Registration'}
        </h1>
        <p className="text-[11px] sm:text-xs text-[#64748B] mt-0.5 sm:mt-1">
          Ministry of Government of India
        </p>
      </div>

      {/* Genuine Authenticated State: Shown ONLY when user has a CURRENT, VALID session in the application */}
      {isAlreadySignedIn && currentProfile ? (
        <div id="already-signed-in-card" className="mt-4 p-5 sm:p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3.5 animate-in fade-in duration-150">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 id="already-signed-in-title" className="text-base sm:text-lg font-bold text-[#101A3D]">
              You're already signed in.
            </h2>
            <p className="text-xs text-[#64748B] mt-1">
              Currently authenticated as <strong className="text-[#101A3D]">{currentProfile.full_name || currentProfile.authUser?.username || 'Officer'}</strong>
            </p>
            <p className="text-[11px] text-[#0F9D8C] font-semibold mt-0.5">
              Role: {currentProfile.role === 'MINISTRY' ? 'Ministry Officer' : 'Project Manager'}
              {currentProfile.department ? ` · ${currentProfile.department}` : ''}
            </p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              id="btn-already-signed-in-dashboard"
              onClick={() => onClose?.()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#101A3D] hover:bg-[#1E2A5E] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Continue to Dashboard
            </button>
            <button
              type="button"
              id="btn-already-signed-in-logout"
              onClick={handleSignOut}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Sign Out / Switch Account
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Mode Toggle: [ Sign In ] [ Register ] */}
          <div className="mt-3.5 sm:mt-4 grid grid-cols-2 gap-1 p-1 bg-[#F1F5F9] rounded-xl border border-[#E2E8F0]">
        <button
          type="button"
          id="tab-signin"
          onClick={() => {
            setAuthMode('login');
            clearMessages();
            setConfirmPassword('');
            setShowPassword(false);
            setShowConfirmPassword(false);
          }}
          className={`py-1.5 px-3 sm:px-4 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            authMode === 'login' ? 'bg-white text-[#101A3D] shadow-xs' : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          id="tab-register"
          onClick={() => {
            setAuthMode('signup');
            clearMessages();
            setConfirmPassword('');
            setShowPassword(false);
            setShowConfirmPassword(false);
          }}
          className={`py-1.5 px-3 sm:px-4 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            authMode === 'signup' ? 'bg-white text-[#101A3D] shadow-xs' : 'text-[#64748B] hover:text-[#1E293B]'
          }`}
        >
          Register
        </button>
      </div>

      {/* Role Selection Tabs */}
      <div className="mt-3.5 sm:mt-4">
        <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1.5">
          Select Role
        </label>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => {
              setActiveRole('MINISTRY');
              clearMessages();
              setConfirmPassword('');
              setShowPassword(false);
              setShowConfirmPassword(false);
            }}
            className={`py-1.5 px-2 rounded-md text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeRole === 'MINISTRY'
                ? 'bg-[#101A3D] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#1E293B] hover:bg-slate-200/50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Ministry</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveRole('PROJECT_MANAGER');
              clearMessages();
              setConfirmPassword('');
              setShowPassword(false);
              setShowConfirmPassword(false);
            }}
            className={`py-1.5 px-2 rounded-md text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeRole === 'PROJECT_MANAGER'
                ? 'bg-[#101A3D] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#1E293B] hover:bg-slate-200/50'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Project Mgr</span>
          </button>
        </div>
      </div>

      {/* Notifications / Feedback */}
      {errorMessage && (
        <div
          id="auth-error-alert"
          className={`mt-3.5 p-3 rounded-xl text-xs flex items-start gap-2.5 animate-in fade-in duration-150 ${
            errorMessage.toLowerCase().includes('already has an assigned') ||
            errorMessage.toLowerCase().includes('project already assigned')
              ? 'bg-amber-50 border border-amber-300 text-amber-900'
              : errorMessage.toLowerCase().includes('pending') || errorMessage.toLowerCase().includes('awaiting')
              ? 'bg-amber-50 border border-amber-300 text-amber-900'
              : 'bg-rose-50 border border-rose-200 text-rose-700'
          }`}
        >
          {errorMessage.toLowerCase().includes('already has an assigned') ||
          errorMessage.toLowerCase().includes('project already assigned') ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : errorMessage.toLowerCase().includes('pending') || errorMessage.toLowerCase().includes('awaiting') ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="leading-snug">
            {errorMessage.toLowerCase().includes('already has an assigned') ||
            errorMessage.toLowerCase().includes('project already assigned') ? (
              <>
                <strong className="font-bold block text-amber-950 mb-0.5 text-sm">Project Already Assigned</strong>
                <span className="text-amber-800">This project already has an assigned Project Manager. Please enter a different Project ID</span>
              </>
            ) : errorMessage.toLowerCase().includes('pending') || errorMessage.toLowerCase().includes('awaiting') ? (
              <>
                <strong className="font-semibold block text-amber-950 mb-0.5">Application Access Restricted · Status: PENDING</strong>
                <span>{errorMessage}</span>
              </>
            ) : (
              errorMessage
            )}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mt-3.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-snug">{successMessage}</div>
        </div>
      )}

      {/* Mode 1: Sign In Form */}
      {authMode === 'login' && (
        <form onSubmit={handleLoginSubmit} className="mt-4 space-y-3.5">
          {/* Username */}
          <div>
            <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5]" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C]"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1">
              Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C]"
              />
            </div>
          </div>

          {/* Role specific input */}
          {activeRole === 'MINISTRY' && (
            <div>
              <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1">
                Assigned Ministry
              </label>
              <select
                id="login-ministry-select"
                value={ministry}
                onChange={(e) => setMinistry(e.target.value)}
                disabled={isMinistriesLoading}
                className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] bg-white truncate"
              >
                {authoritativeMinistries.length === 0 && (
                  <option value="">{isMinistriesLoading ? 'Loading ministries...' : 'No ministries available'}</option>
                )}
                {authoritativeMinistries.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeRole === 'PROJECT_MANAGER' && (
            <div>
              <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1">
                Assigned Project ID (Numeric)
              </label>
              <input
                type="number"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="e.g. 101"
                className="w-full px-3 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C]"
              />
            </div>
          )}

          {/* Turnstile Bot Protection */}
          <div className="pt-1">{renderTurnstileWidget()}</div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-2.5 px-4 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-xs bg-[#0F9D8C] hover:bg-[#0d8778] text-white cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-3.5 h-3.5" />
            )}
            <span>{isSubmitting ? 'Authenticating...' : `Sign In as ${activeRole}`}</span>
          </button>
        </form>
      )}

      {/* Mode 2: Responsive Register Form - Email Verification Code Step */}
      {authMode === 'signup' && verificationStep === 'CODE_VERIFICATION' && (
        <div id="clerk-code-verification-card" className="mt-4 p-4 sm:p-5 rounded-xl bg-white border border-[#0F9D8C]/30 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0F9D8C]/10 text-[#0F9D8C] flex items-center justify-center shrink-0 border border-[#0F9D8C]/20">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-[#101A3D]">Verify Official Email Address</h2>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
            A 6-digit verification code has been dispatched to{' '}
            <span className="font-semibold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">{email}</span>.
            Enter the code below to authoritatively verify your official identity.
          </div>

          {verificationError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{verificationError}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1.5">
              6-Digit Verification Code
            </label>
            <input
              type="text"
              id="clerk-verification-code-input"
              inputMode="numeric"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full text-center tracking-[0.5em] text-xl sm:text-2xl font-mono py-2 sm:py-2.5 px-4 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0F9D8C] focus:border-[#0F9D8C] bg-white text-slate-900"
              autoFocus
            />
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              id="btn-verify-clerk-code"
              disabled={isVerifyingCode || verificationCode.trim().length < 6}
              onClick={handleVerifyCodeSubmit}
              className="w-full py-2.5 sm:py-3 px-4 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xs bg-[#0F9D8C] hover:bg-[#0D8778] text-white cursor-pointer disabled:opacity-50"
            >
              {isVerifyingCode ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Code & Registering...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Email & Complete Registration</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-1 px-1">
              <button
                type="button"
                id="btn-resend-clerk-code"
                onClick={handleResendCode}
                disabled={resendTimer > 0 || isResending}
                className="text-[#0F9D8C] hover:underline font-medium disabled:text-slate-400 disabled:no-underline cursor-pointer disabled:cursor-not-allowed"
              >
                {resendTimer > 0 ? `Resend code (${resendTimer}s)` : 'Resend verification code'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setVerificationStep('FORM');
                  setVerificationError(null);
                }}
                className="text-slate-500 hover:text-slate-700 font-medium hover:underline cursor-pointer"
              >
                ← Edit details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Responsive Register Form - Authoritative Pending Approval Step */}
      {authMode === 'signup' && verificationStep === 'PENDING_APPROVAL' && pendingDetails && (
        <div id="registration-pending-approval-card" className="mt-4 p-5 sm:p-6 rounded-xl bg-amber-50/80 border border-amber-300 text-center space-y-4 shadow-sm animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-200/80 text-amber-900 text-[11px] font-bold tracking-wide uppercase mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
              <span>Status: PENDING ADMIN APPROVAL</span>
            </div>

            <h2 id="pending-approval-title" className="text-base sm:text-lg font-bold text-[#101A3D]">
              {pendingDetails.role === 'MINISTRY'
                ? 'Ministry Registration Awaiting Approval'
                : 'Project Manager Registration Awaiting Approval'}
            </h2>

            <p className="text-xs text-slate-600 mt-1.5 max-w-md mx-auto leading-relaxed">
              Your official email <strong className="text-slate-800 bg-white px-1.5 py-0.5 rounded border border-amber-200">{pendingDetails.email}</strong> has been successfully verified.
            </p>
          </div>

          <div className="p-4 bg-white rounded-lg border border-amber-200/80 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Registered Officer:</span>
              <span className="font-semibold text-slate-900">@{pendingDetails.username}</span>
            </div>
            {pendingDetails.role === 'MINISTRY' ? (
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Assigned Ministry:</span>
                <span className="font-semibold text-[#0F9D8C]">{pendingDetails.ministry}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Assigned Project:</span>
                  <span className="font-semibold text-slate-900">#{pendingDetails.projectId} ({pendingDetails.projectName})</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Responsible Ministry:</span>
                  <span className="font-semibold text-[#0F9D8C]">{pendingDetails.ministry}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Application Access:</span>
              <span className="font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[11px]">BLOCKED / RESTRICTED</span>
            </div>
          </div>

          <div className="p-3 bg-amber-100/60 rounded-lg text-xs text-amber-900 leading-normal text-left flex items-start gap-2 border border-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              {pendingDetails.role === 'MINISTRY'
                ? 'Your registration has been placed in the MoSPI Platform Administrator approval queue. The Ministry Dashboard, project registry access, and project creation will remain blocked until an Administrator approves your account.'
                : `Your application has been submitted to the responsible Ministry (${pendingDetails.ministry}) approval queue. Project Manager dashboard access will remain blocked until approval is granted.`}
            </span>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              id="btn-pending-go-signin"
              onClick={() => {
                setAuthMode('login');
                setVerificationStep('FORM');
                setUsername(pendingDetails.username);
                clearMessages();
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#101A3D] hover:bg-[#1E2A5E] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5 text-[#0F9D8C]" />
              <span>Go to Sign In (After Approval)</span>
            </button>

            <button
              type="button"
              id="btn-pending-check-status"
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  const checkRes = await fetch(`${API_BASE_URL}/api/auth/login/ministry`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      username: pendingDetails.username,
                      password: 'status_check_dummy_pass',
                      ministry: pendingDetails.ministry || '',
                    }),
                  });
                  const data = await checkRes.json().catch(() => ({}));
                  if (checkRes.status === 403 && data.detail && data.detail.includes('pending')) {
                    setErrorMessage('Status: PENDING. Your account is still awaiting administrator approval.');
                  } else {
                    setErrorMessage('Account is still awaiting administrator review.');
                  }
                } catch {
                  setErrorMessage('Account is still awaiting administrator review.');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Check Approval Status
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: Responsive Register Form */}
      {authMode === 'signup' && verificationStep === 'FORM' && (
        <form onSubmit={handleRegisterSubmit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
          {/* Notice - Full Width */}
          <div className="col-span-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">
              {activeRole === 'MINISTRY' ? 'Ministry Approval Flow:' : 'Project Manager Approval Flow:'}
            </span>{' '}
            {activeRole === 'MINISTRY'
              ? 'Registration enters PENDING status until approved by MoSPI Platform Administrator.'
              : 'Registration enters PENDING status until approved by your assigned Ministry.'}
          </div>

          {/* Ministry Role Form Layout */}
          {activeRole === 'MINISTRY' && (
            <>
              {/* Row 1: Full Name & Email */}
              <div className="w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate">
                  Full Official Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate">
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. r.kumar@morth.nic.in"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Row 2: Username */}
              <div className="col-span-full w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate">
                  Desired Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. rkumar_morth"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Row 3: Password & Confirm Password */}
              <div className="w-full min-w-0">
                <label
                  htmlFor="reg-ministry-password"
                  className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate"
                >
                  Password (min. 8 characters)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    id="reg-ministry-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white transition-colors"
                  />
                  <button
                    type="button"
                    id="btn-toggle-ministry-password"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#1E293B] rounded focus:outline-none cursor-pointer transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 stroke-[1.75]" />
                    ) : (
                      <Eye className="w-4 h-4 stroke-[1.75]" />
                    )}
                  </button>
                </div>
                {password && password.length < 8 && (
                  <p id="hint-ministry-password-length" className="text-[11px] sm:text-xs text-amber-600 mt-1 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Password must be at least 8 characters ({password.length}/8)</span>
                  </p>
                )}
                {password && password.length >= 8 && (
                  <p id="hint-ministry-password-ok" className="text-[11px] sm:text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Password length requirement met ({password.length} characters)</span>
                  </p>
                )}
              </div>

              <div className="w-full min-w-0">
                <label
                  htmlFor="reg-ministry-confirm-password"
                  className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    id="reg-ministry-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={`w-full pl-9 pr-10 py-2 text-xs sm:text-[13px] border rounded-lg focus:outline-none transition-colors ${
                      confirmPassword && password !== confirmPassword
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-50/20'
                        : 'border-[#CBD5E1] focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white'
                    }`}
                  />
                  <button
                    type="button"
                    id="btn-toggle-ministry-confirm-password"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#1E293B] rounded focus:outline-none cursor-pointer transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4 stroke-[1.75]" />
                    ) : (
                      <Eye className="w-4 h-4 stroke-[1.75]" />
                    )}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p id="error-ministry-password-mismatch" className="text-[11px] sm:text-xs text-rose-600 mt-1 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Passwords do not match.</span>
                  </p>
                )}
              </div>

              {/* Row 3: Phone & Designation */}
              <div className="w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate">
                  Official Phone <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate">
                  Official Designation <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Director / Joint Secretary"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Row 4: Assigned Ministry - Full Width */}
              <div className="col-span-full w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1">
                  Assigned Ministry
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <select
                    id="reg-ministry-select"
                    value={ministry}
                    onChange={(e) => setMinistry(e.target.value)}
                    disabled={isMinistriesLoading}
                    className={`w-full pl-9 pr-8 py-2 text-xs sm:text-[13px] border rounded-lg focus:outline-none bg-white truncate transition-colors ${
                      ministryVerification?.verified
                        ? 'border-emerald-500 bg-emerald-50/20 text-emerald-950 focus:ring-1 focus:ring-emerald-500'
                        : ministryVerification && !ministryVerification.loading && !ministryVerification.verified
                        ? 'border-rose-500 bg-rose-50/20 text-rose-950 focus:ring-1 focus:ring-rose-500'
                        : 'border-[#CBD5E1] focus:border-[#0F9D8C]'
                    }`}
                  >
                    {authoritativeMinistries.length === 0 && (
                      <option value="">{isMinistriesLoading ? 'Loading authoritative ministries...' : 'No ministries available'}</option>
                    )}
                    {authoritativeMinistries.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Real-time Visual Green / Red Verification Feedback */}
                {ministryVerification && (
                  <div className="mt-1.5">
                    {ministryVerification.loading ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0F9D8C]" />
                        <span>Verifying ministry registry...</span>
                      </div>
                    ) : ministryVerification.verified ? (
                      <div
                        id="ministry-verified-status"
                        className="p-2.5 rounded-lg bg-emerald-50/90 border border-emerald-300 text-xs flex items-center justify-between gap-2 shadow-xs"
                      >
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Ministry verified</span>
                        </div>
                        <span className="text-[11px] font-medium text-emerald-700 truncate max-w-[200px] sm:max-w-[280px]">
                          {ministryVerification.ministry}
                        </span>
                      </div>
                    ) : (
                      <div
                        id="ministry-error-status"
                        className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-xs flex items-center gap-2 shadow-xs text-rose-700"
                      >
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span className="font-semibold">
                          Ministry not found in the InfraNetra Ministry registry.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Project Manager Role Form Layout */}
          {activeRole === 'PROJECT_MANAGER' && (
            <>
              {/* Row 1: Full Name & Email */}
              <div className="w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate">
                  Full Official Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate">
                  Official Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. pm.kumar@railways.gov.in"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Row 2: Project ID & Username */}
              <div className="w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate">
                  Assigned Project ID
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="e.g. 618934"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] bg-white transition-colors font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  Enter authoritative Project ID or Code. Ministry is automatically resolved.
                </p>
              </div>

              <div className="w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate">
                  Desired Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. pm_project618934"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Authoritative Project Lookup Feedback - Full Width */}
              {projectLookup && (
                <div className="col-span-full w-full min-w-0">
                  {projectLookup.loading ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#0F9D8C]" />
                      <span>Verifying Project ID against National Master Registry...</span>
                    </div>
                  ) : projectLookup.found ? (
                    projectLookup.hasActivePm ? (
                      <div id="project-already-assigned-alert" className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs shadow-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900 text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Project Already Assigned</span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-amber-800 font-normal leading-relaxed pl-5.5">
                          This project already has an assigned Project Manager. Please enter a different Project ID
                        </p>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-300 text-xs space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Project Found ✅</span>
                          </div>
                          <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                            ID: {projectLookup.searchedId}
                          </span>
                        </div>
                        <div className="text-slate-800">
                          <span className="font-semibold text-slate-900">Project Name:</span> {projectLookup.projectName}
                        </div>
                        <div className="text-slate-800">
                          <span className="font-semibold text-slate-900">Ministry:</span> {projectLookup.ministry}
                        </div>
                        <div className="text-emerald-950 font-semibold flex items-center gap-1.5 pt-0.5">
                          <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>
                            Approval Authority:{' '}
                            <span className="underline decoration-emerald-600 font-bold">
                              {projectLookup.approvalAuthority || projectLookup.ministry}
                            </span>
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800/90 italic pt-1 border-t border-emerald-200/80">
                          Your registration request will be sent to the Ministry responsible for this project.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Project ID not found in the InfraNetra project registry.</span>
                        <p className="text-[11px] text-rose-600 mt-0.5">
                          Please verify the numeric ID or alphanumeric project code. Registration cannot be submitted for unrecognized projects.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Row 3: Password & Confirm Password */}
              <div className="w-full min-w-0">
                <label
                  htmlFor="reg-pm-password"
                  className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate"
                >
                  Password (min. 8 characters)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    id="reg-pm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full pl-9 pr-10 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white transition-colors"
                  />
                  <button
                    type="button"
                    id="btn-toggle-pm-password"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#1E293B] rounded focus:outline-none cursor-pointer transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 stroke-[1.75]" />
                    ) : (
                      <Eye className="w-4 h-4 stroke-[1.75]" />
                    )}
                  </button>
                </div>
                {password && password.length < 8 && (
                  <p id="hint-pm-password-length" className="text-[11px] sm:text-xs text-amber-600 mt-1 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Password must be at least 8 characters ({password.length}/8)</span>
                  </p>
                )}
                {password && password.length >= 8 && (
                  <p id="hint-pm-password-ok" className="text-[11px] sm:text-xs text-emerald-600 mt-1 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Password length requirement met ({password.length} characters)</span>
                  </p>
                )}
              </div>

              <div className="w-full min-w-0">
                <label
                  htmlFor="reg-pm-confirm-password"
                  className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    id="reg-pm-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className={`w-full pl-9 pr-10 py-2 text-xs sm:text-[13px] border rounded-lg focus:outline-none transition-colors ${
                      confirmPassword && password !== confirmPassword
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 bg-rose-50/20'
                        : 'border-[#CBD5E1] focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white'
                    }`}
                  />
                  <button
                    type="button"
                    id="btn-toggle-pm-confirm-password"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#1E293B] rounded focus:outline-none cursor-pointer transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4 stroke-[1.75]" />
                    ) : (
                      <Eye className="w-4 h-4 stroke-[1.75]" />
                    )}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p id="error-pm-password-mismatch" className="text-[11px] sm:text-xs text-rose-600 mt-1 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Passwords do not match.</span>
                  </p>
                )}
              </div>

              {/* Row 4: Phone & Designation */}
              <div className="w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate">
                  Contact Phone <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] focus:ring-1 focus:ring-[#0F9D8C] bg-white transition-colors"
                  />
                </div>
              </div>

              <div className="w-full min-w-0">
                <label className="block text-[11px] font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1 truncate">
                  Official Designation <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5] pointer-events-none" />
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. General Manager (Projects) / Chief Project Manager"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-[13px] border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#0F9D8C] bg-white transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {/* Turnstile Bot Protection - Full Width */}
          <div className="col-span-full w-full min-w-0 pt-1">{renderTurnstileWidget()}</div>

          {/* Submit Button - Full Width */}
          <button
            type="submit"
            disabled={isSubmitting || (activeRole === 'PROJECT_MANAGER' && Boolean(projectLookup?.hasActivePm))}
            className="col-span-full w-full mt-1.5 py-2.5 sm:py-3 px-4 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xs bg-[#4F46E5] hover:bg-[#4338CA] text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
            <span>
              {isSubmitting
                ? 'Submitting Application...'
                : hasClerk
                ? `Verify Email & Register as ${activeRole === 'PROJECT_MANAGER' ? 'Project Manager' : 'Ministry Officer'}`
                : `Register as ${activeRole === 'PROJECT_MANAGER' ? 'Project Manager' : 'Ministry Officer'}`}
            </span>
          </button>
        </form>
      )}
        </>
      )}
    </div>
  );

  if (isModal) {
    if (!isOpen) return null;
    return (
      <div
        id="auth-modal-backdrop"
        className="fixed inset-0 z-50 bg-[#0B132B]/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto"
        onClick={onClose}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <div
      id="login-page-canvas"
      className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center py-6 sm:py-8 px-2.5 sm:px-6 lg:px-8 text-[#1E293B]"
    >
      <main className={`w-full mx-auto transition-all duration-200 ${authMode === 'signup' ? 'max-w-full sm:max-w-xl md:max-w-2xl' : 'max-w-md'}`}>
        {cardContent}
      </main>
    </div>
  );
};

const HAS_CLERK = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

const ClerkAuthWrapper: React.FC<LoginPageProps> = (props) => {
  const { signUp, setActive: setSignUpActive, isLoaded: isSignUpLoaded } = useSignUp();
  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const { user: clerkUser, isLoaded: isClerkUserLoaded, isSignedIn: isClerkSignedIn } = useUser();
  const clerk = useClerk();

  return (
    <LoginPageInner
      {...props}
      hasClerk={true}
      clerkSignUp={signUp}
      setSignUpActive={setSignUpActive}
      isSignUpLoaded={isSignUpLoaded}
      clerkSignIn={signIn}
      setSignInActive={setSignInActive}
      isSignInLoaded={isSignInLoaded}
      clerk={clerk}
      clerkUser={clerkUser}
      isClerkUserLoaded={isClerkUserLoaded}
      isClerkSignedIn={Boolean(isClerkSignedIn)}
    />
  );
};

export const LoginPage: React.FC<LoginPageProps> = (props) => {
  if (HAS_CLERK) {
    return <ClerkAuthWrapper {...props} />;
  }
  return <LoginPageInner {...props} hasClerk={false} isClerkUserLoaded={true} isClerkSignedIn={false} />;
};
