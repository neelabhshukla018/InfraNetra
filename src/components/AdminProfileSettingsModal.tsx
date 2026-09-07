import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Briefcase,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Profile } from '../types';
import { updateProfile } from '../services/api';

interface AdminProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile;
  onProfileUpdated: (updatedProfile: Profile) => void;
}

export const AdminProfileSettingsModal: React.FC<AdminProfileSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
}) => {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [email, setEmail] = useState(profile.email || '');
  const [designation, setDesignation] = useState(
    profile.designation || profile.authUser?.designation || ''
  );
  const [department, setDepartment] = useState(profile.department || '');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Full official name is required.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailPattern.test(email.trim())) {
      setError('A valid official email address is required.');
      return;
    }

    if (!department.trim()) {
      setError('Department / Organization is required.');
      return;
    }

    setIsSaving(true);

    try {
      const res = await updateProfile({
        full_name: fullName.trim(),
        email: email.trim(),
        designation: designation.trim() || undefined,
        department: department.trim(),
      });

      const updated: Profile = {
        ...profile,
        full_name: res.user.full_name,
        email: res.user.email,
        designation: res.user.designation || null,
        department: res.user.department || profile.department,
        authUser: res.user,
      };

      onProfileUpdated(updated);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || 'Failed to update administrator profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="modal-admin-profile-settings"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Top Header Bar */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#101A3D] via-[#1C2C64] to-[#253982] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-[#0F9D8C]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Administrator Profile Settings
              </h2>
              <p className="text-[11px] text-slate-300">
                Authoritative single Admin identity management
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Authoritative profile updated successfully.</span>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label
              htmlFor="input-settings-fullname"
              className="block text-xs font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1.5"
            >
              Full Official Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.5]" />
              <input
                id="input-settings-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rajesh Kumar"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all bg-white"
              />
            </div>
          </div>

          {/* Official Email Address */}
          <div>
            <label
              htmlFor="input-settings-email"
              className="block text-xs font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1.5"
            >
              Official Email Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.5]" />
              <input
                id="input-settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. r.kumar@morth.nic.in"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all bg-white"
              />
            </div>
          </div>

          {/* Official Designation */}
          <div>
            <label
              htmlFor="input-settings-designation"
              className="block text-xs font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1.5"
            >
              Official Designation
            </label>
            <div className="relative">
              <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.5]" />
              <input
                id="input-settings-designation"
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g. Director / Joint Secretary / Administrator"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all bg-white"
              />
            </div>
          </div>

          {/* Department / Organization */}
          <div>
            <label
              htmlFor="input-settings-department"
              className="block text-xs font-semibold text-[#1E293B] uppercase tracking-[0.04em] mb-1.5"
            >
              Department / Organization <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 stroke-[1.5]" />
              <input
                id="input-settings-department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Infrastructure & Project Monitoring Division (IPMD), MoSPI"
                className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-all bg-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-save-profile-settings"
              disabled={isSaving}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#101A3D] to-[#253982] hover:from-[#0B132B] hover:to-[#1B2B60] rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Profile Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
