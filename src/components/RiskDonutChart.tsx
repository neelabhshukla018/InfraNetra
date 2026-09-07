import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { RiskTier } from '../types';

interface RiskDonutChartProps {
  counts: Record<RiskTier, number>;
  totalCount: number;
  onSelectTier?: (tier: RiskTier | null) => void;
  selectedTier?: RiskTier | null;
}

export const RiskDonutChart: React.FC<RiskDonutChartProps> = ({
  counts,
  totalCount,
  onSelectTier,
  selectedTier,
}) => {
  // Ordered sequence: green -> amber -> orange -> red segments
  const data = [
    { name: 'Low Risk', key: 'low' as RiskTier, value: counts.low, color: '#16A34A' },
    { name: 'Medium Risk', key: 'medium' as RiskTier, value: counts.medium, color: '#D97706' },
    { name: 'High Risk', key: 'high' as RiskTier, value: counts.high, color: '#EA580C' },
    { name: 'Critical Risk', key: 'critical' as RiskTier, value: counts.critical, color: '#DC2626' },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const pct = totalCount > 0 ? Math.round((item.value / totalCount) * 100) : 0;
      return (
        <div className="bg-[#0D1533] text-white p-3 rounded-xl shadow-2xl border border-white/20 select-none pointer-events-none min-w-[170px]">
          <div className="font-semibold text-sm flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.payload.color }}
            />
            <span className="text-white">{item.name}</span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-tabular text-white tracking-tight">
              {item.value}
            </span>
            <span className="text-xs text-slate-300 font-normal">
              ({pct}% of portfolio)
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="risk-donut-container" className="flex flex-col items-center justify-center relative w-full h-[260px]">
      {/* Permanent Center display of total count - stays visible on hover and click */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
        <span className="text-2xl sm:text-3xl font-bold font-tabular text-[#1E293B] tracking-tight">
          {totalCount.toLocaleString()}
        </span>
        <span className="text-[11px] uppercase tracking-[0.04em] font-semibold text-[#64748B]">
          Projects
        </span>
      </div>

      {/* Chart layer with natural hover cursor-following tooltip */}
      <div className="w-full h-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={<CustomTooltip />}
              offset={15}
              wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }}
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
              cursor="pointer"
              onClick={(entry: any) => {
                const clickedKey = entry?.key || entry?.payload?.key;
                if (onSelectTier && clickedKey) {
                  onSelectTier(selectedTier === clickedKey ? null : clickedKey);
                }
              }}
            >
              {data.map((entry) => (
                <Cell
                  key={`cell-${entry.key}`}
                  fill={entry.color}
                  opacity={selectedTier && selectedTier !== entry.key ? 0.35 : 1}
                  stroke="#FFFFFF"
                  strokeWidth={selectedTier === entry.key ? 3 : 2}
                  className="transition-all duration-200"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
