import Link from 'next/link';
import { SignOutForm } from '@/components/auth/sign-out-form';
import { platformNavigation, isNavigationActive } from './navigation';
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
      <div className="workspace">
        <span className="workspace-icon">B</span>
        <div>
          <strong>Platform workspace</strong>
          <small>Super admin</small>
        </div>
      </div>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation">
        {platformNavigation.map((item) => {
          const active = isNavigationActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`nav-link ${active ? 'active' : ''}`}
              onClick={onNavigate}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="nav-label upcoming-label">COMING NEXT</p>
      {['Subscriptions', 'Domains', 'Communications'].map((label) => (
        <div className="future-link" key={label}>
          <span className="future-dot" />
          {label}
          <span className="soon">Soon</span>
        </div>
      ))}
      <div className="sidebar-bottom">
        <div className="build-card">
          <strong>Your platform starts here.</strong>
          <p>A shared foundation for every business you bring online.</p>
          <Link href="/setup" onClick={onNavigate}>
            View launch checklist ↗
          </Link>
        </div>
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
