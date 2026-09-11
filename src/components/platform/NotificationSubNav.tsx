'use client';

/**
 * M7.6H — Shared Notification Sub-Navigation
 *
 * Used by all /platform/notifications/* pages.
 * Single source of truth — never duplicate NAV_ITEMS inline.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NOTIFICATION_SUB_NAV } from '@/config/platform-navigation';

export function NotificationSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {NOTIFICATION_SUB_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
            pathname === item.href
              ? 'bg-white text-gray-900 font-medium shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          }`}
        >
          <span>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
