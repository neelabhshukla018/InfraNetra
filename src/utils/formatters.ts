import { RiskTier } from '../types';

/**
 * Format Indian currency with crore notation and Indian grouping
 * Example: 14250 -> "Rs. 14,250 Cr", 123456 -> "Rs. 1,23,456 Cr"
 */
export function formatCurrencyCr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'Not available';
  }
  
  // Format with Indian grouping (last 3 digits, then groups of 2)
  const [integerPart, decimalPart] = amount.toFixed(0).split('.');
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  
  return `Rs. ${formattedInteger} Cr`;
}

/**
 * Format percentages strictly as integer with %
 * Example: 58.4 -> "58%"
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return 'Not available';
  }
  return `${Math.round(value)}%`;
}

/**
 * Format date display matching spec: "2 days ago · 3 Jul 2026"
 */
export function formatReportFreshness(relative: string | null | undefined, absolute: string | null | undefined): string {
  if (!relative && !absolute) return 'Not available';
  if (!relative) return absolute || 'Not available';
  if (!absolute) return relative;
  return `${relative} · ${absolute}`;
}

export interface RiskTierConfig {
  label: string;
  colorHex: string;
  bgHex: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
}

export const RISK_TIER_CONFIG: Record<RiskTier, RiskTierConfig> = {
  critical: {
    label: 'Critical Risk',
    colorHex: '#DC2626',
    bgHex: 'rgba(220, 38, 38, 0.10)',
    badgeClass: 'bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20',
    dotClass: 'bg-[#DC2626]',
    borderClass: 'border-l-[#DC2626]',
  },
  high: {
    label: 'High Risk',
    colorHex: '#EA580C',
    bgHex: 'rgba(234, 88, 12, 0.10)',
    badgeClass: 'bg-[#EA580C]/10 text-[#EA580C] border border-[#EA580C]/20',
    dotClass: 'bg-[#EA580C]',
    borderClass: 'border-l-[#EA580C]',
  },
  medium: {
    label: 'Medium Risk',
    colorHex: '#D97706',
    bgHex: 'rgba(217, 119, 6, 0.10)',
    badgeClass: 'bg-[#D97706]/10 text-[#D97706] border border-[#D97706]/20',
    dotClass: 'bg-[#D97706]',
    borderClass: 'border-l-[#D97706]',
  },
  low: {
    label: 'Low Risk',
    colorHex: '#16A34A',
    bgHex: 'rgba(22, 163, 74, 0.10)',
    badgeClass: 'bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20',
    dotClass: 'bg-[#16A34A]',
    borderClass: 'border-l-[#16A34A]',
  },
};
