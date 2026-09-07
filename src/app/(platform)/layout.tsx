import { Shell } from '@/components/super-admin/shell';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return <Shell>{children}</Shell>;
}
