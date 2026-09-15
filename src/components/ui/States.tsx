// Shared loading / error / empty states for admin pages.
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function Loading({ label = 'Loading data…' }: { label?: string }) {
  return (
    <div className="empty-state">
      <Loader2 className="wk-spin" size={28} />
      <div className="empty-state-text" style={{ marginTop: 10 }}>{label}</div>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty-state">
      <AlertTriangle size={28} color="var(--color-danger)" />
      <div className="empty-state-text" style={{ marginTop: 10, color: 'var(--color-danger-text)' }}>
        {message}
      </div>
      {onRetry && (
        <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ label = 'Nothing to show yet.' }: { label?: string }) {
  return (
    <div className="empty-state">
      <Inbox size={28} />
      <div className="empty-state-text" style={{ marginTop: 10 }}>{label}</div>
    </div>
  );
}
