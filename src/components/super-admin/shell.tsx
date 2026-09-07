'use client';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { PlatformSidebar } from '@/components/layout/platform-sidebar';
import { PlatformTopbar } from '@/components/layout/platform-topbar';

/** The shell coordinates mobile navigation only; page data and authorization stay server-side. */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <PlatformSidebar pathname={pathname} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div className="main-shell">
        <PlatformTopbar
          pathname={pathname}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen(!menuOpen)}
        />
        <main id="main">{children}</main>
        <footer className="app-footer">
          <span>BusinessCare · Built for independent businesses</span>
          <span>Onboarding / Stage 02</span>
        </footer>
      </div>
    </div>
  );
}
