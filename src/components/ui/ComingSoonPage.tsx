'use client';

import Link from 'next/link';

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export type ComingSoonPageProps = {
  featureName: string;
  description?: string;
  plannedFor?: string;
  icon?: string;
  backHref?: string;
  backLabel?: string;
  relatedLinks?: Array<{ href: string; label: string; available: boolean }>;
};

export function ComingSoonPage({
  featureName,
  description,
  plannedFor,
  icon = '🚧',
  backHref = '/settings',
  backLabel = 'Back to Settings',
  relatedLinks = [],
}: ComingSoonPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="text-6xl mb-6 select-none">{icon}</div>

      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
        <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" />
        {plannedFor ? `Planned for ${plannedFor}` : 'Coming Soon'}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">{featureName}</h1>

      {description && (
        <p className="text-gray-500 text-sm text-center max-w-lg mb-8 leading-relaxed">{description}</p>
      )}

      <div className="w-16 h-px bg-gray-200 mb-8" />

      {relatedLinks.length > 0 && (
        <div className="mb-8 w-full max-w-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center mb-3">Available now</p>
          <div className="space-y-2">
            {relatedLinks
              .filter((l) => l.available)
              .map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm text-gray-700 group"
                >
                  <span>{link.label}</span>
                  <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                    Open →
                  </span>
                </Link>
              ))}
          </div>
        </div>
      )}

      <Link
        href={backHref}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        {backLabel}
      </Link>
    </div>
  );
}
