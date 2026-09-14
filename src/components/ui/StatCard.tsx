// StatCard — dashboard summary card
import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  variant: 'total' | 'safe' | 'danger' | 'working' | 'exposure';
}

export default function StatCard({ label, value, sub, icon, variant }: Props) {
  return (
    <div className={`stat-card stat-card--${variant}`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}
