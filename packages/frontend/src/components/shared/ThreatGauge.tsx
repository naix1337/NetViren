'use client';

import { cn } from '@/lib/utils';

interface ThreatGaugeProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const sizeConfig = {
  sm: { width: 80, height: 48, strokeWidth: 6, fontSize: 14 },
  md: { width: 140, height: 80, strokeWidth: 8, fontSize: 22 },
  lg: { width: 200, height: 110, strokeWidth: 10, fontSize: 32 },
};

function getGradientColor(score: number): string {
  if (score <= 25) return '#34D399'; // green
  if (score <= 50) return '#FBBF24'; // amber
  if (score <= 75) return '#F87171'; // red
  return '#F87171'; // red (critical)
}

function getLabel(score: number): string {
  if (score <= 10) return 'Safe';
  if (score <= 25) return 'Low';
  if (score <= 50) return 'Medium';
  if (score <= 75) return 'High';
  return 'Critical';
}

export function ThreatGauge({ score = 0, size = 'md', showLabel = true }: ThreatGaugeProps) {
  const config = sizeConfig[size];
  const { width, height, strokeWidth, fontSize } = config;
  const radius = (Math.min(width, height * 2) - strokeWidth) / 2;
  const cx = width / 2;
  const cy = height * 2 - 10;
  const circumference = Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, score));
  const progress = (clampedScore / 100) * circumference;
  const color = getGradientColor(clampedScore);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={width} height={height * 2} viewBox={`0 0 ${width} ${height * 2}`}>
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2} ${cy}`}
          fill="none"
          stroke="#1E2128"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <path
          d={`M ${strokeWidth / 2} ${cy} A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference - progress}`}
          className="transition-all duration-1000 ease-out"
          style={{ transform: 'rotate(180deg)', transformOrigin: `${cx}px ${cy}px` }}
        />
        {/* Score text */}
        <text
          x={cx}
          y={cy - 20}
          textAnchor="middle"
          fill="#EDEEF0"
          fontSize={fontSize}
          fontWeight="bold"
          fontFamily="Inter, sans-serif"
        >
          {clampedScore}
        </text>
        {showLabel && (
          <text
            x={cx}
            y={cy - 2}
            textAnchor="middle"
            fill={color}
            fontSize={fontSize * 0.35}
            fontWeight={600}
            fontFamily="Inter, sans-serif"
          >
            {getLabel(clampedScore)}
          </text>
        )}
      </svg>
    </div>
  );
}
