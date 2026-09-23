import { TenantShell } from '@/components/layout/tenant-shell';
import { getTenantWorkspace } from '@/modules/tenants/workspace-query';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workspace = await getTenantWorkspace(slug);
  const { data, error } = await workspace.supabase.rpc('get_tenant_entitlements', {
    target_tenant: workspace.tenant.id,
  });
  if (error) throw new Error('Business features could not be loaded.');
  return (
    <TenantShell slug={slug} entitlements={(data ?? {}) as Record<string, unknown>}>
      {children}
    </TenantShell>
  );
}
