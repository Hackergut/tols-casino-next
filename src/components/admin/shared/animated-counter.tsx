'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

function formatNumber(num: number, decimals: number): string {
  const fixed = num.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const formatted = Number(intPart).toLocaleString();
  return decPart ? `${formatted}.${decPart}` : formatted;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function AnimatedCounter({
  value, duration = 1500, decimals = 2, prefix = '', suffix = '', className = '',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const diff = value - startValue;

    if (diff === 0) {
      prevValueRef.current = value;
      return;
    }

    const step = (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
        setIsComplete(false);
      }
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const current = startValue + diff * easedProgress;

      setDisplayValue(parseFloat(current.toFixed(decimals)));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
        setIsComplete(true);
        startTimeRef.current = null;
        prevValueRef.current = value;
      }
    };

    animationRef.current = requestAnimationFrame(step);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      startTimeRef.current = null;
      prevValueRef.current = value;
    };
  }, [value, duration, decimals]);

  const safeValue = Number.isNaN(displayValue) ? 0 : displayValue;
  const formatted = formatNumber(safeValue, decimals);

  return (
    <motion.span
      className={`inline-block ${className}`}
      initial={false}
      animate={isComplete ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={isComplete ? { duration: 0.35, ease: 'easeOut' } : undefined}
      aria-label={`${prefix}${formatNumber(value, decimals)}${suffix}`}
    >
      {prefix}{formatted}{suffix}
    </motion.span>
  );
}
