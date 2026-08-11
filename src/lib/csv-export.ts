'use client';

/**
 * Escapes a single CSV field value.
 * Handles commas, quotes, newlines, and other special characters.
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  const str = (() => {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((v) => String(v ?? '')).join('; ');
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  })();

  // If the value contains a comma, quote, newline, or carriage return, wrap in double quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Exports an array of data objects to a CSV file and triggers a browser download.
 *
 * @param data - Array of objects to export
 * @param columns - Column definitions mapping keys to labels
 * @param filename - Name of the file (without .csv extension)
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: string; label: string }[],
  filename: string
): void {
  // Build header row
  const header = columns.map((c) => escapeCSVValue(c.label)).join(',');

  // Build data rows
  const rows = data.map((item) =>
    columns
      .map((col) => {
        const value = item[col.key];
        return escapeCSVValue(value);
      })
      .join(',')
  );

  // Combine all rows with BOM for Excel UTF-8 support
  const csvContent = '\uFEFF' + [header, ...rows].join('\n');

  // Create Blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Copies table data as TSV (tab-separated values) to the clipboard.
 * TSV works better than CSV for pasting into spreadsheets.
 */
export async function copyToClipboard<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: string; label: string }[]
): Promise<void> {
  const header = columns.map((c) => String(c.label)).join('\t');

  const rows = data.map((item) =>
    columns
      .map((col) => {
        const value = item[col.key];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        }
        return String(value);
      })
      .join('\t')
  );

  const tsvContent = [header, ...rows].join('\n');
  await navigator.clipboard.writeText(tsvContent);
}
