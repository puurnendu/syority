export const MATERIAL_DISCIPLINES = [
  {
    key: 'mechanical',
    label: 'Mechanical',
    sectionCode: 'J-1',
    icon: '🔩',
    color: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800', header: 'bg-blue-700' },
    description: 'Gaskets, fasteners, flanges, pipes, valves, pump parts',
  },
  {
    key: 'electrical',
    label: 'Electrical',
    sectionCode: 'J-2',
    icon: '⚡',
    color: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', header: 'bg-yellow-600' },
    description: 'Cables, switches, extension boards, flood lights, grinding machines',
  },
  {
    key: 'instrumentation',
    label: 'Instrumentation',
    sectionCode: 'J-3',
    icon: '📡',
    color: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800', header: 'bg-purple-700' },
    description: 'Instruments, transmitters, sensors, control valves, gauges',
  },
  {
    key: 'consumable',
    label: 'Consumables',
    sectionCode: 'J-4',
    icon: '🧴',
    color: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800', header: 'bg-green-700' },
    description: 'Cleaning agents, lubricants, sealants, rags, PPE consumables',
  },
  {
    key: 'scaffolding',
    label: 'Scaffolding',
    sectionCode: 'J-5',
    icon: '🏗️',
    color: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800', header: 'bg-orange-600' },
    description: 'Scaffolding tubes, couplers, boards, safety nets',
  },
  {
    key: 'insulation',
    label: 'Insulation',
    sectionCode: 'J-6',
    icon: '🌡️',
    color: { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', header: 'bg-red-700' },
    description: 'Mineral wool, calcium silicate, jacketing, cladding',
  },
  {
    key: 'painting',
    label: 'Painting & Coating',
    sectionCode: 'J-7',
    icon: '🎨',
    color: { bg: 'bg-pink-50', border: 'border-pink-200', badge: 'bg-pink-100 text-pink-800', header: 'bg-pink-700' },
    description: 'Primers, topcoats, thinners, surface prep materials',
  },
  {
    key: 'civil',
    label: 'Civil',
    sectionCode: 'J-8',
    icon: '🏛️',
    color: { bg: 'bg-stone-50', border: 'border-stone-200', badge: 'bg-stone-100 text-stone-800', header: 'bg-stone-700' },
    description: 'Cement, aggregates, steel reinforcement, grouting materials',
  },
] as const;

export type MaterialDiscipline = (typeof MATERIAL_DISCIPLINES)[number]['key'];

export const DISCIPLINE_MAP: Record<MaterialDiscipline, (typeof MATERIAL_DISCIPLINES)[number]> =
  Object.fromEntries(MATERIAL_DISCIPLINES.map((d) => [d.key, d])) as Record<
    MaterialDiscipline,
    (typeof MATERIAL_DISCIPLINES)[number]
  >;

export const DISCIPLINE_KEYS_FOR_AI = MATERIAL_DISCIPLINES.map((d) => d.key).join(' | ');
