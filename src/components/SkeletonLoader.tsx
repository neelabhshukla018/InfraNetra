import React from 'react';

export const SkeletonBlock: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`bg-slate-200/80 animate-pulse rounded ${className}`}
  />
);

export const KpiCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg p-5 sm:p-6 border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
    <div className="flex items-center justify-between mb-3">
      <SkeletonBlock className="h-3.5 w-24" />
      <SkeletonBlock className="h-8 w-8 rounded-md" />
    </div>
    <div className="my-1 space-y-2">
      <SkeletonBlock className="h-8 w-32" />
      <SkeletonBlock className="h-3 w-48" />
    </div>
    <div className="mt-3 pt-2.5 border-t border-[#F1F5F9] flex items-center">
      <SkeletonBlock className="h-4 w-20 rounded-full" />
      <SkeletonBlock className="h-3 w-16 ml-2" />
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 7,
}) => (
  <div className="bg-white rounded-lg border border-[#E2E8F0] shadow-xs overflow-hidden">
    <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
      <SkeletonBlock className="h-4 w-40" />
      <SkeletonBlock className="h-8 w-28 rounded" />
    </div>
    <div className="p-4 space-y-3">
      {/* Table header */}
      <div className="grid grid-cols-6 gap-4 pb-2 border-b border-[#E2E8F0]">
        {[...Array(columns)].map((_, i) => (
          <SkeletonBlock key={i} className="h-3 w-full" />
        ))}
      </div>
      {/* Rows */}
      {[...Array(rows)].map((_, r) => (
        <div key={r} className="grid grid-cols-6 gap-4 py-2 border-b border-slate-100">
          {[...Array(columns)].map((_, c) => (
            <SkeletonBlock key={c} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const AlertCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg p-5 sm:p-6 border border-[#E2E8F0] border-l-[3px] border-l-slate-300 shadow-xs space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-5 w-20 rounded-full" />
        <SkeletonBlock className="h-5 w-28 rounded" />
        <SkeletonBlock className="h-4 w-32" />
      </div>
      <SkeletonBlock className="h-3 w-24" />
    </div>
    <div className="space-y-1.5">
      <SkeletonBlock className="h-5 w-3/4" />
      <SkeletonBlock className="h-3.5 w-1/2" />
    </div>
    <div className="space-y-2 pt-2">
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-3 w-5/6" />
      <SkeletonBlock className="h-3 w-2/3" />
    </div>
  </div>
);
