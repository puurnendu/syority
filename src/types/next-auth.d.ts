import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    roles?: string[];
    role_ids?: string[];
    scope?: string;
    organization_id: string;
    organization_name?: string;
    /** @deprecated Derived from roles — not User.is_super_admin column */
    is_super_admin: boolean;
    /** @deprecated Derived from roles — not User.is_tenant_admin column */
    is_tenant_admin: boolean;
    site_id?: string;
    must_change_password: boolean;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      roles?: string[];
      role_ids?: string[];
      scope?: string;
      organization_id: string;
      organization_name?: string;
      is_super_admin: boolean;
      is_tenant_admin: boolean;
      site_id?: string;
      must_change_password: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    name?: string;
    email?: string;
    role: string;
    roles?: string[];
    role_ids?: string[];
    scope?: string;
    organization_id: string;
    organization_name?: string;
    is_super_admin: boolean;
    is_tenant_admin: boolean;
    site_id?: string;
    must_change_password: boolean;
  }
}
