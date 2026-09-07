export type StatCardProps = {
  label: string;
  value: string | number;
  note: string;
  icon: string;
  tone: 'lavender' | 'mint' | 'peach' | 'blue';
};
export function StatCard({ label, value, note, icon, tone }: StatCardProps) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${tone}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <strong className="stat-value">{value}</strong>
      <p>{note}</p>
    </article>
  );
}
