import Link from 'next/link';

export default function GlobalNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="text-blue-700 font-black text-2xl tracking-tight mb-8">
        AURIANOA <span className="text-xs font-light text-gray-400 align-middle ml-1">OS</span>
      </div>
      <div className="text-8xl font-black text-gray-100 select-none mb-2">404</div>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Page not found</h1>
      <p className="text-gray-500 text-sm text-center max-w-md mb-8">
        This page does not exist. It may be a feature that is planned but not built yet, or the URL may have changed.
      </p>
      <div className="flex gap-3">
        <Link href="/workpacks" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
          Go to Workpacks
        </Link>
        <Link href="/settings" className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
          Settings
        </Link>
      </div>
      <p className="text-xs text-gray-400 mt-8">
        <Link href="/dashboard" className="text-blue-500 hover:underline">Go to Dashboard</Link>
      </p>
    </div>
  );
}
