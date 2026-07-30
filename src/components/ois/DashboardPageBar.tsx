/**
 * M7.6D — Dashboard Page Bar
 *
 * Tab bar for multi-page dashboards.
 * Add, rename, reorder, delete pages.
 */

'use client';

import React, { useState } from 'react';
import type { DesignerStateManager } from '@/core/ois/DesignerStateManager';

interface DashboardPageBarProps {
  designer: DesignerStateManager;
}

export function DashboardPageBar({ designer }: DashboardPageBarProps) {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  React.useEffect(() => {
    return designer.subscribe(forceUpdate);
  }, [designer]);

  const pages = designer.getPages();
  const activePageId = designer.getActivePage();

  const handleAdd = () => {
    const page = designer.addPage(`Page ${pages.length + 1}`);
    designer.setActivePage(page.id);
  };

  const handleDoubleClick = (pageId: string, title: string) => {
    setEditingId(pageId);
    setEditValue(title);
  };

  const handleRename = () => {
    if (editingId && editValue.trim()) {
      designer.renamePage(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const handleDelete = (pageId: string) => {
    if (pages.length <= 1) return;
    designer.removePage(pageId);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '2px',
      padding: '4px 16px',
      background: '#F9FAFB',
      borderBottom: '1px solid #E5E7EB',
      overflowX: 'auto',
    }}>
      {pages.map((page) => {
        const isActive = page.id === activePageId;
        const isEditing = editingId === page.id;

        return (
          <div
            key={page.id}
            onClick={() => designer.setActivePage(page.id)}
            onDoubleClick={() => handleDoubleClick(page.id, page.title)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px 6px 0 0',
              background: isActive ? '#FFFFFF' : 'transparent',
              border: isActive ? '1px solid #E5E7EB' : '1px solid transparent',
              borderBottom: isActive ? '1px solid #FFFFFF' : '1px solid transparent',
              marginBottom: isActive ? '-1px' : '0',
              color: isActive ? '#111827' : '#6B7280',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              position: 'relative',
              zIndex: isActive ? 1 : 0,
            }}
          >
            {page.icon && <span style={{ fontSize: '14px' }}>{page.icon}</span>}

            {isEditing ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                style={{
                  width: '100px',
                  padding: '2px 4px',
                  border: '1px solid #3B82F6',
                  borderRadius: '4px',
                  fontSize: '13px',
                  outline: 'none',
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span>{page.title}</span>
            )}

            {pages.length > 1 && isActive && !isEditing && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(page.id); }}
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  border: 'none',
                  background: 'transparent',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: '2px',
                }}
                title="Delete page"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      {/* Add page button */}
      <button
        onClick={handleAdd}
        style={{
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px dashed #D1D5DB',
          background: 'transparent',
          color: '#9CA3AF',
          fontSize: '12px',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'border-color 0.15s',
        }}
        title="Add page"
      >
        + Page
      </button>
    </div>
  );
}
