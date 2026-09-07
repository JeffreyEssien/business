import { workspaceTitle } from './navigation';
export function PlatformTopbar({
  pathname,
  menuOpen,
  onToggleMenu,
}: {
  pathname: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <button
          className="mobile-menu"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          aria-controls="platform-navigation"
          onClick={onToggleMenu}
        >
          ☰
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
