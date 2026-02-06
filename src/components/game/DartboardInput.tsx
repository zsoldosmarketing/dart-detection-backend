import { useState, useCallback, useRef } from 'react';
import type { DartTarget } from '../../lib/dartsEngine';

interface DartboardInputProps {
  onThrow: (target: DartTarget) => void;
  disabled?: boolean;
}

const SECTOR_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export function DartboardInput({ onThrow, disabled }: DartboardInputProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [flashSegment, setFlashSegment] = useState<string | null>(null);
  const lastTapRef = useRef<string | null>(null);

  const size = 440;
  const center = size / 2;

  const outerRimRadius = 210;
  const outerRingRadius = 195;
  const doubleOuterRadius = 170;
  const doubleInnerRadius = 160;
  const outerSingleOuter = 160;
  const outerSingleInner = 107;
  const tripleOuterRadius = 107;
  const tripleInnerRadius = 97;
  const innerSingleOuter = 97;
  const innerSingleInner = 32;
  const outerBullRadius = 32;
  const innerBullRadius = 14;

  const numberRingRadius = 183;

  const handleClick = useCallback((target: DartTarget, segmentId: string) => {
    if (disabled) return;
    if (lastTapRef.current === segmentId) return;
    lastTapRef.current = segmentId;
    setTimeout(() => { lastTapRef.current = null; }, 300);
    setFlashSegment(segmentId);
    setTimeout(() => setFlashSegment(null), 200);
    onThrow(target);
  }, [disabled, onThrow]);

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

  const isEvenSector = (idx: number) => idx % 2 === 0;

  const getSingleFill = (idx: number, segId: string) => {
    if (flashSegment === segId) return '#fbbf24';
    if (hoveredSegment === segId) return hoveredSegment ? '#f59e0b' : '';
    return isEvenSector(idx) ? '#1a1a1a' : '#f7e8c8';
  };

  const getDoubleFill = (idx: number, segId: string) => {
    if (flashSegment === segId) return '#fbbf24';
    if (hoveredSegment === segId) return '#f59e0b';
    return isEvenSector(idx) ? '#c0392b' : '#1a7a3a';
  };

  const getTripleFill = (idx: number, segId: string) => {
    if (flashSegment === segId) return '#fbbf24';
    if (hoveredSegment === segId) return '#f59e0b';
    return isEvenSector(idx) ? '#c0392b' : '#1a7a3a';
  };

  const getSegmentLabel = (seg: string | null): string => {
    if (!seg) return '';
    if (seg === 'BULL') return 'BULLSEYE (50)';
    if (seg === 'OB') return 'OUTER BULL (25)';
    if (seg === 'MISS') return 'MISS (0)';
    const match = seg.match(/^([SDT])(\d+)/);
    if (!match) return '';
    const [, type, num] = match;
    const prefix = type === 'D' ? 'DOUBLE' : type === 'T' ? 'TRIPLE' : '';
    const score = type === 'D' ? parseInt(num) * 2 : type === 'T' ? parseInt(num) * 3 : parseInt(num);
    return prefix ? `${prefix} ${num} (${score})` : `${num}`;
  };

  const touchProps = (target: DartTarget, segmentId: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      setHoveredSegment(segmentId);
      handleClick(target, segmentId);
    },
    onPointerUp: () => setHoveredSegment(null),
    onPointerCancel: () => setHoveredSegment(null),
    onMouseEnter: () => setHoveredSegment(segmentId),
    onMouseLeave: () => setHoveredSegment(null),
  });

  return (
    <div className="flex flex-col items-center w-full h-full">
      <div className="flex-1 w-full flex items-center justify-center min-h-0">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="select-none drop-shadow-2xl max-h-full max-w-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ touchAction: 'none', width: 'min(100%, 520px)' }}
        >
          <defs>
            <radialGradient id="boardShadow" cx="50%" cy="50%" r="50%">
              <stop offset="85%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
            </radialGradient>
            <radialGradient id="rimGradient" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor="#222" />
              <stop offset="50%" stopColor="#111" />
              <stop offset="100%" stopColor="#050505" />
            </radialGradient>
            <filter id="innerShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
              <feOffset dx="0" dy="1" result="offsetBlur" />
              <feFlood floodColor="rgba(0,0,0,0.25)" result="color" />
              <feComposite in2="offsetBlur" operator="in" result="shadow" />
              <feComposite in="SourceGraphic" in2="shadow" operator="over" />
            </filter>
            <filter id="glowFilter">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx={center} cy={center} r={outerRimRadius} fill="url(#rimGradient)" />
          <circle cx={center} cy={center} r={outerRimRadius - 1} fill="none" stroke="#2a2a2a" strokeWidth="0.5" />
          <circle cx={center} cy={center} r={outerRimRadius - 3} fill="none" stroke="#1a1a1a" strokeWidth="0.5" />

          <circle cx={center} cy={center} r={outerRingRadius} fill="#1e1e1e" />

          {SECTOR_ORDER.map((num, idx) => {
            const anglePerSector = 360 / 20;
            const startAngle = (idx * anglePerSector - anglePerSector / 2 - 90) * (Math.PI / 180);
            const endAngle = ((idx + 1) * anglePerSector - anglePerSector / 2 - 90) * (Math.PI / 180);

            const bgX1 = center + doubleOuterRadius * Math.cos(startAngle);
            const bgY1 = center + doubleOuterRadius * Math.sin(startAngle);
            const bgX2 = center + outerRingRadius * Math.cos(startAngle);
            const bgY2 = center + outerRingRadius * Math.sin(startAngle);
            const bgX3 = center + outerRingRadius * Math.cos(endAngle);
            const bgY3 = center + outerRingRadius * Math.sin(endAngle);
            const bgX4 = center + doubleOuterRadius * Math.cos(endAngle);
            const bgY4 = center + doubleOuterRadius * Math.sin(endAngle);

            const isHit = hoveredSegment?.includes(String(num));

            return (
              <path
                key={`bg-${num}`}
                d={`M ${bgX1} ${bgY1} L ${bgX2} ${bgY2} A ${outerRingRadius} ${outerRingRadius} 0 0 1 ${bgX3} ${bgY3} L ${bgX4} ${bgY4} A ${doubleOuterRadius} ${doubleOuterRadius} 0 0 0 ${bgX1} ${bgY1} Z`}
                fill={isHit ? '#1f1f1f' : isEvenSector(idx) ? '#141414' : '#181818'}
                style={{ transition: 'fill 0.15s ease' }}
              />
            );
          })}

          {SECTOR_ORDER.map((num, idx) => {
            const dId = `D${num}`;
            const sId = `S${num}`;
            const tId = `T${num}`;
            const siId = `S${num}_inner`;

            return (
              <g key={num} filter="url(#innerShadow)">
                <path
                  d={createSectorPath(idx, doubleInnerRadius, doubleOuterRadius)}
                  fill={getDoubleFill(idx, dId)}
                  className="cursor-pointer"
                  style={{ transition: 'fill 0.1s ease' }}
                  {...touchProps(`D${num}` as DartTarget, dId)}
                />

                <path
                  d={createSectorPath(idx, outerSingleInner, outerSingleOuter)}
                  fill={getSingleFill(idx, sId)}
                  className="cursor-pointer"
                  style={{ transition: 'fill 0.1s ease' }}
                  {...touchProps(`S${num}` as DartTarget, sId)}
                />

                <path
                  d={createSectorPath(idx, tripleInnerRadius, tripleOuterRadius)}
                  fill={getTripleFill(idx, tId)}
                  className="cursor-pointer"
                  style={{ transition: 'fill 0.1s ease' }}
                  {...touchProps(`T${num}` as DartTarget, tId)}
                />

                <path
                  d={createSectorPath(idx, innerSingleInner, innerSingleOuter)}
                  fill={getSingleFill(idx, siId)}
                  className="cursor-pointer"
                  style={{ transition: 'fill 0.1s ease' }}
                  {...touchProps(`S${num}` as DartTarget, siId)}
                />
              </g>
            );
          })}

          {SECTOR_ORDER.map((_num, idx) => {
            const anglePerSector = 360 / 20;
            const angle = (idx * anglePerSector - anglePerSector / 2 - 90) * (Math.PI / 180);
            const x1 = center + innerSingleInner * Math.cos(angle);
            const y1 = center + innerSingleInner * Math.sin(angle);
            const x2 = center + doubleOuterRadius * Math.cos(angle);
            const y2 = center + doubleOuterRadius * Math.sin(angle);
            return (
              <line
                key={`wire-${idx}`}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#8a8a8a"
                strokeWidth="0.8"
                className="pointer-events-none"
                opacity="0.5"
              />
            );
          })}

          <circle cx={center} cy={center} r={doubleOuterRadius} fill="none" stroke="#8a8a8a" strokeWidth="0.8" opacity="0.5" className="pointer-events-none" />
          <circle cx={center} cy={center} r={doubleInnerRadius} fill="none" stroke="#8a8a8a" strokeWidth="0.8" opacity="0.5" className="pointer-events-none" />
          <circle cx={center} cy={center} r={tripleOuterRadius} fill="none" stroke="#8a8a8a" strokeWidth="0.8" opacity="0.5" className="pointer-events-none" />
          <circle cx={center} cy={center} r={tripleInnerRadius} fill="none" stroke="#8a8a8a" strokeWidth="0.8" opacity="0.5" className="pointer-events-none" />
          <circle cx={center} cy={center} r={innerSingleInner} fill="none" stroke="#8a8a8a" strokeWidth="0.8" opacity="0.5" className="pointer-events-none" />

          <circle
            cx={center} cy={center} r={outerBullRadius}
            fill={flashSegment === 'OB' ? '#fbbf24' : hoveredSegment === 'OB' ? '#f59e0b' : '#1a7a3a'}
            className="cursor-pointer"
            style={{ transition: 'fill 0.1s ease' }}
            {...touchProps('OB', 'OB')}
          />

          <circle cx={center} cy={center} r={outerBullRadius} fill="none" stroke="#8a8a8a" strokeWidth="0.8" opacity="0.5" className="pointer-events-none" />

          <circle
            cx={center} cy={center} r={innerBullRadius}
            fill={flashSegment === 'BULL' ? '#fbbf24' : hoveredSegment === 'BULL' ? '#f59e0b' : '#c0392b'}
            className="cursor-pointer"
            style={{ transition: 'fill 0.1s ease' }}
            {...touchProps('BULL', 'BULL')}
          />

          <circle cx={center} cy={center} r={innerBullRadius} fill="none" stroke="#8a8a8a" strokeWidth="0.8" opacity="0.5" className="pointer-events-none" />

          <circle cx={center} cy={center} r={doubleOuterRadius} fill="url(#boardShadow)" className="pointer-events-none" />

          {SECTOR_ORDER.map((num, idx) => {
            const anglePerSector = 360 / 20;
            const angle = (idx * anglePerSector - 90) * (Math.PI / 180);
            const x = center + numberRingRadius * Math.cos(angle);
            const y = center + numberRingRadius * Math.sin(angle);

            const isHovered = hoveredSegment?.includes(String(num));

            return (
              <text
                key={`label-${num}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={isHovered ? '#fbbf24' : '#d4d4d4'}
                fontSize="14"
                fontWeight="800"
                fontFamily="Inter, system-ui, sans-serif"
                letterSpacing="-0.02em"
                className="pointer-events-none select-none"
                style={{
                  textShadow: isHovered ? '0 0 8px rgba(251,191,36,0.5)' : '0 1px 2px rgba(0,0,0,0.8)',
                  transition: 'fill 0.15s ease',
                }}
                filter={isHovered ? 'url(#glowFilter)' : undefined}
              >
                {num}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="shrink-0 w-full mt-1 mx-auto" style={{ maxWidth: 'min(100vw - 16px, 520px)' }}>
        <button
          onClick={() => handleClick('MISS', 'MISS')}
          disabled={disabled}
          onMouseEnter={() => setHoveredSegment('MISS')}
          onMouseLeave={() => setHoveredSegment(null)}
          className="px-6 py-2.5 bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white rounded-xl font-semibold text-base disabled:opacity-50 transition-all w-full border border-dark-700 hover:border-dark-600 active:scale-[0.98]"
        >
          MISS (0)
        </button>
      </div>
    </div>
  );
}
