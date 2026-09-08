import { WorkspaceNavigation } from '@/components/catalog/workspace-navigation';
import { NavigationManager } from '@/components/content/navigation-manager';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { getNavigationWorkspace } from '@/modules/content/queries';

export const metadata = { title: 'Store menus' };

export default async function StoreMenusPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getNavigationWorkspace(slug);
  return (
    <main className="tenant-home">
      <WorkspaceNavigation name={data.workspace.tenant.name} slug={slug} />
      <PageHeader
        eyebrow="HELP CUSTOMERS MOVE AROUND"
        title="Store menus"
        description="Choose the links customers see at the top and bottom of your storefront. Store pages and product collections stay connected when their web addresses change."
      />
      <Panel
        title="Menu links"
        description="Arrange up to eight links. Saving keeps them private until you publish from Store design."
      >
        <NavigationManager
          slug={slug}
          initialItems={data.navigation}
          pages={data.pages}
          categories={data.categories}
        />
      </Panel>
    </main>
  );
}
