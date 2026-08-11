'use client';

import React, { useState, useCallback } from 'react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarDays, X } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';

interface DateRangePickerProps {
  onRangeChange?: (range: { from: string; to: string } | null) => void;
  className?: string;
}

type PresetKey = 'today' | '7days' | '30days' | '90days' | 'custom';

const presets: { key: PresetKey; label: string; getRange: () => DateRange }[] = [
  {
    key: 'today',
    label: 'Today',
    getRange: () => {
      const today = startOfDay(new Date());
      return { from: today, to: endOfDay(today) };
    },
  },
  {
    key: '7days',
    label: 'Last 7 days',
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    key: '30days',
    label: 'Last 30 days',
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    key: '90days',
    label: 'Last 90 days',
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 89)),
      to: endOfDay(new Date()),
    }),
  },
];

export function DateRangePicker({ onRangeChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);

  const applyPreset = useCallback(
    (preset: (typeof presets)[number]) => {
      const range = preset.getRange();
      setDateRange(range);
      setActivePreset(preset.key);
      onRangeChange?.({
        from: range.from!.toISOString(),
        to: range.to!.toISOString(),
      });
      setOpen(false);
    },
    [onRangeChange]
  );

  const handleSelect = useCallback(
    (range: DateRange | undefined) => {
      setDateRange(range);
      setActivePreset('custom');
      if (range?.from && range?.to) {
        onRangeChange?.({
          from: startOfDay(range.from).toISOString(),
          to: endOfDay(range.to).toISOString(),
        });
      }
    },
    [onRangeChange]
  );

  const handleClear = useCallback(() => {
    setDateRange(undefined);
    setActivePreset(null);
    onRangeChange?.(null);
  }, [onRangeChange]);

  const displayText = React.useMemo(() => {
    if (!dateRange?.from) return 'Date range';
    if (!dateRange.to) return format(dateRange.from, 'MMM dd');
    return `${format(dateRange.from, 'MMM dd')} – ${format(dateRange.to, 'MMM dd')}`;
  }, [dateRange]);

  const hasRange = !!(dateRange?.from && dateRange?.to);

  return (
    <div className={`flex items-center gap-1.5 ${className || ''}`}>
      {hasRange && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal">
          {activePreset && activePreset !== 'custom'
            ? presets.find((p) => p.key === activePreset)?.label
            : displayText}
          <button
            onClick={handleClear}
            className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-9 gap-1.5 text-sm font-normal ${hasRange ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {hasRange && !activePreset ? displayText : hasRange ? 'Date range' : 'Date range'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {/* Presets */}
          <div className="flex items-center gap-1 p-3 border-b">
            {presets.map((preset) => (
              <Button
                key={preset.key}
                variant={activePreset === preset.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          {/* Calendar */}
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleSelect}
            numberOfMonths={2}
            defaultMonth={dateRange?.from || subDays(new Date(), 6)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
