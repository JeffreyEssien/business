'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePlatformAdmin } from '@/modules/auth/authorization';
import { libraryTemplate } from './template-library';

const PAGE = '/portfolio-templates';

/**
 * Super Admin offers or hides one portfolio template. The database re-checks the role,
 * refuses to hide the last template, and writes the audit entry.
 */
export async function setTemplateActive(templateKey: string, active: boolean) {
  if (!libraryTemplate(templateKey)) redirect(`${PAGE}?notice=unknown`);
  const { supabase } = await requirePlatformAdmin();
  const { error } = await supabase.rpc('set_site_template_active', {
    template_key: templateKey,
    active,
  });
  if (error?.message.includes('LAST_TEMPLATE')) redirect(`${PAGE}?notice=last`);
  if (error) redirect(`${PAGE}?notice=failed`);
  revalidatePath(PAGE);
  revalidatePath('/templates');
  redirect(`${PAGE}?notice=${active ? 'offered' : 'hidden'}`);
}
