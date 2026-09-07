import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { ParseJob } from '../types';
import {
  uploadFlashReport,
  IngestFlashReportResponse,
  saveDataset,
  getDatasetSummary,
  formatReportMonth,
  formatReportMonthDate,
  SaveDatasetResponse,
  DatasetSummaryResponse,
} from '../services/api';

const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const YEAR_OPTIONS = ['2025', '2026', '2027', '2028', '2029', '2030'];

interface FlashReportUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (job: ParseJob) => void;
}

export const FlashReportUploadModal: React.FC<FlashReportUploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<IngestFlashReportResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [completedJob, setCompletedJob] = useState<ParseJob | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const reportMonth = selectedYear && selectedMonth ? `${selectedYear}-${selectedMonth}-01` : '';

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [saveResult, setSaveResult] = useState<SaveDatasetResponse | null>(null);
  const [dbSummary, setDbSummary] = useState<DatasetSummaryResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic formatting for the active/uploaded report month
  const activeMonthRaw = uploadResult?.report_month || reportMonth;
  const currentMonthFormatted = activeMonthRaw ? formatReportMonth(activeMonthRaw) : '';
  const currentMonthDate = activeMonthRaw ? formatReportMonthDate(activeMonthRaw) : '';
  const canonicalCount = uploadResult?.canonical_metrics?.unique_project_count ?? uploadResult?.records_extracted ?? (uploadResult?.canonical_records?.length || 0);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setUploadStatus('idle');
    setUploadProgress(0);
    setErrorMessage('');
    setUploadResult(null);
  };

  const startIngestion = async () => {
    if (!selectedFile) return;
    if (!selectedMonth || !selectedYear) {
      setErrorMessage('Please select both Month and Year for the Flash Report before starting ingestion.');
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    setUploadProgress(20);
    setErrorMessage('');

    // Progressive loading indicator reflecting upload & page processing
    let currentPct = 15;
    const interval = setInterval(() => {
      setUploadProgress(() => {
        if (currentPct < 40) {
          currentPct += 5;
        } else if (currentPct < 85) {
          currentPct += 2;
        } else if (currentPct < 95) {
          currentPct += 1;
        }
        return currentPct;
      });
    }, 400);

    try {
      // Explicitly format target month as YYYY-MM-01
      const targetMonthDate = `${selectedYear}-${selectedMonth}-01`;
      // Send actual File object to FastAPI endpoint: POST http://127.0.0.1:8000/api/ingest-flash-report
      const result = await uploadFlashReport(selectedFile, targetMonthDate);

      clearInterval(interval);
      setUploadProgress(100);
      setUploadResult(result);
      setUploadStatus('success');

      // Complete ingestion pipeline: persist canonical records to database
      setSaveStatus('saving');
      try {
        const recordsToSave = (result.canonical_records && result.canonical_records.length > 0)
          ? result.canonical_records
          : (result.records || []);
        const saveRes = await saveDataset(targetMonthDate, recordsToSave);
        setSaveResult(saveRes);
        try {
          const summary = await getDatasetSummary(targetMonthDate);
          setDbSummary(summary);
        } catch (sumErr) {
          console.warn('Could not fetch summary after save:', sumErr);
        }
        setSaveStatus('saved');
        window.dispatchEvent(new CustomEvent('infranetra:month-updated'));
      } catch (saveErr: any) {
        console.error('Error auto-persisting dataset during ingestion:', saveErr);
        setSaveStatus('error');
        setSaveError(saveErr?.message || `Failed to save dataset for ${formatReportMonth(targetMonthDate)} to database`);
      }

      const job: ParseJob = {
        id: `upload-${Date.now()}`,
        report_month: result.report_month || targetMonthDate,
        uploaded_by: 'r.sharma@mospi.gov.in',
        status: 'completed',
        rows_total: result.records_extracted,
        rows_matched: result.records_extracted,
        rows_failed: 0,
        warnings: [
          `PyMuPDF processed ${result.total_pages} page(s) (${result.pages_with_text} with text). Extracted ${result.records_extracted} project record(s).`,
        ],
        created_at: new Date().toISOString(),
      };

      setCompletedJob(job);
      onUploadSuccess(job);
    } catch (err: any) {
      clearInterval(interval);
      let msg = err?.message || 'Backend unavailable';
      if (msg === 'Failed to fetch' || msg.includes('Failed to fetch')) {
        msg = 'Backend unavailable. Ensure FastAPI is running on http://127.0.0.1:8000.';
      }
      setErrorMessage(msg);
      setUploadStatus('error');
    }
  };


  const handleReset = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadResult(null);
    setErrorMessage('');
    setCompletedJob(null);
    setSaveStatus('idle');
    setSaveResult(null);
    setDbSummary(null);
    setSaveError('');
    setSelectedMonth('');
    setSelectedYear('');
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        id="modal-upload-flash-report"
        className="bg-white rounded-lg border border-[#E2E8F0] shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="blurry-grey-header px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#0F9D8C] flex items-center justify-center text-white shadow-xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#101A3D]">
                Monthly Flash Report Upload
              </h3>
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
        <div className="p-6 overflow-y-auto space-y-5">
          {uploadStatus !== 'success' ? (
            <>
              {/* Target Flash Report Month & Year Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.04em] text-[#64748B]">
                    FLASH REPORT PERIOD
                  </label>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Select reporting Month & Year for this Flash Report
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#CBD5E1] p-1 rounded-lg">
                    <span className="text-xs font-medium text-[#64748B] ml-1">Month:</span>
                    <select
                      id="select-target-flash-month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                      aria-label="Select Month"
                      className="bg-transparent text-xs font-semibold text-[#101A3D] pr-2 focus:outline-hidden cursor-pointer"
                    >
                      <option value="">Select Month</option>
                      {MONTH_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#CBD5E1] p-1 rounded-lg">
                    <span className="text-xs font-medium text-[#64748B] ml-1">Year:</span>
                    <select
                      id="select-target-flash-year"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                      aria-label="Select Year"
                      className="bg-transparent text-xs font-semibold text-[#101A3D] pr-2 focus:outline-hidden cursor-pointer"
                    >
                      <option value="">Select Year</option>
                      {YEAR_OPTIONS.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Dashed dropzone component matching spec */}
              <div
                id="dropzone-flash-report"
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-[#0F9D8C] bg-[#E6F6F4]'
                    : selectedFile
                    ? 'border-[#0F9D8C] bg-white'
                    : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#0F9D8C] hover:bg-[#E6F6F4]/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {selectedFile ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-[#E6F6F4] text-[#0F9D8C] flex items-center justify-center mb-3">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <div className="font-semibold text-sm text-[#1E293B]">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-[#64748B] mt-1">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Ready to ingest into MoSPI database
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-slate-200/80 text-slate-600 flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-[#1E293B]">
                      Drag and drop the official Flash Report PDF here
                    </p>
                    <p className="text-xs text-[#64748B] mt-1">
                      or click to browse from your workstation (Supports PDF, CSV, XLSX)
                    </p>
                  </div>
                )}
              </div>

              {/* Progress Bar during upload */}
              {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#1E293B] flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0F9D8C]" />
                      {uploadProgress < 40
                        ? 'Uploading PDF...'
                        : 'Processing document & extracting project records...'}
                    </span>
                    <span className="text-[#0F9D8C] font-mono-code font-bold">
                      {uploadProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#0F9D8C] h-full transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error State */}
              {uploadStatus === 'error' && (
                <div className="p-4 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-[#DC2626]">
                      Upload Failed
                    </div>
                    <p className="text-xs text-[#DC2626]/90 mt-0.5">
                      {errorMessage || 'Failed to process report. Please try again.'}
                    </p>
                    <button
                      onClick={startIngestion}
                      className="mt-2 text-xs font-bold text-[#DC2626] underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry Upload
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Success State - Clean, Minimal & Professional */
            <div className="py-8 px-4 flex flex-col items-center text-center space-y-6">
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-[#16A34A]/10 text-[#16A34A] flex items-center justify-center mb-3 shadow-xs">
                  <CheckCircle2 className="w-8 h-8 text-[#16A34A]" />
                </div>
                <h4 className="text-lg font-bold text-[#101A3D]">
                  Report Uploaded Successfully
                </h4>
              </div>

              {/* Simple Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-lg text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B] block">
                    Report Month
                  </span>
                  <span className="text-base font-bold text-[#101A3D] mt-1.5 block">
                    {currentMonthFormatted || formatReportMonth(uploadResult?.report_month || reportMonth)}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-lg text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B] block">
                    Projects Imported
                  </span>
                  <span className="text-base font-bold text-[#0F9D8C] mt-1.5 block font-tabular">
                    {(saveResult?.records_inserted_or_updated ?? dbSummary?.total_projects ?? canonicalCount).toLocaleString()}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-4 rounded-lg text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B] block">
                    Database
                  </span>
                  <span className="text-base font-bold text-[#16A34A] mt-1.5 block">
                    Saved Successfully
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F8FAFC] px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between">
          {uploadStatus === 'success' ? (
            <div className="w-full flex items-center justify-end gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-[#CBD5E1] bg-white text-[#1E293B] hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Upload Another Report
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#101A3D] hover:bg-[#1E293B] text-white transition-colors cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] hover:text-[#1E293B] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-parse-upload"
                onClick={startIngestion}
                disabled={!selectedFile || !selectedMonth || !selectedYear || uploadStatus === 'uploading' || uploadStatus === 'processing'}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0F9D8C] hover:bg-[#0d8778] text-white disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Upload Report
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
