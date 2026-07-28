export type DemoTenant = {
  slug: string;
  name: string;
  industry: string;
  tenant_type: string;
  country: string;
  /** If null, create a project office site only (contractors) */
  site: { name: string; code: string } | null;
  emailDomain: string;
};

export const DEMO_TENANTS: DemoTenant[] = [
  {
    slug: 'iocl',
    name: 'Indian Oil Corporation Limited',
    industry: 'Oil & Gas',
    tenant_type: 'Refinery Owner',
    country: 'IN',
    site: { name: 'Panipat Refinery', code: 'PNP' },
    emailDomain: 'iocl.test',
  },
  {
    slug: 'hmel',
    name: 'HMEL',
    industry: 'Oil & Gas',
    tenant_type: 'Refinery Owner',
    country: 'IN',
    site: { name: 'Bathinda Refinery', code: 'BTH' },
    emailDomain: 'hmel.test',
  },
  {
    slug: 'lnteh',
    name: 'L&T Energy Hydrocarbon',
    industry: 'Contractor',
    tenant_type: 'Shutdown Contractor',
    country: 'IN',
    site: { name: 'LTEH Project Base — Panipat', code: 'LTEH-PNP' },
    emailDomain: 'lnteh.test',
  },
  {
    slug: 'technip',
    name: 'Technip Energies',
    industry: 'EPC',
    tenant_type: 'Engineering Contractor',
    country: 'IN',
    site: { name: 'Technip Energies India — Gurgaon', code: 'TEN-GGN' },
    emailDomain: 'technip.test',
  },
  {
    slug: 'ril',
    name: 'Reliance Industries',
    industry: 'Oil & Gas',
    tenant_type: 'Refinery Owner',
    country: 'IN',
    site: { name: 'Jamnagar Refinery', code: 'JAM' },
    emailDomain: 'ril.test',
  },
];

/** Roles seeded on every tenant (M5.4). */
export const TENANT_DEMO_ROLES: { slug: string; name: string; localPart: string }[] = [
  { slug: 'tenant_administrator', name: 'Tenant Administrator', localPart: 'admin' },
  { slug: 'lead_planner', name: 'Lead Planner', localPart: 'lead.planner' },
  { slug: 'planner', name: 'Planner', localPart: 'planner' },
  { slug: 'scheduler', name: 'Scheduler', localPart: 'scheduler' },
  { slug: 'project_manager', name: 'Project Manager', localPart: 'pm' },
  { slug: 'mechanical_engineer', name: 'Mechanical Engineer', localPart: 'mech.eng' },
  { slug: 'electrical_engineer', name: 'Electrical Engineer', localPart: 'elec.eng' },
  { slug: 'instrumentation_engineer', name: 'Instrumentation Engineer', localPart: 'inst.eng' },
  { slug: 'civil_engineer', name: 'Civil Engineer', localPart: 'civil.eng' },
  { slug: 'execution_engineer', name: 'Execution Engineer', localPart: 'exec.eng' },
  { slug: 'qa_qc_inspector', name: 'QA/QC Inspector', localPart: 'qaqc' },
  { slug: 'safety_officer', name: 'Safety Officer', localPart: 'safety' },
  { slug: 'material_coordinator', name: 'Material Coordinator', localPart: 'materials' },
  { slug: 'warehouse', name: 'Warehouse', localPart: 'warehouse' },
  { slug: 'document_controller', name: 'Document Controller', localPart: 'doc.control' },
  { slug: 'viewer', name: 'Viewer', localPart: 'viewer' },
];

export const PLATFORM_DEMO_USERS = [
  { email: 'info@syority.com', name: 'Platform Super Admin', slug: 'platform_super_admin', position: 'Platform Super Admin' },
  { email: 'platform-pm@syority.test', name: 'Platform Product Manager', slug: 'platform_product_manager', position: 'Product Manager' },
  { email: 'platform-scheduler@syority.test', name: 'Platform Master Scheduler', slug: 'platform_master_scheduler', position: 'Master Scheduler' },
  { email: 'platform-support@syority.test', name: 'Platform Support', slug: 'platform_support', position: 'Support Engineer' },
  { email: 'platform-finance@syority.test', name: 'Platform Finance', slug: 'platform_finance', position: 'Finance Controller' },
];
