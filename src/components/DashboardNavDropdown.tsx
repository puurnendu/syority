'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavDropdownItem = { href: string; label: string; icon?: string };

type Props = {
  label: string;
  items: NavDropdownItem[];
  isActive: boolean;
};

export function DashboardNavDropdown({ label, items, isActive }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
          isActive ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:text-blue-700 hover:bg-blue-50'
        }`}
      >
        {label}
        <span
          className={`inline-block transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 min-w-[12rem] bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          {items.map((item) => {
            const itemActive =
              pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  itemActive ? 'text-blue-700 font-medium bg-blue-50' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.icon && <span>{item.icon}</span>}
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
