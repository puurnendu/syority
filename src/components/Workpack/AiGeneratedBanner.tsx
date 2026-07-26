'use client';

export interface AiGeneratedBannerProps {
  count: number;
  entityName: string;
  message?: string;
  onDismiss: () => void;
  onRegenerate?: () => void;
}

export function AiGeneratedBanner({
  count,
  entityName,
  message,
  onDismiss,
  onRegenerate,
}: AiGeneratedBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 mb-4 bg-violet-50 border border-violet-200 rounded-lg">
      <span className="text-violet-600 text-lg">🤖</span>
      <div className="flex-1 text-sm text-violet-800">
        <strong>AI generated {count} {entityName}</strong>
        {message != null && message !== '' && (
          <span className="text-violet-600"> — {message}</span>
        )}
      </div>
      {onRegenerate != null && (
        <button
          type="button"
          onClick={onRegenerate}
          className="text-xs text-violet-600 hover:text-violet-800 underline"
        >
          Regenerate
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="text-violet-400 hover:text-violet-600 text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
