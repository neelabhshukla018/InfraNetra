import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ProjectWithSnapshot } from '../types';
import { formatCurrencyCr } from '../utils/formatters';

import { SectorMetric } from '../services/api';

interface SectorDistributionChartProps {
  projects?: ProjectWithSnapshot[];
  dbSectors?: SectorMetric[];
}

export const SectorDistributionChart: React.FC<SectorDistributionChartProps> = ({ projects = [], dbSectors }) => {
  let chartData: { sector: string; approved: number; revised: number; count: number }[] = [];

  if (dbSectors && dbSectors.length > 0) {
    chartData = dbSectors.slice(0, 8).map((s) => ({
      sector: s.sector,
      approved: Math.round(s.original_cost),
      revised: Math.round(s.revised_cost),
      count: s.project_count,
    }));
  } else {
    // Aggregate cost by sector
    const sectorMap: Record<string, { sector: string; approved: number; revised: number; count: number }> = {};
    projects.forEach((p) => {
      const s = p.sector || 'Other';
      if (!sectorMap[s]) {
        sectorMap[s] = { sector: s, approved: 0, revised: 0, count: 0 };
      }
      sectorMap[s].approved += p.approved_cost;
      sectorMap[s].revised += p.latest_snapshot.revised_cost;
      sectorMap[s].count += 1;
    });
    chartData = Object.values(sectorMap);
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="blurry-grey-card text-[#101A3D] p-3 rounded-lg shadow-xl text-xs space-y-1">
          <div className="font-bold text-[#101A3D]">{label}</div>
          <div className="text-[#475569]">
            Approved: <span className="font-semibold text-[#101A3D]">{formatCurrencyCr(payload[0]?.value)}</span>
          </div>
          <div className="text-[#475569]">
            Revised: <span className="font-semibold text-[#EA580C]">{formatCurrencyCr(payload[1]?.value)}</span>
          </div>
          {payload[1]?.value > payload[0]?.value && (
            <div className="text-[11px] text-[#DC2626] font-semibold pt-1 border-t border-slate-300">
              Escalation: +{Math.round(((payload[1].value - payload[0].value) / payload[0].value) * 100)}%
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div id="sector-distribution-chart" className="w-full h-[260px] flex flex-col items-center justify-center border border-dashed border-[#CBD5E1] rounded-lg bg-[#F8FAFC]/50 text-[#64748B]">
        <p className="text-xs font-medium">No snapshot selected. Select a month above to view sectoral capital outlay.</p>
      </div>
    );
  }

  return (
    <div id="sector-distribution-chart" className="w-full h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="sector"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            interval={0}
            angle={-12}
            textAnchor="end"
          />
          <YAxis
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k Cr`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
          />
          <Bar
            dataKey="approved"
            name="Approved Cost"
            fill="#0F9D8C"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
          <Bar
            dataKey="revised"
            name="Revised Cost"
            fill="#101A3D"
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
