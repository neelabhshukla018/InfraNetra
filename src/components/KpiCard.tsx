import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  subValueClassName?: string;
  deltaText: string;
  deltaType?: 'positive' | 'negative' | 'neutral' | 'critical';
  icon: LucideIcon;
  subtitle?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  id,
  label,
  value,
  subValue,
  subValueClassName,
  deltaText,
  deltaType = 'neutral',
  icon: Icon,
  subtitle,
}) => {
  const getDeltaColor = () => {
    switch (deltaType) {
      case 'positive':
        return 'text-[#16A34A] bg-[#16A34A]/10';
      case 'critical':
        return 'text-[#DC2626] bg-[#DC2626]/10';
      case 'negative':
        return 'text-[#EA580C] bg-[#EA580C]/10';
      default:
        return 'text-[#64748B] bg-[#64748B]/10';
    }
  };

  return (
    <div
      id={id}
      className="bg-white rounded-lg p-5 sm:p-6 border border-[#E2E8F0] shadow-xs hover:border-[#CBD5E1] transition-all flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
          {label}
        </span>
        <div className="w-8 h-8 rounded-md bg-[#F1F5F9] flex items-center justify-center text-[#64748B]">
          <Icon className="w-[18px] h-[18px] text-[#64748B] stroke-[1.5]" />
        </div>
      </div>

      <div className="my-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[20px] sm:text-[22px] font-bold font-tabular text-[#1E293B] tracking-tight leading-none">
            {value}
          </span>
          {subValue && (
            <span
              className={
                subValueClassName || 'text-xs text-[#64748B] font-mono-code'
              }
            >
              {subValue}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-[#64748B] mt-0.5 line-clamp-1">
            {subtitle}
          </p>
        )}
      </div>

      <div className="mt-3 pt-2.5 border-t border-[#F1F5F9] flex items-center">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${getDeltaColor()}`}
        >
          {deltaText}
        </span>
        <span className="text-[11px] text-[#94A3B8] ml-2">vs prev. month</span>
      </div>
    </div>
  );
};
