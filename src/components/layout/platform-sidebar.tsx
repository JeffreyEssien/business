import Link from 'next/link';
import { SignOutForm } from '@/components/auth/sign-out-form';
import { platformNavigation, platformNavigationGroups, isNavigationActive } from './navigation';
export function PlatformSidebar({
  pathname,
  open,
  onNavigate,
}: {
  pathname: string;
  open: boolean;
  onNavigate: () => void;
}) {
  return (
    <aside id="platform-navigation" className={`sidebar ${open ? 'is-open' : ''}`}>
      <Link href="/" className="brand" onClick={onNavigate}>
        <span className="brand-mark">
          b<span>c</span>
        </span>
        BusinessCare<span className="brand-dot">.</span>
      </Link>
      <button
        className="sidebar-close"
        type="button"
        aria-label="Close navigation"
        onClick={onNavigate}
      >
        <span aria-hidden="true">×</span>
      </button>
      <div className="workspace">
        <span className="workspace-icon">B</span>
        <div>
          <strong>Platform workspace</strong>
          <small>Super admin</small>
        </div>
      </div>
      <nav aria-label="Main navigation">
        {platformNavigationGroups.map((group) => (
          <div className="platform-nav-group" key={group}>
            <p className="nav-label">{group}</p>
            {platformNavigation
              .filter((item) => item.group === group)
              .map((item) => {
                const active = isNavigationActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`nav-link ${active ? 'active' : ''}`}
                    onClick={onNavigate}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile">
          <span className="avatar">BC</span>
          <div>
            <strong>Platform owner</strong>
            <small>Authenticated workspace</small>
          </div>
        </div>
        <div className="sidebar-signout">
          <SignOutForm />
        </div>
      </div>
    </aside>
  );
}
