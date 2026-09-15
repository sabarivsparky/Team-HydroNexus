// StatusBadge — reusable status pill
type Tone = 'safe' | 'danger' | 'warning' | 'info';

const TONE_CLASS: Record<Tone, string> = {
  safe: 'status-badge--safe',
  danger: 'status-badge--danger',
  warning: 'status-badge--warning',
  info: 'status-badge--info',
};

interface Props {
  tone?: Tone;
  children: React.ReactNode;
  small?: boolean;
}

export default function StatusBadge({ tone = 'safe', children, small }: Props) {
  return (
    <span
      className={`status-badge ${TONE_CLASS[tone]}`}
      style={small ? { fontSize: '0.65rem', padding: '2px 8px' } : undefined}
    >
      <span className="status-badge-dot" />
      {children}
    </span>
  );
}
