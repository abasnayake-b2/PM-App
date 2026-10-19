import { useState } from 'react';
import type { MonthlyAllocationPoint } from '@/utils/allocationCharts';

const ALLOCATED_COLOR = 'var(--accent)';
const NOT_ALLOCATED_COLOR = 'var(--amber)';

function niceCeil(value: number): number {
  if (value <= 4) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const scaled = value / exp;
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return step * exp;
}

function NameList({ title, count, names, swatch }: { title: string; count: number; names: string[]; swatch: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text2">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: swatch }} />
        {title}
        <span className="tabular-nums text-text">{count}</span>
      </p>
      {names.length === 0 ? (
        <p className="mt-1 text-xs text-text3">None</p>
      ) : (
        <ul className="mt-1 max-h-48 space-y-0.5 overflow-y-auto pr-1 text-sm">
          {names.map((name, index) => (
            <li key={`${name}:${index}`} className="truncate" title={name}>
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChartTooltip({
  point,
  x,
  y,
}: {
  point: MonthlyAllocationPoint;
  x: number;
  y: number;
}) {
  const flipX = typeof window !== 'undefined' && x > window.innerWidth - 460;
  const flipY = typeof window !== 'undefined' && y > window.innerHeight - 280;
  return (
    <div
      className="pointer-events-none fixed z-50 w-[28rem] max-w-[calc(100vw-1.5rem)] rounded-lg border border-border bg-bg2 p-3 shadow-lg"
      style={{
        left: flipX ? undefined : x + 14,
        right: flipX ? Math.max(12, window.innerWidth - x + 14) : undefined,
        top: flipY ? undefined : y + 14,
        bottom: flipY ? Math.max(12, window.innerHeight - y + 14) : undefined,
      }}
    >
      <p className="font-semibold">{point.label}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <NameList
          title="Allocated"
          count={point.allocated}
          names={point.allocatedNames}
          swatch={ALLOCATED_COLOR}
        />
        <NameList
          title="Not allocated"
          count={point.notAllocated}
          names={point.notAllocatedNames}
          swatch={NOT_ALLOCATED_COLOR}
        />
      </div>
    </div>
  );
}

export function MonthlyAllocationChart({ points }: { points: MonthlyAllocationPoint[] }) {
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  const maxValue = points.reduce(
    (max, point) => Math.max(max, point.allocated, point.notAllocated),
    0,
  );
  const yMax = niceCeil(Math.max(maxValue, 1));
  const tickCount = 4;
  const groupW = 84;
  const padL = 48;
  const padR = 16;
  const padT = 8;
  const labelSpace = 18;
  const padB = 36;
  const height = 320;
  const width = padL + padR + Math.max(points.length, 1) * groupW;
  const plotTop = padT + labelSpace;
  const plotH = height - plotTop - padB;
  const baseline = plotTop + plotH;
  const barW = 22;
  const barGap = 6;
  const hovered = hover ? points.find((point) => point.key === hover.key) : undefined;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-text2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ALLOCATED_COLOR }} />
          Allocated
        </span>
        <span className="inline-flex items-center gap-2 text-text2">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: NOT_ALLOCATED_COLOR }} />
          Not allocated
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label="Monthly allocated and not allocated people"
          width={width}
          height={height}
          className="text-text2"
          onMouseLeave={() => setHover(null)}
        >
          {Array.from({ length: tickCount + 1 }, (_, index) => {
            const value = Math.round((yMax * (tickCount - index)) / tickCount);
            const y = plotTop + (plotH * index) / tickCount;
            return (
              <g key={value}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={index === tickCount ? 0.45 : 0.15}
                />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="currentColor">
                  {value}
                </text>
              </g>
            );
          })}
          {points.map((point, index) => {
            const groupX = padL + index * groupW;
            const pairW = barW * 2 + barGap;
            const x0 = groupX + (groupW - pairW) / 2;
            const allocatedH = (point.allocated / yMax) * plotH;
            const notAllocatedH = (point.notAllocated / yMax) * plotH;
            const active = hover?.key === point.key;
            const bars = [
              { value: point.allocated, height: allocatedH, x: x0, fill: ALLOCATED_COLOR },
              {
                value: point.notAllocated,
                height: notAllocatedH,
                x: x0 + barW + barGap,
                fill: NOT_ALLOCATED_COLOR,
              },
            ];
            return (
              <g
                key={point.key}
                onMouseEnter={(event) =>
                  setHover({ key: point.key, x: event.clientX, y: event.clientY })
                }
                onMouseMove={(event) =>
                  setHover({ key: point.key, x: event.clientX, y: event.clientY })
                }
              >
                <rect
                  x={groupX}
                  y={plotTop}
                  width={groupW}
                  height={plotH}
                  fill={active ? 'currentColor' : 'transparent'}
                  fillOpacity={0.06}
                />
                {bars.map((bar) => {
                  const barHeight = Math.max(bar.height, bar.value > 0 ? 2 : 0);
                  return (
                    <g key={bar.fill}>
                      <rect
                        x={bar.x}
                        y={baseline - barHeight}
                        width={barW}
                        height={barHeight}
                        rx={3}
                        fill={bar.fill}
                      />
                      <text
                        x={bar.x + barW / 2}
                        y={baseline - barHeight - 4}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="600"
                        fill="currentColor"
                      >
                        {bar.value}
                      </text>
                    </g>
                  );
                })}
                <text
                  x={groupX + groupW / 2}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fill="currentColor"
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {hovered && hover && <ChartTooltip point={hovered} x={hover.x} y={hover.y} />}
    </div>
  );
}

function ChartLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
      <span className="inline-flex items-center gap-2 text-text2">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ALLOCATED_COLOR }} />
        Allocated
      </span>
      <span className="inline-flex items-center gap-2 text-text2">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: NOT_ALLOCATED_COLOR }} />
        Not allocated
      </span>
    </div>
  );
}

function linePath(values: number[], yFor: (value: number) => number, xFor: (index: number) => number) {
  return values
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index)} ${yFor(value)}`)
    .join(' ');
}

export function MonthlyAllocationLineChart({ points }: { points: MonthlyAllocationPoint[] }) {
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  const maxValue = points.reduce(
    (max, point) => Math.max(max, point.allocated, point.notAllocated),
    0,
  );
  const yMax = niceCeil(Math.max(maxValue, 1));
  const tickCount = 4;
  const groupW = 84;
  const padL = 48;
  const padR = 16;
  const padT = 8;
  const labelSpace = 22;
  const padB = 36;
  const height = 320;
  const width = padL + padR + Math.max(points.length, 1) * groupW;
  const plotTop = padT + labelSpace;
  const plotH = height - plotTop - padB;
  const baseline = plotTop + plotH;
  const yFor = (value: number) => baseline - (value / yMax) * plotH;
  const xFor = (index: number) => padL + index * groupW + groupW / 2;
  const hovered = hover ? points.find((point) => point.key === hover.key) : undefined;

  return (
    <div>
      <ChartLegend />
      <div className="overflow-x-auto">
        <svg
          role="img"
          aria-label="Monthly allocated and not allocated trend"
          width={width}
          height={height}
          className="text-text2"
          onMouseLeave={() => setHover(null)}
        >
          {Array.from({ length: tickCount + 1 }, (_, index) => {
            const value = Math.round((yMax * (tickCount - index)) / tickCount);
            const y = plotTop + (plotH * index) / tickCount;
            return (
              <g key={value}>
                <line
                  x1={padL}
                  x2={width - padR}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={index === tickCount ? 0.45 : 0.15}
                />
                <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="11" fill="currentColor">
                  {value}
                </text>
              </g>
            );
          })}
          <path
            d={linePath(
              points.map((point) => point.allocated),
              yFor,
              xFor,
            )}
            fill="none"
            stroke={ALLOCATED_COLOR}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={linePath(
              points.map((point) => point.notAllocated),
              yFor,
              xFor,
            )}
            fill="none"
            stroke={NOT_ALLOCATED_COLOR}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((point, index) => {
            const x = xFor(index);
            const sameValue = point.allocated === point.notAllocated;
            const allocatedX = sameValue ? x - 7 : x;
            const notAllocatedX = sameValue ? x + 7 : x;
            const allocatedY = yFor(point.allocated);
            const notAllocatedY = yFor(point.notAllocated);
            const close = Math.abs(allocatedY - notAllocatedY) < 18;
            const allocatedLabelY = close ? Math.min(allocatedY, notAllocatedY) - 16 : allocatedY - 12;
            const notAllocatedLabelY = close
              ? Math.min(allocatedY, notAllocatedY) - 30
              : notAllocatedY - 12;
            const active = hover?.key === point.key;
            return (
              <g
                key={point.key}
                onMouseEnter={(event) =>
                  setHover({ key: point.key, x: event.clientX, y: event.clientY })
                }
                onMouseMove={(event) =>
                  setHover({ key: point.key, x: event.clientX, y: event.clientY })
                }
              >
                <rect
                  x={padL + index * groupW}
                  y={plotTop}
                  width={groupW}
                  height={plotH}
                  fill={active ? 'currentColor' : 'transparent'}
                  fillOpacity={0.06}
                />
                <circle cx={allocatedX} cy={allocatedY} r={4.5} fill={ALLOCATED_COLOR} />
                <circle cx={notAllocatedX} cy={notAllocatedY} r={4.5} fill={NOT_ALLOCATED_COLOR} />
                <text
                  x={allocatedX}
                  y={allocatedLabelY}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={ALLOCATED_COLOR}
                >
                  {point.allocated}
                </text>
                <text
                  x={notAllocatedX}
                  y={notAllocatedLabelY}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={NOT_ALLOCATED_COLOR}
                >
                  {point.notAllocated}
                </text>
                <text
                  x={x}
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fill="currentColor"
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {hovered && hover && <ChartTooltip point={hovered} x={hover.x} y={hover.y} />}
    </div>
  );
}
