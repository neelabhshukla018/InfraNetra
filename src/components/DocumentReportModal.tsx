import React from 'react';
import {
  X,
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  User,
  Building2,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ArrowRight,
} from 'lucide-react';
import { UploadedReportDocument } from '../types';

interface DocumentReportModalProps {
  document: UploadedReportDocument | null;
  onClose: () => void;
  onNavigateToProjects?: () => void;
  onOpenUploadAudit?: () => void;
  isNormalUser?: boolean;
}

export const DocumentReportModal: React.FC<DocumentReportModalProps> = ({
  document,
  onClose,
  onNavigateToProjects,
  onOpenUploadAudit,
  isNormalUser = false,
}) => {
  if (!document) return null;

  const isPdf = document.fileType === 'pdf';

  return (
    <div
      id="document-report-modal-backdrop"
      className="fixed inset-0 z-50 bg-[#0F172A]/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="document-report-modal-content"
        className="bg-white rounded-xl shadow-2xl border border-[#CBD5E1] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="blurry-grey-header px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-[#0F9D8C] shrink-0 border border-teal-200/60">
              {isPdf ? <FileText className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5 text-emerald-600" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-[#0F9D8C]/15 text-[#0F9D8C] border border-[#0F9D8C]/30">
                  {document.cycle}
                </span>
                <span className="text-xs text-[#64748B] font-mono-code">{document.fileName}</span>
              </div>
              <h2 className="text-base font-bold text-[#101A3D] tracking-tight mt-0.5">
                {document.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-[#101A3D] p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#1E293B]">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 rounded-lg">
            <div>
              <span className="text-[11px] text-[#64748B] block font-medium">Document Format</span>
              <span className="font-bold text-[#101A3D] uppercase text-xs mt-0.5 block">
                {document.fileType} ({document.fileSize})
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#64748B] block font-medium">Projects Monitored</span>
              <span className="font-bold text-[#101A3D] text-xs mt-0.5 block font-tabular">
                {document.totalProjects.toLocaleString()} Central Projects
              </span>
            </div>
            <div>
              <span className="text-[11px] text-[#64748B] block font-medium">OCR / Ingestion Status</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-semibold text-emerald-700 text-xs">{document.status}</span>
              </div>
            </div>
            <div>
              <span className="text-[11px] text-[#64748B] block font-medium">Upload Timestamp</span>
              <span className="font-semibold text-[#1E293B] text-xs mt-0.5 block">
                {document.uploadedAt}
              </span>
            </div>
          </div>

          {/* Uploader & Ministry */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-lg border border-[#E2E8F0] bg-white">
            <div className="flex items-center gap-2 text-slate-700">
              <User className="w-4 h-4 text-[#0F9D8C]" />
              <span className="font-semibold">{document.uploadedBy}</span>
            </div>
            <div className="flex items-center gap-2 text-[#64748B] text-[11px]">
              <Building2 className="w-3.5 h-3.5" />
              <span>{document.department}</span>
            </div>
          </div>

          {/* Executive Summary */}
          <div>
            <h3 className="text-xs font-bold text-[#101A3D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-[#0F9D8C]" />
              Document Executive Summary
            </h3>
            <p className="text-xs text-[#334155] leading-relaxed bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-lg">
              {document.summary}
            </p>
          </div>

          {/* Ingestion Highlights / Key Findings */}
          <div>
            <h3 className="text-xs font-bold text-[#101A3D] uppercase tracking-wider mb-2">
              Key Audited Ingestion Highlights
            </h3>
            <div className="space-y-2">
              {document.highlights.map((highlight, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0F9D8C] mt-1.5 shrink-0" />
                  <span className="text-xs text-[#334155] leading-snug">{highlight}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Flagged Audit Warning if any (Officers only) */}
          {!isNormalUser && document.flaggedCount > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]">
              <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold">{document.flaggedCount} Project Rows Flagged for Audit:</span>{' '}
                Variations found in state PWD project naming conventions or pending CCEA approvals.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F8FAFC] border-t border-[#E2E8F0] px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={() => {
              // Simulated download of official report file
              const dummyContent = `PAIMANA FLASH REPORT - ${document.cycle}\nFile: ${document.fileName}\nDepartment: ${document.department}\nProjects: ${document.totalProjects}\nStatus: ${document.status}\n\nSummary:\n${document.summary}`;
              const blob = new Blob([dummyContent], { type: 'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = window.document.createElement('a');
              a.href = url;
              a.download = document.fileName.replace('.pdf', '.txt');
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-semibold border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#1E293B] transition-colors shadow-xs w-full sm:w-auto justify-center cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Download Report</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isNormalUser && onOpenUploadAudit && (
              <button
                onClick={() => {
                  onClose();
                  onOpenUploadAudit();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#1E293B] transition-colors cursor-pointer"
              >
                <span>Inspect Parsing Audit</span>
              </button>
            )}
            {!isNormalUser && onNavigateToProjects && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToProjects();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold bg-[#101A3D] hover:bg-[#1E2A5E] text-white transition-colors shadow-xs cursor-pointer"
              >
                <span>Explore Projects in this Report</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#0F9D8C]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
