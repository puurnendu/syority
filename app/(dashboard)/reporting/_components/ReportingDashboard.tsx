'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, Cell
} from 'recharts';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ReportingDashboardProps {
  userRole: string;
  canBuild: boolean;
  canAdmin: boolean;
}

export function ReportingDashboard({ userRole, canBuild, canAdmin }: ReportingDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'builder' | 'delivery'>('dashboard');
  
  // ── Data Fetching ──────────────────────────────────────────────────────────
  const { data: dashboard, error: dashError, isLoading: dashLoading } = useSWR('/api/reporting/dashboard-data', fetcher, { refreshInterval: 60000 });
  const { data: templateData, mutate: mutateTemplates } = useSWR('/api/reporting/templates', fetcher);
  const { data: deliveryData, mutate: mutateDeliveries } = useSWR('/api/reporting/deliveries', fetcher);

  // ── Builder State ──────────────────────────────────────────────────────────
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', pages: [{ id: '1', name: 'General', cards: ['evm', 'scurve', 'unit-progress'] }] });

  // ── Delivery State ─────────────────────────────────────────────────────────
  const [isCreatingDelivery, setIsCreatingDelivery] = useState(false);
  const [newDelivery, setNewDelivery] = useState({
    name: '',
    template_id: '',
    recipients: '',
    channels: ['In-App'],
    frequency: 'Daily',
    delivery_time: '06:00'
  });

  const handleSaveTemplate = async () => {
    if (!newTemplate.name) return alert('Name is required');
    const res = await fetch('/api/reporting/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTemplate),
    });
    if (res.ok) {
      setIsCreatingTemplate(false);
      mutateTemplates();
    }
  };

  const handleSaveDelivery = async () => {
    if (!newDelivery.name || !newDelivery.template_id || !newDelivery.recipients) return alert('Missing fields');
    const res = await fetch('/api/reporting/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newDelivery,
        recipients: newDelivery.recipients.split(',').map(s => s.trim())
      }),
    });
    if (res.ok) {
      setIsCreatingDelivery(false);
      mutateDeliveries();
    }
  };

  if (dashLoading) return <div className="p-8 text-center text-gray-500 font-medium">Loading Dashboard Data...</div>;
  if (dashError) return <div className="p-8 text-center text-red-500 font-medium">Error loading dashboard</div>;

  const { evm, lookahead, unitProgress, criticalPath, punchSummary, criticalCount, activityCount } = dashboard || {};

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[#0D2137]">Reporting Intelligence</h1>
          <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wider font-semibold">
            Real-time Project Performance & Automated Delivery
          </p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {(['dashboard', 'builder', 'delivery'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-tight ${
                activeTab === tab 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        
        {/* ── TAB: DASHBOARD ─────────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Schedule Performance (SPI)', value: evm?.spi, color: evm?.spi >= 1 ? 'text-green-600' : 'text-red-500', note: 'Planned Duration' },
                { label: 'Cost Performance (CPI)', value: evm?.cpi, color: evm?.cpi >= 1 ? 'text-green-600' : 'text-red-500', note: 'Budget Utilization' },
                { label: 'Schedule Variance (SV)', value: Number(evm?.sv || 0).toLocaleString(), color: evm?.sv >= 0 ? 'text-blue-600' : 'text-orange-500', note: 'Project Day Variance' },
                { label: 'Estimate at Completion (EAC)', value: `$${Number(evm?.eac || 0).toLocaleString()}`, color: 'text-[#0D2137]', note: `Budget (BAC): $${Number(evm?.bac || 0).toLocaleString()}` },
              ].map((kpi, i) => (
                <div key={i} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                  <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{kpi.label}</div>
                  <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-[10px] text-gray-500 font-medium mt-1">{kpi.note}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* S-Curve Chart (Mocked from aggregate for now) */}
              <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-black uppercase tracking-tight text-[#0D2137]">S-Curve: Cumulative Planned vs Actual</h3>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> <span className="text-[10px] font-bold text-gray-500 uppercase">Actual</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-gray-200" /> <span className="text-[10px] font-bold text-gray-500 uppercase">Planned</span></div>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[{ x: 'W1', p: 10, a: 8 }, { x: 'W2', p: 25, a: 22 }, { x: 'W3', p: 45, a: 38 }, { x: 'W4', p: 70, a: 55 }, { x: 'Now', p: 90, a: 78 }]}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                      <XAxis dataKey="x" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#9CA3AF' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#9CA3AF' }} domain={[0, 100]} unit="%" />
                      <Tooltip contentStyle={{ fontSize: 10, fontWeight: 700, borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="p" stroke="#D1D5DB" fill="#F3F4F6" strokeWidth={3} />
                      <Area type="monotone" dataKey="a" stroke="#3B82F6" fill="rgba(59, 130, 246, 0.1)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Unit Progress */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-tight text-[#0D2137] mb-6">Unit Progress Allocation</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={unitProgress?.slice(0, 6) || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                      <XAxis type="number" axisLine={false} tickLine={false} hide />
                      <YAxis dataKey="unit" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} width={80} />
                      <Tooltip />
                      <Bar dataKey="actual" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Lookahead Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-sm font-black uppercase tracking-tight text-[#0D2137]">72h Performance Lookahead</h3>
                <span className="text-[10px] bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{lookahead?.length || 0} ITEMS</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-3">Activity</th>
                    <th className="px-6 py-3 text-center">Workpack</th>
                    <th className="px-6 py-3 text-center">Early Start</th>
                    <th className="px-6 py-3 text-center">Status</th>
                    <th className="px-6 py-3 text-right">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lookahead?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-bold text-gray-900">{item.description}</td>
                      <td className="px-6 py-3 text-center text-gray-500 font-medium">{item.workpack || '—'}</td>
                      <td className="px-6 py-3 text-center text-blue-600 font-black">{new Date(item.early_start).toLocaleDateString()}</td>
                      <td className="px-6 py-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-black uppercase text-[10px]">{item.status}</span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {item.is_critical ? <span className="text-red-500 font-black uppercase tracking-tighter">CRITICAL PATH</span> : <span className="text-gray-300 font-bold italic">Standard</span>}
                      </td>
                    </tr>
                  ))}
                  {(!lookahead || lookahead.length === 0) && (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">No activities in current lookahead window</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── TAB: BUILDER ───────────────────────────────────────────────────── */}
        {activeTab === 'builder' && (
          <div className="space-y-6">
            {!isCreatingTemplate ? (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-tight text-[#0D2137]">Report Templates</h3>
                  <button onClick={() => setIsCreatingTemplate(true)} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-800 transition-colors uppercase tracking-tight">Create Template</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templateData?.templates?.map((t: any) => (
                    <div key={t.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-blue-700 transition-all cursor-pointer group">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-lg font-black text-[#0D2137]">{t.name}</h4>
                        <div className="w-8 h-8 rounded bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-blue-700">⚙️</div>
                      </div>
                      <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-4">
                        {t.pages?.length || 0} Pages • {t._count?.deliveries || 0} Active Deliveries
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 bg-gray-50 text-gray-700 py-1.5 rounded text-[10px] font-black uppercase tracking-tight hover:bg-gray-100 italic">View Preview</button>
                        <button className="flex-1 bg-blue-50 text-blue-700 py-1.5 rounded text-[10px] font-black uppercase tracking-tight hover:bg-blue-100">Edit Template</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl mx-auto shadow-xl">
                <div className="mb-8 flex justify-between items-center border-b border-gray-100 pb-4">
                  <h2 className="text-xl font-black text-[#0D2137]">Report Designer</h2>
                  <button onClick={() => setIsCreatingTemplate(false)} className="text-gray-400 hover:text-red-500 font-black uppercase text-xs tracking-widest">Cancel</button>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Template Name</label>
                    <input 
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-bold text-gray-800"
                      placeholder="e.g. Executive Performance Weekly"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Page Configuration</label>
                    <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
                      <div className="flex items-center gap-3 p-3 bg-white rounded border border-gray-200 mb-3 shadow-sm">
                        <div className="w-6 h-6 rounded bg-blue-700 text-white flex items-center justify-center text-[10px] font-black">1</div>
                        <div className="flex-1">
                          <input className="font-black text-xs text-[#0D2137] outline-none" value="Performance Dashboard" readOnly />
                          <div className="text-[10px] text-gray-400 font-bold">Includes S-Curve, EVM KPIs, and Lookahead table</div>
                        </div>
                      </div>
                      <button className="w-full py-2 text-[10px] font-black uppercase text-gray-400 hover:text-blue-700 hover:bg-white rounded border border-transparent hover:border-blue-200 transition-all">+ Add Report Page</button>
                    </div>
                  </div>
                  <button onClick={handleSaveTemplate} className="w-full bg-[#0D2137] text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:scale-[1.01] transition-all shadow-lg shadow-blue-900/10">Save and Generate Template</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: DELIVERY ──────────────────────────────────────────────────── */}
        {activeTab === 'delivery' && (
          <div className="space-y-6">
            {!isCreatingDelivery ? (
              <>
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-tight text-[#0D2137]">Scheduled Deliveries</h3>
                  <button onClick={() => setIsCreatingDelivery(true)} className="bg-[#0D2137] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-black transition-colors uppercase tracking-tight">Schedule New</button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-4">Delivery Name</th>
                        <th className="px-6 py-4 text-center">Template</th>
                        <th className="px-6 py-4 text-center">Frequency</th>
                        <th className="px-6 py-4 text-center">Channels</th>
                        <th className="px-6 py-4 text-center">Last Run</th>
                        <th className="px-6 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {deliveryData?.deliveries?.map((d: any) => (
                        <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-black text-[#0D2137]">{d.name}</div>
                            <div className="text-[10px] text-gray-400 font-medium">{d.recipients.length} recipients</div>
                          </td>
                          <td className="px-6 py-4 text-center text-gray-500 font-bold">{d.template?.name}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-black uppercase text-[10px]">{d.frequency}</span>
                          </td>
                          <td className="px-6 py-4 text-center flex items-center justify-center gap-1 mt-3">
                            {d.channels.map((chan: string) => (
                              <span key={chan} className="w-1.5 h-1.5 rounded-full bg-green-500" title={chan} />
                            ))}
                          </td>
                          <td className="px-6 py-4 text-center text-gray-400 italic">
                            {d.logs?.[0] ? new Date(d.logs[0].sent_at).toLocaleString() : 'Never'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className={`text-[10px] font-black uppercase ${d.active ? 'text-green-600' : 'text-gray-400'}`}>{d.active ? '● Active' : '○ Paused'}</div>
                          </td>
                        </tr>
                      ))}
                      {(!deliveryData?.deliveries || deliveryData.deliveries.length === 0) && (
                        <tr><td colSpan={6} className="p-12 text-center text-gray-400 font-bold italic">No delivery schedules configured</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-2xl mx-auto shadow-xl">
                 <div className="mb-8 flex justify-between items-center border-b border-gray-100 pb-4">
                  <h2 className="text-xl font-black text-[#0D2137]">Scheduler</h2>
                  <button onClick={() => setIsCreatingDelivery(false)} className="text-gray-400 hover:text-red-500 font-black uppercase text-xs tracking-widest">Cancel</button>
                </div>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                       <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Schedule Label</label>
                        <input 
                          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none font-bold text-gray-800"
                          placeholder="e.g. Daily Shift Report Email"
                          value={newDelivery.name}
                          onChange={(e) => setNewDelivery({...newDelivery, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Template</label>
                        <select 
                          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none font-bold text-gray-800"
                          value={newDelivery.template_id}
                          onChange={(e) => setNewDelivery({...newDelivery, template_id: e.target.value})}
                        >
                          <option value="">Select Template...</option>
                          {templateData?.templates?.map((t: any) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Frequency</label>
                        <select 
                           className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none font-bold text-gray-800"
                           value={newDelivery.frequency}
                           onChange={(e) => setNewDelivery({...newDelivery, frequency: e.target.value})}
                        >
                          <option>Daily</option>
                          <option>Shift Change</option>
                          <option>Weekly</option>
                          <option>On Demand</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1.5 ml-1">Recipient Emails (comma separated)</label>
                        <input 
                          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none font-bold text-gray-800"
                          placeholder="ceo@org.com, pmo@org.com"
                          value={newDelivery.recipients}
                          onChange={(e) => setNewDelivery({...newDelivery, recipients: e.target.value})}
                        />
                    </div>
                  </div>
                  <button onClick={handleSaveDelivery} className="w-full bg-[#0D2137] text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:scale-[1.01] transition-all shadow-lg shadow-blue-900/10">Activate Delivery Schedule</button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
