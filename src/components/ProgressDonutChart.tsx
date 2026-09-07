import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ProgressDonutChartProps {
  totalCount: number;
}

export const ProgressDonutChart: React.FC<ProgressDonutChartProps> = ({ totalCount }) => {
  const data = [
    { name: 'Advanced (>75%)', value: 524, color: '#0F9D8C' },
    { name: 'Substantial (50–75%)', value: 618, color: '#2563EB' },
    { name: 'Mid-Stage (25–50%)', value: 485, color: '#6366F1' },
    { name: 'Early Stage (<25%)', value: 220, color: '#94A3B8' },
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
    <div id="progress-donut-container" className="flex flex-col items-center justify-center relative w-full h-[260px]">
      {/* Permanent Center Label - stays visible on hover and click */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0 text-center">
        <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
          Avg Progress
        </span>
        <span className="text-2xl font-bold font-tabular text-[#101A3D] leading-none mt-0.5">
          58.4%
        </span>
        <span className="text-[10px] text-[#0F9D8C] font-medium mt-0.5">
          On-Track Velocity
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
            >
              {data.map((entry) => (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={entry.color}
                  stroke="#FFFFFF"
                  strokeWidth={2}
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
