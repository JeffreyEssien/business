'use client';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlatformSidebar } from '@/components/layout/platform-sidebar';
import { PlatformTopbar } from '@/components/layout/platform-topbar';
import { SkipLink } from '@/components/ui/skip-link';
import { useMobileNavigation } from '@/components/layout/use-mobile-navigation';

/** The shell coordinates mobile navigation only; page data and authorization stay server-side. */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeNavigation = useCallback(() => setMenuOpen(false), []);
  useEffect(() => setMenuOpen(false), [pathname]);
  useMobileNavigation({
    open: menuOpen,
    onClose: closeNavigation,
    panelRef: navigationRef,
    triggerRef: menuTriggerRef,
  });
  return (
    <div className="app-shell">
      <SkipLink className="skip-link" href="#main" />
      <button
        className={`platform-backdrop ${menuOpen ? 'is-visible' : ''}`}
        type="button"
        aria-label="Close platform navigation"
        tabIndex={menuOpen ? 0 : -1}
        onClick={closeNavigation}
      />
      <PlatformSidebar
        navigationRef={navigationRef}
        pathname={pathname}
        open={menuOpen}
        onNavigate={closeNavigation}
      />
      <div className="main-shell">
        <PlatformTopbar
          pathname={pathname}
          menuOpen={menuOpen}
          menuTriggerRef={menuTriggerRef}
          onToggleMenu={() => setMenuOpen(!menuOpen)}
        />
        <main id="main">{children}</main>
        <footer className="app-footer">
          <span>BusinessCare · Secure platform workspace</span>
        </footer>
      </div>
    </div>
  );
}
