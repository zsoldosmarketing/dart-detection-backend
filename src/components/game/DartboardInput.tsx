import { useState } from 'react';
import type { DartTarget } from '../../lib/dartsEngine';

interface DartboardInputProps {
  onThrow: (target: DartTarget) => void;
  disabled?: boolean;
}

const SECTOR_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const SECTOR_COLORS: Record<number, { single: string; double: string; triple: string }> = {
  20: { single: '#000', double: '#e74c3c', triple: '#e74c3c' },
  1: { single: '#f5e6d3', double: '#27ae60', triple: '#27ae60' },
  18: { single: '#000', double: '#e74c3c', triple: '#e74c3c' },
  4: { single: '#f5e6d3', double: '#27ae60', triple: '#27ae60' },
  13: { single: '#000', double: '#e74c3c', triple: '#e74c3c' },
  6: { single: '#f5e6d3', double: '#27ae60', triple: '#27ae60' },
  10: { single: '#000', double: '#e74c3c', triple: '#e74c3c' },
  15: { single: '#f5e6d3', double: '#27ae60', triple: '#27ae60' },
  2: { single: '#000', double: '#e74c3c', triple: '#e74c3c' },
  17: { single: '#f5e6d3', double: '#27ae60', triple: '#27ae60' },
  3: { single: '#000', double: '#e74c3c', triple: '#e74c3c' },
  19: { single: '#f5e6d3', double: '#27ae60', triple: '#27ae60' },
  7: { single: '#000', double: '#e74c3c', triple: '#e74c3c' },
  16: { single: '#f5e6d3', double: '#27ae60', triple: '#27ae60' },
  8: { single: '#000', double: '#e74c3c', triple: '#e74c3c' },
  11: { single: '#f5e6d3', double: '#27ae60', triple: '#27ae60' },
  14: { single: '#000', double: '#e74c3c', triple: '#e74c3c' },
  9: { single: '#f5e6d3', double: '#27ae60', triple: '#27ae60' },
  12: { single: '#000', double: '#e74c3c', triple: '#e74c3c' },
  5: { single: '#f5e6d3', double: '#27ae60', triple: '#27ae60' },
};

export function DartboardInput({ onThrow, disabled }: DartboardInputProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const size = 320;
  const center = size / 2;
  const doubleRadius = 133;
  const outerSingleRadius = 122;
  const tripleOuterRadius = 87;
  const tripleInnerRadius = 79;
  const innerSingleRadius = 70;
  const bullRadius = 26;
  const innerBullRadius = 10;

  const handleClick = (target: DartTarget) => {
    if (disabled) return;
    onThrow(target);
  };

  const createSectorPath = (index: number, innerR: number, outerR: number) => {
    const anglePerSector = 360 / 20;
    const startAngle = (index * anglePerSector - anglePerSector / 2 - 90) * (Math.PI / 180);
    const endAngle = ((index + 1) * anglePerSector - anglePerSector / 2 - 90) * (Math.PI / 180);

    const x1 = center + innerR * Math.cos(startAngle);
    const y1 = center + innerR * Math.sin(startAngle);
    const x2 = center + outerR * Math.cos(startAngle);
    const y2 = center + outerR * Math.sin(startAngle);
    const x3 = center + outerR * Math.cos(endAngle);
    const y3 = center + outerR * Math.sin(endAngle);
    const x4 = center + innerR * Math.cos(endAngle);
    const y4 = center + innerR * Math.sin(endAngle);

    return `M ${x1} ${y1} L ${x2} ${y2} A ${outerR} ${outerR} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerR} ${innerR} 0 0 0 ${x1} ${y1} Z`;
  };

  const getDisplayText = (segment: string | null) => {
    if (!segment) return '\u00A0';
    if (segment === 'BULL') return 'BULL';
    if (segment === 'OB') return 'OB';
    return segment.replace(/^[SDT]/, '').replace('_inner', '');
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full max-w-md mx-auto aspect-square">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${size} ${size}`}
          className="touch-none select-none"
          preserveAspectRatio="xMidYMid meet"
        >
        <circle cx={center} cy={center} r={doubleRadius + 5} fill="#1a1a1a" />

        {SECTOR_ORDER.map((num, idx) => {
          const colors = SECTOR_COLORS[num];

          return (
            <g key={num}>
              <path
                d={createSectorPath(idx, outerSingleRadius, doubleRadius)}
                fill={hoveredSegment === `D${num}` ? '#f97316' : colors.double}
                stroke="#c0a080"
                strokeWidth="1"
                className="cursor-pointer transition-colors"
                onMouseEnter={() => setHoveredSegment(`D${num}`)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => handleClick(`D${num}` as DartTarget)}
              />

              <path
                d={createSectorPath(idx, tripleOuterRadius, outerSingleRadius)}
                fill={hoveredSegment === `S${num}` ? '#f97316' : colors.single}
                stroke="#c0a080"
                strokeWidth="0.5"
                className="cursor-pointer transition-colors"
                onMouseEnter={() => setHoveredSegment(`S${num}`)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => handleClick(`S${num}` as DartTarget)}
              />

              <path
                d={createSectorPath(idx, tripleInnerRadius, tripleOuterRadius)}
                fill={hoveredSegment === `T${num}` ? '#f97316' : colors.triple}
                stroke="#c0a080"
                strokeWidth="1"
                className="cursor-pointer transition-colors"
                onMouseEnter={() => setHoveredSegment(`T${num}`)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => handleClick(`T${num}` as DartTarget)}
              />

              <path
                d={createSectorPath(idx, bullRadius, tripleInnerRadius)}
                fill={hoveredSegment === `S${num}_inner` ? '#f97316' : colors.single}
                stroke="#c0a080"
                strokeWidth="0.5"
                className="cursor-pointer transition-colors"
                onMouseEnter={() => setHoveredSegment(`S${num}_inner`)}
                onMouseLeave={() => setHoveredSegment(null)}
                onClick={() => handleClick(`S${num}` as DartTarget)}
              />
            </g>
          );
        })}

        <circle
          cx={center}
          cy={center}
          r={bullRadius}
          fill={hoveredSegment === 'OB' ? '#f97316' : '#27ae60'}
          stroke="#c0a080"
          strokeWidth="1"
          className="cursor-pointer transition-colors"
          onMouseEnter={() => setHoveredSegment('OB')}
          onMouseLeave={() => setHoveredSegment(null)}
          onClick={() => handleClick('OB')}
        />

        <circle
          cx={center}
          cy={center}
          r={innerBullRadius}
          fill={hoveredSegment === 'BULL' ? '#f97316' : '#e74c3c'}
          stroke="#c0a080"
          strokeWidth="1"
          className="cursor-pointer transition-colors"
          onMouseEnter={() => setHoveredSegment('BULL')}
          onMouseLeave={() => setHoveredSegment(null)}
          onClick={() => handleClick('BULL')}
        />

        {SECTOR_ORDER.map((num, idx) => {
          const anglePerSector = 360 / 20;
          const angle = (idx * anglePerSector - 90) * (Math.PI / 180);
          const textRadius = doubleRadius + 18;
          const x = center + textRadius * Math.cos(angle);
          const y = center + textRadius * Math.sin(angle);

          return (
            <text
              key={`label-${num}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize="12"
              fontWeight="bold"
              className="pointer-events-none select-none"
            >
              {num}
            </text>
          );
        })}
        </svg>
      </div>

      <div className="w-full max-w-xs space-y-2">
        <div className="h-6 flex items-center justify-center">
          <div className="text-center text-lg font-bold text-primary-600 dark:text-primary-400">
            {getDisplayText(hoveredSegment)}
          </div>
        </div>

        <button
          onClick={() => handleClick('MISS')}
          disabled={disabled}
          className="px-6 py-2.5 bg-dark-700 text-white rounded-lg font-medium hover:bg-dark-600 disabled:opacity-50 transition-colors w-full"
        >
          MISS (0)
        </button>
      </div>
    </div>
  );
}
