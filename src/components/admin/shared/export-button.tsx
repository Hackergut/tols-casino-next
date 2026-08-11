'use client';

import React from 'react';
import { Download, ClipboardCopy, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { exportToCSV, copyToClipboard } from '@/lib/csv-export';
import { toast } from 'sonner';

interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  columns: { key: string; label: string }[];
  filename: string;
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
}: ExportButtonProps<T>) {
  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.info('No data to export');
      return;
    }
    exportToCSV(data, columns, filename);
    toast.success(`Exported ${data.length} records to CSV`);
  };

  const handleCopyClipboard = async () => {
    if (data.length === 0) {
      toast.info('No data to copy');
      return;
    }
    try {
      await copyToClipboard(data, columns);
      toast.success(`Copied ${data.length} records to clipboard`);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 hover:bg-primary/5 hover:border-primary/30 transition-all duration-200">
          <Download className="h-4 w-4" />
          <span className="sr-only">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          Export Options
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
          <Download className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-sm">Export CSV</span>
            <span className="text-[10px] text-muted-foreground">Download as .csv file</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyClipboard} className="gap-2 cursor-pointer">
          <ClipboardCopy className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="text-sm">Copy to Clipboard</span>
            <span className="text-[10px] text-muted-foreground">Tab-separated values</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
