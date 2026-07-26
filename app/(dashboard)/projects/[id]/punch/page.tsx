export default function ProjectPunchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Punch List</h1>
      <p className="text-sm text-gray-400">Phase 6 feature — coming soon</p>
    </div>
  );
}
