import React from 'react';
import { RiskTier } from '../types';
import { RISK_TIER_CONFIG } from '../utils/formatters';

interface RiskBadgeProps {
  tier: RiskTier;
  showDot?: boolean;
  score?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  tier,
  showDot = true,
  score,
  className = '',
  size = 'md',
}) => {
  const config = RISK_TIER_CONFIG[tier] || RISK_TIER_CONFIG.low;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-semibold',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  }[size];

  return (
    <span
      id={`risk-badge-${tier}-${score ?? 'tier'}`}
      className={`inline-flex items-center gap-1.5 rounded-full uppercase tracking-wider font-sans ${config.badgeClass} ${sizeClasses} ${className}`}
      style={{
        backgroundColor: config.bgHex,
        color: config.colorHex,
      }}
    >
      {showDot && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
          style={{ backgroundColor: config.colorHex }}
        />
      )}
      <span>
        {config.label}
        {score !== undefined && (
          <span className="ml-1 opacity-90 font-mono-code font-bold">({score})</span>
        )}
      </span>
    </span>
  );
};
