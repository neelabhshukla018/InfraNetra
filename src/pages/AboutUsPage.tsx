import React from 'react';
import {
  ShieldCheck,
  Target,
  Cpu,
  Layers,
  FileSpreadsheet,
  Building2,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Globe2,
  Lock,
  Compass,
  Code2,
  Server,
  Terminal,
  Shield,
  Bug,
  KeyRound,
  CheckCircle,
  Instagram,
  Github,
  Linkedin,
} from 'lucide-react';
import { NavPage } from '../components/Navbar';

interface TeamMember {
  name: string;
  role: string;
  category: 'Frontend' | 'Backend' | 'Security & QA' | 'Security' | 'Frontend & Security';
  monogram: string;
  avatarBg: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  summary: string;
  socials: {
    instagram?: string;
    github?: string;
    linkedin?: string;
  };
}

const CORE_TEAM: TeamMember[] = [
  {
    name: 'Abhishek Gupta',
    role: 'Frontend Developer',
    category: 'Frontend',
    monogram: 'AG',
    avatarBg: 'bg-gradient-to-br from-[#0F9D8C] to-[#115E59]',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-[#0F9D8C]',
    badgeBorder: 'border-teal-200',
    summary:
      'Spearheading the client architecture, responsive geospatial corridors, real-time variance charts, and accessible interfaces conforming to IPMD design standards.',
    socials: {
      instagram: 'https://www.instagram.com/abhishekabhi_78?stkn=MW1lcGZ1cW84bXAzbg==',
      github: 'https://github.com/abhishekabhi78',
      linkedin: 'https://www.linkedin.com/in/abhishek-gupta-72252132b/',
    },
  },
  {
    name: 'Praveen Yadav',
    role: 'Backend Developer',
    category: 'Backend',
    monogram: 'PY',
    avatarBg: 'bg-gradient-to-br from-[#2563EB] to-[#1E3A8A]',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-200',
    summary:
      'Architecting resilient distributed microservices, high-throughput REST APIs, caching layers, and real-time telemetry streaming for national infrastructure monitoring.',
    socials: {
      instagram: 'https://www.instagram.com/mr_praveen_45_?stkn=MWNrNXE4ejhuengxbw==',
      github: 'https://github.com/praveenlp45',
      linkedin: 'https://www.linkedin.com/in/praveenyadav2005/',
    },
  },
  {
    name: 'Adarsh Sahani',
    role: 'Backend Developer',
    category: 'Backend',
    monogram: 'AS',
    avatarBg: 'bg-gradient-to-br from-[#4F46E5] to-[#312E81]',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
    summary:
      'Engineering the PAIMANA Flash Report parsing pipeline, multi-format tabular ingestion engines, and deterministic financial reconciliation calculations.',
    socials: {
      instagram: 'https://www.instagram.com/adarshsahani10?stkn=bHdwamt3am5vMGxj',
      github: 'https://github.com/sahaniadarsh23-ship-it',
      linkedin: 'https://www.linkedin.com/in/adarsh-sahani-581524322/',
    },
  },
  {
    name: 'Vedant Singh',
    role: 'Backend Developer',
    category: 'Backend',
    monogram: 'VS',
    avatarBg: 'bg-gradient-to-br from-[#0284C7] to-[#0369A1]',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    badgeBorder: 'border-sky-200',
    summary:
      'Managing scalable cloud microservice orchestration, asynchronous background processing, job queues, and predictive early-warning notification triggers.',
    socials: {
      instagram: 'https://www.instagram.com/_rajput_vedant?stkn=ZzU4ZWFxNG95MG01',
      github: '',
      linkedin: 'https://www.linkedin.com/in/vedant-singh-894943346/',
    },
  },
  {
    name: 'Vaibhav Yadav',
    role: 'Frontend & Security',
    category: 'Frontend & Security',
    monogram: 'VY',
    avatarBg: 'bg-gradient-to-br from-[#0F9D8C] to-[#064E3B]',
    badgeBg: 'bg-teal-50',
    badgeText: 'text-teal-700',
    badgeBorder: 'border-teal-200',
    summary:
      'Combining frontend interface engineering with robust security validation, client-side hardening, automated regression testing, and vulnerability auditing.',
    socials: {
      instagram: 'https://www.instagram.com/yadavvaibhav__?stkn=MTI2bnFicWVucGh3cg%3D%3D&utm_source=qr',
      github: '',
      linkedin: 'https://www.linkedin.com/in/vaibhav-kumar-yadav-7770a2322',
    },
  },
  {
    name: 'Vaishnavi Bajpai',
    role: 'Security',
    category: 'Security',
    monogram: 'VB',
    avatarBg: 'bg-gradient-to-br from-[#7C3AED] to-[#4C1D95]',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    summary:
      'Enforcing zero-trust security controls, cryptographic data isolation, role-based authorization (RBAC), and strict Government of India cyber compliance standards.',
    socials: {
      instagram: 'https://www.instagram.com/vaishnavibajpai722?stkn=MW4wNmY1YTZ4OWZqMw==',
      github: 'https://github.com/vaishnavi05498',
      linkedin: 'https://www.linkedin.com/in/vaishnavi-bajpai-48560138b',
    },
  },
];

interface AboutUsPageProps {
  onNavigate: (page: NavPage, projectCode?: string) => void;
}

export const AboutUsPage: React.FC<AboutUsPageProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300">
      {/* Hero / Vision Banner - Frosted Light Blurry Grey with New InfraNetra Emblem */}
      <section
        id="about-hero"
        className="bg-slate-100/80 backdrop-blur-xl rounded-xl p-6 sm:p-8 lg:p-10 border border-slate-300/80 shadow-sm relative overflow-hidden w-full"
      >
        {/* Ambient blurry accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-slate-300/40 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center w-full">
          {/* Left Column: Core Identity, Heading & Narrative */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#0F9D8C]/10 text-[#0c7a6d] border border-[#0F9D8C]/25 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0F9D8C] shrink-0" />
              <a
                href="https://ipm.mospi.gov.in/AboutUs/AboutIPMD"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-[#0a665b] transition-colors cursor-pointer"
                title="Infrastructure & Project Monitoring Division (IPMD) Official Portal"
              >
                Infrastructure & Project Monitoring Division (IPMD)
              </a>
              <span className="text-[#0F9D8C]/50">·</span>
              <a
                href="https://www.mospi.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-[#0a665b] transition-colors cursor-pointer"
                title="Ministry of Statistics and Programme Implementation (MoSPI) Official Portal"
              >
                MoSPI
              </a>
            </div>

            <div className="flex items-center gap-3.5">
              {/* New InfraNetra Official Logo */}
              <img
                src="/infranetra-logo.png"
                alt="InfraNetra Official Logo"
                className="h-12 sm:h-14 w-auto object-contain drop-shadow-sm shrink-0"
              />
              <div>
                <h1 className="text-xl sm:text-2xl xl:text-[26px] font-bold tracking-tight text-[#101A3D] leading-snug">
                  About InfraNetra Intelligence
                </h1>
                <p className="text-xs sm:text-[13px] text-[#0F9D8C] font-mono font-semibold tracking-wide mt-0.5">
                  Next-Gen Mega Infrastructure Risk & Variance Monitoring
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              InfraNetra is the{' '}
              <a
                href="https://www.india.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#101A3D] hover:text-[#0F9D8C] hover:underline transition-colors"
                title="Government of India Official Portal"
              >
                Government of India
              </a>
              ’s centralized real-time infrastructure intelligence platform. Engineered to oversee Central Sector Mega Projects costing ₹150 Crore and above, InfraNetra bridges raw monthly field audits,{' '}
              <a
                href="https://paimana.mospi.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#0F9D8C] hover:underline transition-colors"
                title="MoSPI PAIMANA Flash Report Monitoring Portal"
              >
                PAIMANA Flash Reports
              </a>
              , and predictive early-warning analytics to eliminate costly project slippages and budget escalations across national economic corridors.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                id="btn-about-view-dashboard"
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-[#0F9D8C] hover:bg-[#0d8778] text-white shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <span>Explore Active Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                id="btn-about-view-warnings"
                type="button"
                onClick={() => onNavigate('warnings')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-white/95 hover:bg-white text-slate-700 hover:text-[#101A3D] border border-slate-300/90 shadow-xs hover:shadow-sm transition-all cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Early Warning Center</span>
              </button>
            </div>
          </div>

          {/* Right Column: Platform Mandate & Highlights Card (balances space on 16" and wide screens) */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col justify-center">
            <div className="bg-white/85 backdrop-blur-md rounded-xl p-5 border border-slate-200/90 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-[#101A3D] uppercase tracking-wider">
                  Mandate & Operational Scope
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F9D8C] bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                  Live MoSPI Grid
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-teal-50 text-[#0F9D8C] flex items-center justify-center shrink-0 mt-0.5">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Threshold:</span> Projects costing ₹150 Cr and above across 16 infrastructure ministries.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-teal-50 text-[#0F9D8C] flex items-center justify-center shrink-0 mt-0.5">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Source:</span>{' '}
                    <a
                      href="https://paimana.mospi.gov.in/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#0F9D8C] hover:underline transition-colors"
                      title="MoSPI PAIMANA Flash Report Monitoring Portal"
                    >
                      PAIMANA Monthly Flash Reports
                    </a>{' '}
                    with automated field reconciliation.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-teal-50 text-[#0F9D8C] flex items-center justify-center shrink-0 mt-0.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">Objective:</span> Zero-tolerance cost escalations and proactive milestone tracking.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* High-Level Impact Numbers */}
      <section
        id="about-stats-grid"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Monitored Portfolio</span>
            <Building2 className="w-4 h-4 text-[#0F9D8C]" />
          </div>
          <div className="text-2xl font-bold text-[#101A3D] tracking-tight">1,847+</div>
          <p className="text-[11px] text-[#64748B] mt-1">Mega & Major Central Sector Projects</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Aggregate Outlay</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-[#101A3D] tracking-tight">₹26.8 Lakh Cr</div>
          <p className="text-[11px] text-[#64748B] mt-1">Cumulative project sanction value</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Ministries Linked</span>
            <Layers className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-[#101A3D] tracking-tight">16 Core Wings</div>
            <p className="text-[11px] text-[#64748B] mt-1">Railways, MoRTH, Power, Petroleum & more</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between text-[#64748B] mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Real-time Risk Audit</span>
            <Sparkles className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-[#101A3D] tracking-tight">24/7 AI Grounded</div>
          <p className="text-[11px] text-[#64748B] mt-1">Directly trained on verified PAIMANA Flash Reports</p>
        </div>
      </section>

      {/* Strategic Pillars / Core Capabilities */}
      <section id="about-pillars" className="space-y-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#101A3D] tracking-tight">
            Core Pillars of the InfraNetra Framework
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            How InfraNetra transforms retrospective project reporting into proactive mitigation intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Pillar 1 */}
          <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-xs hover:border-[#0F9D8C]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-[#0F9D8C] flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#101A3D] mb-2">
              Automated Early Warning Signals
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              InfraNetra algorithmically flags non-linear cost escalations, critical path milestone slippages, 
              and persistent environmental or land acquisition delays up to 6 months before contractor billing crises emerge.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D8C] shrink-0" />
                <span>Weighted composite risk indexing</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0F9D8C] shrink-0" />
                <span>Critical milestone path monitoring</span>
              </li>
            </ul>
          </div>

          {/* Pillar 2 */}
          <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-xs hover:border-[#0F9D8C]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#101A3D] mb-2">
              Project Monitoring Report Ingestion
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Seamlessly integrates monthly project flash reports from implementing agencies. Intelligent OCR 
              and schema parsers reconcile capex disbursements, original baselines, and cumulative actual expenditure.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Multi-page PDF & tabular Excel ingestion</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Deterministic variance reconciliation</span>
              </li>
            </ul>
          </div>

          {/* Pillar 3 */}
          <div className="bg-white rounded-xl p-6 border border-[#E2E8F0] shadow-xs hover:border-[#0F9D8C]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#101A3D] mb-2">
              Geospatial Corridor Mapping
            </h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Provides interactive Google Maps tracking of mega project alignments across national highways, freight corridors, 
              port linkages, and metro networks with tier-based risk overlays and state boundary coordination.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>PM GatiShakti corridor alignment</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Inter-state clearance status indicators</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Institutional Mandate & Governance Details */}
      <section
        id="about-institutional-framework"
        className="bg-white rounded-xl p-6 sm:p-8 border border-[#E2E8F0] shadow-xs space-y-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-lg bg-[#101A3D] text-white flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-[#0F9D8C]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#101A3D] tracking-tight">
              Institutional Framework & MoSPI Mandate
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1">
              Established under the directives of the{' '}
              <a
                href="https://www.mospi.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#0F9D8C] hover:underline transition-colors"
                title="Ministry of Statistics and Programme Implementation (MoSPI)"
              >
                Ministry of Statistics and Programme Implementation (MoSPI)
              </a>
              ,{' '}
              <a
                href="https://www.india.gov.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#0F9D8C] hover:underline transition-colors"
                title="Government of India"
              >
                Government of India
              </a>
              .
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-[#F1F5F9]">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#101A3D]">
              Statutory Scope & Thresholds
            </h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              The{' '}
              <a
                href="https://ipm.mospi.gov.in/AboutUs/AboutIPMD"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#0F9D8C] hover:underline transition-colors"
                title="Infrastructure and Project Monitoring Division (IPMD)"
              >
                Infrastructure and Project Monitoring Division (IPMD)
              </a>{' '}
              serves as the apex nodal monitoring body for all 
              Central Sector Projects costing ₹150 Crore or above. Projects are stratified into:
            </p>
            <ul className="space-y-2 text-xs text-[#475569]">
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                <span><strong>Mega Projects:</strong> Capital investment of ₹1,000 Crore and above, subjected to intensive monthly flash monitoring and Cabinet Committee reviews.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1 shrink-0" />
                <span><strong>Major Projects:</strong> Capital investment between ₹150 Crore and ₹1,000 Crore, tracked across statutory milestone timelines and state administrative clearances.</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#101A3D]">
              Standardized Bottleneck Taxonomy
            </h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              InfraNetra categorizes delays according to the standardized IPMD resolution registry:
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="font-semibold text-[#101A3D]">Land Acquisition</div>
                <div className="text-[11px] text-slate-500">Compensation awards & judicial stays</div>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="font-semibold text-[#101A3D]">Forest / Wildlife</div>
                <div className="text-[11px] text-slate-500">Stage-I & Stage-II statutory approvals</div>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="font-semibold text-[#101A3D]">Utility Relocation</div>
                <div className="text-[11px] text-slate-500">HT lines, pipelines & municipal grids</div>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                <div className="font-semibold text-[#101A3D]">Contractor Liquidity</div>
                <div className="text-[11px] text-slate-500">Cashflow, equipment & material mobilization</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Data Integrity Assurance */}
      <section
        id="about-security"
        className="bg-slate-50 rounded-xl p-6 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-white border border-slate-300 flex items-center justify-center text-[#101A3D] shrink-0 shadow-xs">
            <Lock className="w-5 h-5 text-[#0F9D8C]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#101A3D]">
              Secure Government-Grade Data Isolation
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Role-based authenticated access, zero telemetry leakage, and strict audit logs conforming to Government of India cybersecurity guidelines.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#101A3D] bg-white px-3 py-1.5 rounded-md border border-slate-200 shrink-0">
          <Globe2 className="w-3.5 h-3.5 text-[#0F9D8C]" />
          <span>MoSPI Official IPMD Portal</span>
        </div>
      </section>

      {/* Project Engineering & Core Technology Team */}
      <section id="about-engineering-team" className="space-y-6 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#E2E8F0] pb-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#E6F6F4] text-[#0F9D8C] border border-[#0F9D8C]/20 mb-2">
              <Code2 className="w-3.5 h-3.5" />
              <span>Project Engineering & Core Technology Team</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-[#101A3D] tracking-tight">
              Architects & Core Contributors
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1 max-w-2xl">
              Meet the software engineers, system architects, and security specialists powering InfraNetra’s mission-critical infrastructure risk intelligence platform.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>6 Core Contributors</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 lg:gap-8 w-full">
          {CORE_TEAM.map((member) => (
            <div
              key={member.name}
              onClick={() => {
                const officialUrl = member.socials.linkedin || member.socials.github || member.socials.instagram;
                if (officialUrl) {
                  window.open(officialUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              title={`Click to view ${member.name}'s official profile`}
              className="bg-white rounded-xl p-4 sm:p-4.5 border border-[#E2E8F0] shadow-sm hover:shadow-[0_20px_50px_rgba(15,157,140,0.35),0_0_30px_rgba(15,157,140,0.22)] hover:border-[#0F9D8C] hover:ring-2 hover:ring-[#0F9D8C]/30 hover:-translate-y-2.5 hover:scale-[1.025] transition-all duration-300 ease-out flex flex-col justify-between group aspect-[2.5/2] min-h-[195px] relative overflow-hidden cursor-pointer"
            >
              {/* Card Top Section: Avatar, Name & Summary */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl ${member.avatarBg} text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white group-hover:scale-110 group-hover:shadow-md transition-transform duration-300`}
                  >
                    {member.monogram}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#101A3D] group-hover:text-[#0F9D8C] transition-colors leading-tight">
                      {member.name}
                    </h3>
                    <p className="text-xs sm:text-[13px] font-semibold text-[#0F9D8C] mt-0.5">
                      {member.role}
                    </p>
                  </div>
                </div>

                {/* Summary / Responsibility */}
                <p className="text-xs sm:text-[13px] text-[#475569] leading-relaxed line-clamp-3">
                  {member.summary}
                </p>
              </div>

              {/* Card Bottom Section: Social Handles (Instagram First, GitHub, LinkedIn) - Filled Original Brand Colors */}
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-center gap-3.5 mt-auto">
                {/* Instagram (First) */}
                {member.socials.instagram && (
                  <a
                    href={member.socials.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center transition-all duration-200 shadow-xs hover:shadow-md hover:scale-115 hover:brightness-110 cursor-pointer"
                    title={`${member.name} on Instagram`}
                    aria-label={`${member.name} Instagram Profile`}
                  >
                    <Instagram className="w-4 h-4 stroke-[2]" />
                  </a>
                )}

                {/* GitHub (Second) */}
                {member.socials.github && member.socials.github.startsWith('http') ? (
                  <a
                    href={member.socials.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 rounded-full bg-[#181717] text-white flex items-center justify-center transition-all duration-200 shadow-xs hover:shadow-md hover:scale-115 hover:bg-[#24292F] cursor-pointer"
                    title={`${member.name} on GitHub`}
                    aria-label={`${member.name} GitHub Profile`}
                  >
                    <Github className="w-4 h-4 fill-current stroke-[1.5]" />
                  </a>
                ) : (
                  <span
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 rounded-full bg-[#181717] text-white flex items-center justify-center transition-all duration-200 shadow-xs opacity-90 cursor-default"
                    title={`${member.name}'s GitHub profile link will be updated soon`}
                    aria-label={`${member.name} GitHub Profile (To be updated)`}
                  >
                    <Github className="w-4 h-4 fill-current stroke-[1.5]" />
                  </span>
                )}

                {/* LinkedIn (Third) */}
                {member.socials.linkedin && (
                  <a
                    href={member.socials.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 rounded-full bg-[#0A66C2] text-white flex items-center justify-center transition-all duration-200 shadow-xs hover:shadow-md hover:scale-115 hover:brightness-110 cursor-pointer"
                    title={`${member.name} on LinkedIn`}
                    aria-label={`${member.name} LinkedIn Profile`}
                  >
                    <Linkedin className="w-4 h-4 fill-current stroke-[1.5]" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
