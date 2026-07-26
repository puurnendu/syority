import Link from 'next/link';

export default function WorkpackNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 gap-4">
      <div className="text-5xl">📋</div>
      <h2 className="text-xl font-semibold text-gray-800">Workpack not found</h2>
      <p className="text-gray-500 text-sm text-center max-w-sm">
        This workpack may have been deleted, or you may not have permission to view it.
      </p>
      <Link
        href="/workpacks"
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
      >
        View all workpacks
      </Link>
    </div>
  );
}
