'use client';
import { useState, useEffect } from 'react';

const DEFAULT_TYPES = [
  { name: 'Heat Exchanger', code: 'HX', description: 'Shell & tube, plate, air cooled' },
  { name: 'Pump', code: 'P', description: 'Centrifugal, reciprocating, gear' },
  { name: 'Vessel / Column', code: 'V', description: 'Pressure vessels, distillation columns' },
  { name: 'Compressor', code: 'K', description: 'Centrifugal and reciprocating' },
  { name: 'Valve', code: 'XV', description: 'Control valves, PSVs, isolation' },
  { name: 'Tank', code: 'TK', description: 'Storage and process tanks' },
  { name: 'Furnace / Heater', code: 'F', description: 'Fired heaters, process furnaces' },
  { name: 'Filter / Strainer', code: 'S', description: 'Basket strainers, cartridge filters' },
];

export default function EquipmentTypesPage() {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', code: '', description: '', defaultNozzleCount: '', defaultJointCount: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/equipment-types');
      const data = await res.json().catch(() => []);
      setTypes(Array.isArray(data) ? data : []);
    } catch {
      setTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? 'PATCH' : 'POST';
    const url = editingId ? `/api/admin/equipment-types/${editingId}` : '/api/admin/equipment-types';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    
    setFormData({ name: '', code: '', description: '', defaultNozzleCount: '', defaultJointCount: '' });
    setEditingId(null);
    fetchTypes();
  };

  const handleEdit = (type: any) => {
    setEditingId(type.id);
    setFormData({ 
      name: type.name, 
      code: type.code || '', 
      description: type.description || '',
      defaultNozzleCount: type.defaultNozzleCount ? String(type.defaultNozzleCount) : '',
      defaultJointCount: type.defaultJointCount ? String(type.defaultJointCount) : ''
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this equipment type?')) return;
    await fetch(`/api/admin/equipment-types/${id}`, { method: 'DELETE' });
    fetchTypes();
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipment Types</h1>
          <p className="text-gray-500 text-sm mt-0.5">Master list of equipment types used across all projects</p>
        </div>
        <div className="flex gap-2">
          {types.length === 0 && !loading && (
            <button
              onClick={async () => {
                for (const d of DEFAULT_TYPES) {
                  await fetch('/api/admin/equipment-types', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(d),
                  });
                }
                fetchTypes();
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-indigo-400 text-gray-600"
            >
              Seed defaults
            </button>
          )}
          <button
            onClick={() => { setEditingId(null); setFormData({ name: '', code: '', description: '', defaultNozzleCount: '', defaultJointCount: '' }); }}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            + Add Type
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Defaults</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400">Loading types...</td></tr>
                ) : types.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm">No equipment types yet. Click &quot;Seed defaults&quot; to add common types.</td></tr>
                ) : (
                  types.map((type) => (
                    <tr key={type.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{type.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 uppercase">{type.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {type.defaultNozzleCount ? `${type.defaultNozzleCount} Nozzles` : ''} 
                        {type.defaultNozzleCount && type.defaultJointCount && ', '} 
                        {type.defaultJointCount ? `${type.defaultJointCount} Joints` : ''}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{type.description || '—'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <button onClick={() => handleEdit(type)} className="text-blue-600 hover:text-blue-900 tabular-nums">Edit</button>
                        <button onClick={() => handleDelete(type.id)} className="text-red-400 hover:text-red-600">Delete</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {types.length === 0 && !loading && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>💡 Tip:</strong> Common types include: {DEFAULT_TYPES.map(t => t.name).join(', ')}.
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm sticky top-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editingId ? 'Edit Equipment Type' : 'Add New Type'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Heat Exchanger"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. HE"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Nozzles</label>
                  <input
                    type="number"
                    value={formData.defaultNozzleCount}
                    onChange={(e) => setFormData({ ...formData, defaultNozzleCount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. 4"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Joints</label>
                  <input
                    type="number"
                    value={formData.defaultJointCount}
                    onChange={(e) => setFormData({ ...formData, defaultJointCount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. 4"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Optional details..."
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-md font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {editingId ? 'Update Type' : 'Create Type'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setFormData({ name: '', code: '', description: '', defaultNozzleCount: '', defaultJointCount: '' }); }}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-md font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
