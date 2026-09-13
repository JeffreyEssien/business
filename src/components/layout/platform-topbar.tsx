import { workspaceTitle } from './navigation';
import type { RefObject } from 'react';
export function PlatformTopbar({
  pathname,
  menuOpen,
  menuTriggerRef,
  onToggleMenu,
}: {
  pathname: string;
  menuOpen: boolean;
  menuTriggerRef: RefObject<HTMLButtonElement | null>;
  onToggleMenu: () => void;
}) {
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <button
          ref={menuTriggerRef}
          className="mobile-menu"
          type="button"
          aria-label="Open navigation"
          aria-expanded={menuOpen}
          aria-controls="platform-navigation"
          onClick={onToggleMenu}
        >
          <span aria-hidden="true">☰</span>
        </button>
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <strong>{workspaceTitle(pathname)}</strong>
      </div>
      <span className="preview-badge">
        <span />
        Development workspace
      </span>
    </header>
  );
}
