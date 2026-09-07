import React, { useState } from 'react';
import {
  Share2,
  Globe,
  ChevronDown,
} from 'lucide-react';


interface GovernmentHeaderProps {
  onNavigateHome?: () => void;
  onSkipToMain?: () => void;
}

export const GovernmentHeader: React.FC<GovernmentHeaderProps> = ({
  onNavigateHome,
  onSkipToMain,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<'English' | 'हिन्दी'>('English');
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(0); // -1: small, 0: default, +1: large

  const handleFontSizeChange = () => {
    const nextLevel = fontSizeLevel === 1 ? -1 : fontSizeLevel + 1;
    setFontSizeLevel(nextLevel);

    const root = document.documentElement;
    if (nextLevel === 1) {
      root.style.fontSize = '17px';
    } else if (nextLevel === -1) {
      root.style.fontSize = '15px';
    } else {
      root.style.fontSize = '16px';
    }
  };

  const handleSkip = () => {
    if (onSkipToMain) {
      onSkipToMain();
      return;
    }
    if (onNavigateHome) {
      onNavigateHome();
    }
    const mainContent = document.getElementById('main-scroll-viewport') || document.querySelector('main');
    if (mainContent) {
      mainContent.scrollIntoView({ behavior: 'smooth' });
      mainContent.focus();
    }
  };

  return (
    <div id="gov-portal-top-header" className="w-full shrink-0 bg-white border-b border-[#E2E8F0] select-none">
      {/* 1. Top Utility & Accessibility Bar (Standard GoI Portal Guideline) */}
      <div className="w-full bg-[#F8FAFC] border-b border-[#E2E8F0] px-2.5 sm:px-4 lg:px-5 py-1.5 text-xs text-[#475569]">
        <div className="w-full max-w-[99%] 2xl:max-w-[1920px] mx-auto flex items-center justify-between gap-3">
          {/* Left: भारत सरकार | GOVERNMENT OF INDIA */}
          <a
            href="https://www.india.gov.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold group cursor-pointer"
            title="National Portal of India — Government of India (india.gov.in)"
          >
            <span className="font-bold text-[#1E293B] group-hover:text-[#0F9D8C] tracking-wide transition-colors">
              भारत सरकार
            </span>
            <span className="text-slate-300">|</span>
            <span className="tracking-wider text-[#475569] group-hover:text-[#0F9D8C] uppercase font-medium transition-colors">
              Government of India
            </span>
          </a>

          {/* Right: Accessibility Controls & Utilities */}
          <div className="flex items-center gap-2.5 sm:gap-4 text-[11px]">
            {/* Skip to Main Content */}
            <button
              type="button"
              onClick={handleSkip}
              className="hidden md:inline-flex items-center text-slate-600 hover:text-[#0F9D8C] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              title="Skip to primary viewport content"
            >
              Skip to Main Content
            </button>

            <span className="hidden md:inline text-slate-300">|</span>

            {/* Font Size Adjuster (Tᴛ) */}
            <button
              type="button"
              onClick={handleFontSizeChange}
              className={`px-1.5 py-0.5 rounded font-bold text-[11px] border transition-colors cursor-pointer flex items-center gap-0.5 ${
                fontSizeLevel !== 0
                  ? 'bg-[#101A3D] text-white border-[#101A3D]'
                  : 'text-slate-700 hover:bg-slate-200/60 border-slate-300'
              }`}
              title="Adjust text display size (A- / A / A+)"
              aria-label="Text Size Adjustment"
            >
              <span className="text-xs">T</span>
              <span className="text-[10px]">ᴛ</span>
              {fontSizeLevel !== 0 && (
                <span className="text-[9px] font-mono-code ml-0.5">
                  {fontSizeLevel > 0 ? '+1' : '-1'}
                </span>
              )}
            </button>

            {/* Social Icons Strip (Twitter/X, YouTube, Facebook) */}
            <div className="hidden sm:flex items-center gap-1.5 text-slate-500">
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2] transition-colors"
                title="Official Twitter / X"
                aria-label="Twitter"
              >
                <span className="font-bold text-[10px]">𝕏</span>
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[#FF0000]/10 hover:text-[#FF0000] transition-colors text-[11px]"
                title="Official YouTube Broadcast"
                aria-label="YouTube"
              >
                ▶
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-[#1877F2]/10 hover:text-[#1877F2] transition-colors font-bold text-[11px]"
                title="Official Facebook"
                aria-label="Facebook"
              >
                f
              </a>
            </div>

            <span className="text-slate-300">|</span>

            {/* Language Selector (English / हिन्दी) */}
            <div className="relative inline-flex items-center">
              <select
                id="gov-header-lang-select"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value as any)}
                className="appearance-none bg-white border border-[#CBD5E1] rounded px-2 py-0.5 pr-5 text-[11px] font-semibold text-[#1E293B] hover:border-[#0F9D8C] focus:outline-none focus:ring-1 focus:ring-[#0F9D8C] cursor-pointer"
                aria-label="Select Portal Language"
              >
                <option value="English">English</option>
                <option value="हिन्दी">हिन्दी</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 pointer-events-none absolute right-1.5" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Official Header: Emblem + इन्फ्रानेत्रा InfraNetra + Swachh Bharat */}
      <div className="w-full px-2.5 sm:px-4 lg:px-5 py-1.5 sm:py-2 bg-white">
        <div className="w-full max-w-[99%] 2xl:max-w-[1920px] mx-auto flex items-center justify-between gap-4">
          {/* Left: Lion Capital Emblem + इन्फ्रानेत्रा / InfraNetra */}
          <div
            onClick={onNavigateHome}
            className="flex items-center gap-3 sm:gap-4 group cursor-pointer"
            role="button"
            tabIndex={0}
            title="InfraNetra — Go to Central Dashboard"
          >
            {/* InfraNetra Circular Infrastructure Logo */}
            <div className="shrink-0 transition-transform group-hover:scale-[1.03]">
              <img
                src="/infranetra-logo.png"
                alt="InfraNetra Logo"
                className="h-12 sm:h-14 w-auto object-contain drop-shadow-sm"
              />
            </div>

            {/* Brand Titles: इन्फ्रानेत्रा & InfraNetra */}
            <div className="flex flex-col justify-center">
              {/* Hindi Name: इन्फ्रानेत्रा */}
              <div className="text-base sm:text-[18px] font-extrabold text-[#1E293B] leading-tight tracking-normal font-sans">
                इन्फ्रानेत्रा
              </div>

              {/* English Name: InfraNetra */}
              <div className="text-lg sm:text-[22px] font-black text-[#101A3D] leading-none tracking-tight">
                InfraNe<span id="brand-letter-t">t</span>ra
              </div>

              {/* Official Portal Tagline / Government Context */}
              <div className="text-[10px] sm:text-[11px] text-[#64748B] font-medium tracking-wide mt-0.5 hidden xs:block">
                राष्ट्रीय अवसंरचना जोखिम आसूचना एवं प्रारंभिक चेतावनी प्रणाली
                <span className="hidden md:inline text-slate-400 mx-1.5">|</span>
                <span className="hidden md:inline font-sans text-slate-500">
                  National Infrastructure Risk Intelligence & Early Warning Portal
                </span>
              </div>
            </div>
          </div>

          {/* Right: Data for Development & Swachh Bharat Logos */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Data for Development Logo */}
            <div className="flex items-center justify-center h-11 sm:h-13 md:h-14 px-1">
              <img
                src="/data-for-development-logo.png"
                alt="Data for Development"
                className="h-full w-auto max-h-full object-contain drop-shadow-xs transition-transform duration-200 hover:scale-105"
              />
            </div>

            {/* Swachh Bharat Abhiyan Logo (एक कदम स्वच्छता की ओर) */}
            <div className="flex items-center justify-end h-11 sm:h-13 md:h-14 px-1">
              <img
                src="/swachh-bharat-logo.png"
                alt="Swachh Bharat Abhiyan - Ek Kadam Swachhata Ki Aur"
                className="h-full w-auto max-h-full object-contain drop-shadow-xs transition-transform duration-200 hover:scale-105"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
