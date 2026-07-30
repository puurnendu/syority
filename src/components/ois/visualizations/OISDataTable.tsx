/**
 * OIS Data Table Visualization
 */
'use client';

import React, { useState, useMemo } from 'react';
import type { VisualizationProps } from '../WidgetRenderer';

export function OISDataTable({ data, config }: VisualizationProps) {
  const rows = data.rows ?? [];
  const pageSize = config.pageSize ?? 10;
  const showSearch = config.showSearch ?? true;
  const stripedRows = config.stripedRows ?? true;

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const columns = useMemo(() => {
    if (config.columns) return config.columns;
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).map((key) => ({
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      sortable: true,
    }));
  }, [rows, config.columns]);

  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    const lower = searchTerm.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(lower))
    );
  }, [rows, searchTerm]);

  const sortedRows = useMemo(() => {
    if (!sortCol) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortCol] ?? '';
      const bVal = b[sortCol] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (rows.length === 0) {
    return <div style={{ color: '#9CA3AF', textAlign: 'center', padding: '20px' }}>No data</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
      {showSearch && (
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          style={{
            padding: '6px 12px',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            fontSize: '12px',
            outline: 'none',
          }}
        />
      )}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              {columns.map((col: any) => (
                <th
                  key={col.key}
                  onClick={() => {
                    if (col.sortable !== false) {
                      setSortCol(col.key);
                      setSortDir((d) => (sortCol === col.key && d === 'asc' ? 'desc' : 'asc'));
                    }
                  }}
                  style={{
                    padding: '8px 10px',
                    textAlign: (col.align as any) ?? 'left',
                    fontWeight: 600,
                    color: '#374151',
                    background: '#F9FAFB',
                    borderBottom: '2px solid #E5E7EB',
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                    position: config.stickyHeader ? 'sticky' : undefined,
                    top: config.stickyHeader ? 0 : undefined,
                    zIndex: config.stickyHeader ? 1 : undefined,
                  }}
                >
                  {col.label}
                  {sortCol === col.key && (
                    <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, i) => (
              <tr key={i} style={{
                background: stripedRows ? (i % 2 === 0 ? '#FFFFFF' : '#F9FAFB') : '#FFFFFF',
                transition: 'background 0.1s',
              }}>
                {columns.map((col: any) => (
                  <td key={col.key} style={{
                    padding: '6px 10px',
                    color: '#374151',
                    borderBottom: '1px solid #F3F4F6',
                    textAlign: (col.align as any) ?? 'left',
                  }}>
                    {row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#6B7280' }}>
          <span>{sortedRows.length} rows</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
              style={{ padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: '4px', background: '#FFF', cursor: 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
              ←
            </button>
            <span style={{ padding: '4px 8px' }}>{currentPage}/{totalPages}</span>
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              style={{ padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: '4px', background: '#FFF', cursor: 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
