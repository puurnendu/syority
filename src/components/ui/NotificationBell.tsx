'use client';

import { useState, useEffect, useRef } from 'react';

type Notif = {
    id: string;
    type: string;
    title: string;
    body: string;
    link: string | null;
    is_read: boolean;
    created_at: string;
    entity_type: string | null;
};

const TYPE_ICON: Record<string, string> = {
    constraint_open: '⚠️',
    cert_pending: '📜',
    workpack_overdue: '⏰',
    lesson_draft: '💡',
    general: '🔔',
};

export function NotificationBell() {
    const [data, setData] = useState<{
        notifications: Notif[];
        unread_count: number;
    } | null>(null);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void loadNotifs();
        const interval = setInterval(loadNotifs, 60_000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    async function loadNotifs() {
        try {
            const res = await fetch('/api/notifications?unread=false');
            if (res.ok) setData(await res.json());
        } catch (err) {
            // Silently fail — notifications are non-critical
            console.warn('[NotificationBell] Could not load notifications:', err);
        }
    }

    async function markRead(id: string) {
        await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
        setData((prev) =>
            prev
                ? {
                      ...prev,
                      unread_count: Math.max(0, prev.unread_count - 1),
                      notifications: prev.notifications.map((n) =>
                          n.id === id ? { ...n, is_read: true } : n
                      ),
                  }
                : prev
        );
    }

    async function markAllRead() {
        setLoading(true);
        await fetch('/api/notifications/read-all', { method: 'POST' });
        await loadNotifs();
        setLoading(false);
    }

    const unread = data?.unread_count ?? 0;

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="relative p-2 text-gray-500 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors"
                title="Notifications"
            >
                🔔
                {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none px-0.5">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
                    style={{ maxHeight: '70vh' }}
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-900">
                            Notifications
                            {unread > 0 && (
                                <span className="ml-2 text-xs text-white bg-red-500 px-1.5 py-0.5 rounded-full">
                                    {unread}
                                </span>
                            )}
                        </span>
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={markAllRead}
                                disabled={loading}
                                className="text-xs text-blue-600 hover:underline disabled:opacity-40"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="overflow-y-auto flex-1">
                        {!data || data.notifications.length === 0 ? (
                            <div className="text-center py-10 text-sm text-gray-400">
                                <p className="text-2xl mb-1">🔔</p>
                                No notifications
                            </div>
                        ) : (
                            data.notifications.map((n) => (
                                <div
                                    key={n.id}
                                    role="button"
                                    tabIndex={0}
                                    className={`flex gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors ${n.is_read ? 'opacity-60' : ''}`}
                                    onClick={() => {
                                        if (!n.is_read) void markRead(n.id);
                                        if (n.link) window.location.href = n.link;
                                        setOpen(false);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            if (!n.is_read) void markRead(n.id);
                                            if (n.link) window.location.href = n.link;
                                            setOpen(false);
                                        }
                                    }}
                                >
                                    <span className="text-xl flex-none leading-none mt-0.5">
                                        {TYPE_ICON[n.type] ?? '🔔'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p
                                                className={`text-sm leading-snug ${
                                                    n.is_read ? 'text-gray-600' : 'text-gray-900 font-medium'
                                                }`}
                                            >
                                                {n.title}
                                            </p>
                                            {!n.is_read && (
                                                <div className="w-2 h-2 rounded-full bg-blue-500 flex-none mt-1.5" />
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                                        <p className="text-xs text-gray-300 mt-1">
                                            {new Date(n.created_at).toLocaleDateString('en-GB', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
