'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface ShutdownSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  event_type?: string;
  planned_start?: string | null;
  planned_end?: string | null;
  site_id?: string;
  site?: {
    id: string;
    name: string;
    code: string;
  } | null;
  _count?: {
    Workpack?: number;
    wbsNodes?: number;
    milestones?: number;
  };
}

interface ActiveShutdownContextType {
  activeEventId: string | null;
  activeShutdown: ShutdownSummary | null;
  allShutdowns: ShutdownSummary[];
  isLoading: boolean;
  setActiveShutdown: (eventId: string) => void;
  clearActiveShutdown: () => void;
  refreshShutdowns: () => Promise<void>;
}

const ActiveShutdownContext = createContext<ActiveShutdownContextType | undefined>(undefined);

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days = 30) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
}

function removeCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

export function ActiveShutdownProvider({ children }: { children: React.ReactNode }) {
  const [activeEventId, setActiveEventIdState] = useState<string | null>(null);
  const [allShutdowns, setAllShutdowns] = useState<ShutdownSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchShutdowns = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/events');
      if (!res.ok) {
        setAllShutdowns([]);
        return;
      }
      const data = await res.json();
      const items: ShutdownSummary[] = data.items || [];
      setAllShutdowns(items);

      // Determine initial active shutdown
      const storedId = getCookie('syority_active_event') || 
        (typeof window !== 'undefined' ? localStorage.getItem('syority_active_event_id') : null);

      if (storedId && items.some(item => item.id === storedId)) {
        setActiveEventIdState(storedId);
        setCookie('syority_active_event', storedId);
      } else if (items.length > 0) {
        // Find first active/in-progress or fallback to first item
        const preferred = items.find(e => ['active', 'in_progress', 'execution'].includes(e.status.toLowerCase())) || items[0];
        setActiveEventIdState(preferred.id);
        setCookie('syority_active_event', preferred.id);
        if (typeof window !== 'undefined') {
          localStorage.setItem('syority_active_event_id', preferred.id);
        }
      } else {
        setActiveEventIdState(null);
        removeCookie('syority_active_event');
        if (typeof window !== 'undefined') {
          localStorage.removeItem('syority_active_event_id');
        }
      }
    } catch (err) {
      console.error('[ActiveShutdownContext] Failed to fetch events:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShutdowns();
  }, [fetchShutdowns]);

  const setActiveShutdown = useCallback((eventId: string) => {
    const found = allShutdowns.find(item => item.id === eventId);
    if (!found && allShutdowns.length > 0) {
      console.warn(`[ActiveShutdownContext] Event ${eventId} not found in available shutdowns.`);
      return;
    }
    setActiveEventIdState(eventId);
    setCookie('syority_active_event', eventId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('syority_active_event_id', eventId);
    }
  }, [allShutdowns]);

  const clearActiveShutdown = useCallback(() => {
    setActiveEventIdState(null);
    removeCookie('syority_active_event');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('syority_active_event_id');
    }
  }, []);

  const activeShutdown = allShutdowns.find(item => item.id === activeEventId) || null;

  return (
    <ActiveShutdownContext.Provider
      value={{
        activeEventId,
        activeShutdown,
        allShutdowns,
        isLoading,
        setActiveShutdown,
        clearActiveShutdown,
        refreshShutdowns: fetchShutdowns,
      }}
    >
      {children}
    </ActiveShutdownContext.Provider>
  );
}

export function useActiveShutdown() {
  const context = useContext(ActiveShutdownContext);
  if (!context) {
    throw new Error('useActiveShutdown must be used within an ActiveShutdownProvider');
  }
  return context;
}
