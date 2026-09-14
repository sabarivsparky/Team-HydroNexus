// StatusBadge — reusable Safe/Danger indicator
import type { WorkerStatus } from '../../data/types';

interface Props {
  status: WorkerStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: Props) {
  const isSafe = status === 'SAFE';
  return (
    <span
      className={`status-badge ${isSafe ? 'status-badge--safe' : 'status-badge--danger'}`}
      style={size === 'sm' ? { fontSize: '0.65rem', padding: '2px 8px' } : {}}
    >
      <span className="status-badge-dot" />
      {status}
    </span>
  );
}
