import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface RadialProgressBarProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  animate?: boolean;
  theme?: 'dynamic' | 'indigo' | 'emerald' | 'amber' | 'rose';
}

export default function RadialProgressBar({
  score,
  size = 72,
  strokeWidth = 6,
  label = 'Match',
  animate = true,
  theme = 'dynamic',
}: RadialProgressBarProps) {
  const [progress, setProgress] = useState(animate ? 0 : score);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => {
        setProgress(score);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setProgress(score);
    }
  }, [score, animate]);

  // SVG calculations
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Determine colors based on theme
  let strokeColor = 'stroke-rose-500';
  let textColor = 'text-rose-600';
  let trackColor = 'stroke-rose-100';

  if (theme === 'dynamic') {
    if (score >= 80) {
      strokeColor = 'stroke-emerald-500';
      textColor = 'text-emerald-600';
      trackColor = 'stroke-emerald-100';
    } else if (score >= 50) {
      strokeColor = 'stroke-amber-500';
      textColor = 'text-amber-600';
      trackColor = 'stroke-amber-100';
    } else {
      strokeColor = 'stroke-rose-500';
      textColor = 'text-rose-600';
      trackColor = 'stroke-rose-100';
    }
  } else if (theme === 'indigo') {
    strokeColor = 'stroke-indigo-600';
    textColor = 'text-indigo-600';
    trackColor = 'stroke-indigo-100';
  } else if (theme === 'emerald') {
    strokeColor = 'stroke-emerald-500';
    textColor = 'text-emerald-600';
    trackColor = 'stroke-emerald-100';
  } else if (theme === 'amber') {
    strokeColor = 'stroke-amber-500';
    textColor = 'text-amber-600';
    trackColor = 'stroke-amber-100';
  } else if (theme === 'rose') {
    strokeColor = 'stroke-rose-500';
    textColor = 'text-rose-600';
    trackColor = 'stroke-rose-100';
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90">
          {/* Background track circle */}
          <circle
            className={`${trackColor} transition-all duration-300`}
            strokeWidth={strokeWidth}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {/* Progress circle */}
          <motion.circle
            className={`${strokeColor}`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-extrabold tracking-tight leading-none ${textColor}`}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">
          {label}
        </span>
      )}
    </div>
  );
}
