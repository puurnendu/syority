export default function ProjectEquipmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Equipment</h1>
      <p className="text-sm text-gray-400">Phase 1 shell — coming soon</p>
    </div>
  );
}
