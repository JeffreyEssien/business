import { ButtonLink } from '@/components/ui/button';
export function LaunchCard() {
  return (
    <aside className="panel launch-panel">
      <div className="launch-art" aria-hidden="true">
        <div className="orbit" />
        <div className="orbit orbit-two" />
        <span className="art-tile tile-one">▦</span>
        <span className="art-tile tile-two">✦</span>
        <span className="art-tile tile-three">↗</span>
      </div>
      <span className="eyebrow">FROM SETUP TO STOREFRONT</span>
      <h2>Every great store starts here.</h2>
      <p>Create the business, share its owner invitation, and follow the onboarding checklist.</p>
      <ButtonLink variant="secondary" href="/setup">
        Explore the roadmap →
      </ButtonLink>
    </aside>
  );
}
