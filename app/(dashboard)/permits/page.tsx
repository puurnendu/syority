export default function PermitsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Permits / PTW</h1>
      <p className="text-sm text-gray-400">
        Select a project to view permits, or open a project and go to Permits.
      </p>
      <a
        href="/projects"
        className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
      >
        Go to Projects →
      </a>
    </div>
  );
}
