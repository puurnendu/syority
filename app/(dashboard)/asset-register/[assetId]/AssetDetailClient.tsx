'use client';

import React, { useState } from 'react';

export default function AssetDetailClient({ asset, lines, joints, drawings, procedures }: { asset: any, lines: any[], joints: any[], drawings: any[], procedures: any[] }) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex gap-4 border-b border-gray-200">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'nozzles', label: `Nozzles (${asset.nozzles.length})` },
          { id: 'lines', label: `Connected Lines (${lines.length})` },
          { id: 'joints', label: `Joints (${joints.length})` },
          { id: 'drawings', label: `Drawings (${drawings.length})` },
          { id: 'procedures', label: `Procedures (${procedures.length})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-bold text-gray-800 border-b border-gray-100 pb-2 mb-3">Asset Information</h2>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4 text-sm">
                <div><dt className="text-gray-400 text-xs font-semibold mb-1">Tag Number</dt><dd className="font-medium">{asset.tag_number}</dd></div>
                <div><dt className="text-gray-400 text-xs font-semibold mb-1">Name</dt><dd className="font-medium">{asset.name}</dd></div>
                <div><dt className="text-gray-400 text-xs font-semibold mb-1">Asset Type</dt><dd className="font-medium">{asset.asset_type || '—'}</dd></div>
                <div><dt className="text-gray-400 text-xs font-semibold mb-1">Criticality</dt><dd className="font-medium capitalize">{asset.criticality || '—'}</dd></div>
                <div><dt className="text-gray-400 text-xs font-semibold mb-1">Status</dt><dd className="font-medium capitalize">{asset.status || '—'}</dd></div>
                <div><dt className="text-gray-400 text-xs font-semibold mb-1">Data Source</dt><dd className="font-medium">{asset.data_source || 'manual'}</dd></div>
                <div><dt className="text-gray-400 text-xs font-semibold mb-1">Site</dt><dd className="font-medium">{asset.site?.name || '—'}</dd></div>
                <div><dt className="text-gray-400 text-xs font-semibold mb-1">Unit</dt><dd className="font-medium">{asset.system?.unit?.name || '—'}</dd></div>
                <div><dt className="text-gray-400 text-xs font-semibold mb-1">System</dt><dd className="font-medium">{asset.system?.name || '—'}</dd></div>
              </dl>
            </section>
          </div>
        )}

        {activeTab === 'nozzles' && (
          <div>
            <div className="flex justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-800">Nozzles</h2>
              <button className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100 font-medium">+ Add Nozzle</button>
            </div>
            {asset.nozzles.length === 0 ? <p className="text-sm text-gray-500 italic">No nozzles attached to this asset.</p> : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-3 py-2 font-medium rounded-l">Designation</th>
                    <th className="px-3 py-2 font-medium">Service</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Rating</th>
                    <th className="px-3 py-2 font-medium">Facing</th>
                    <th className="px-3 py-2 font-medium rounded-r">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {asset.nozzles.map((n: any) => (
                    <tr key={n.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-medium">{n.designation}</td>
                      <td className="px-3 py-2 text-gray-600">{n.service || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{n.nominal_size_inches ? `${n.nominal_size_inches}"` : '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{n.pressure_rating || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{n.flange_face || '—'}</td>
                      <td className="px-3 py-2">
                        <button className="text-blue-500 hover:underline mr-2 text-xs">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'lines' && (
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-3">Connected Lines</h2>
            {lines.length === 0 ? <p className="text-sm text-gray-500 italic">No piping lines connected to this asset.</p> : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-3 py-2 font-medium rounded-l">Line Number</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Spec</th>
                    <th className="px-3 py-2 font-medium">Direction</th>
                    <th className="px-3 py-2 font-medium rounded-r">Connected Nozzle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map((l: any) => {
                    const isFrom = l.from_asset_id === asset.id;
                    const noz = isFrom ? l.from_nozzle?.designation : l.to_nozzle?.designation;
                    return (
                      <tr key={l.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-medium text-blue-600">{l.line_number}</td>
                        <td className="px-3 py-2 text-gray-600">{l.nominal_size_inches ? `${l.nominal_size_inches}"` : '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{l.pipe_class || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${isFrom ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isFrom ? 'Origin' : 'Destination'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 font-mono text-xs">{noz || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'joints' && (
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-3">Joint Masters</h2>
            {joints.length === 0 ? <p className="text-sm text-gray-500 italic">No joints identified on this asset.</p> : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-3 py-2 font-medium rounded-l">Joint Number</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium">Rating</th>
                    <th className="px-3 py-2 font-medium">Nozzle</th>
                    <th className="px-3 py-2 font-medium rounded-r">Line</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {joints.map((j: any) => (
                    <tr key={j.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-medium">{j.joint_number}</td>
                      <td className="px-3 py-2 text-gray-600 capitalize">{j.joint_type}</td>
                      <td className="px-3 py-2 text-gray-600">{j.nominal_size_inches ? `${j.nominal_size_inches}"` : '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{j.pressure_rating || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{j.nozzle?.designation || '—'}</td>
                      <td className="px-3 py-2 text-blue-600">{j.line?.line_number || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'drawings' && (
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-3">System Drawings</h2>
            {drawings.length === 0 ? <p className="text-sm text-gray-500 italic">No drawings linked to this system.</p> : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-3 py-2 font-medium rounded-l">Drawing No</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium rounded-r">Revision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {drawings.map((d: any) => (
                    <tr key={d.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-medium text-blue-600">{d.drawing_no}</td>
                      <td className="px-3 py-2 text-gray-600">{d.title}</td>
                      <td className="px-3 py-2 text-gray-600">{d.revision}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'procedures' && (
          <div>
            <h2 className="text-sm font-bold text-gray-800 mb-3">System Procedures</h2>
            {procedures.length === 0 ? <p className="text-sm text-gray-500 italic">No procedures linked to this system.</p> : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs">
                  <tr>
                    <th className="px-3 py-2 font-medium rounded-l">Procedure No</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium rounded-r">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {procedures.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2 font-medium text-blue-600">{p.procedure_no}</td>
                      <td className="px-3 py-2 text-gray-600">{p.title}</td>
                      <td className="px-3 py-2 text-gray-600 capitalize">{p.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
