import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ReportCenter } from './_components/ReportCenter';

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">M14 Report Center</h1>
        <p className="text-sm text-gray-500 mt-1">Generate and view immutable operational reports.</p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <ReportCenter />
      </div>
    </div>
  );
}
