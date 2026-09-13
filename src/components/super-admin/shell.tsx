'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PlatformSidebar } from '@/components/layout/platform-sidebar';
import { PlatformTopbar } from '@/components/layout/platform-topbar';

/** The shell coordinates mobile navigation only; page data and authorization stay server-side. */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <button
        className={`platform-backdrop ${menuOpen ? 'is-visible' : ''}`}
        type="button"
        aria-label="Close platform navigation"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />
      <PlatformSidebar pathname={pathname} open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      <div className="main-shell">
        <PlatformTopbar
          pathname={pathname}
          menuOpen={menuOpen}
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
