export default function PunchListPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Punch List</h1>
      <p className="text-sm text-gray-400">
        Select a project to view punch items, or open a project and go to Punch
        List.
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
