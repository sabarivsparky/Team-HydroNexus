// ─── Settings Page ─────────────────────────────────────────
import { useState } from 'react';
import { Save, User, Bell, Monitor } from 'lucide-react';
import type { AppSettings } from '../data/types';

const DEFAULT_SETTINGS: AppSettings = {
  adminProfile: {
    name: 'Admin',
    email: 'admin@h2smonitor.com',
    role: 'System Administrator',
  },
  notifications: {
    dangerAlerts:       true,
    missedScanAlerts:   true,
    shiftSummary:       true,
    dailyReport:        false,
    emailNotifications: true,
  },
  dashboard: {
    autoRefreshInterval: 30,
    theme:               'dark',
    defaultPage:         '/dashboard',
    showCumulativeOnCards: true,
  },
};

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc: string;
}

function ToggleSetting({ id, checked, onChange, label, desc }: ToggleProps) {
  return (
    <div className="setting-row">
      <div className="setting-row-info">
        <div className="setting-row-label">{label}</div>
        <div className="setting-row-desc">{desc}</div>
      </div>
      <label className="toggle-switch" htmlFor={id} aria-label={label}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
        />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  const updateProfile = (key: keyof AppSettings['adminProfile'], val: string) =>
    setSettings(s => ({ ...s, adminProfile: { ...s.adminProfile, [key]: val } }));

  const updateNotif = (key: keyof AppSettings['notifications'], val: boolean) =>
    setSettings(s => ({ ...s, notifications: { ...s.notifications, [key]: val } }));

  const updateDash = <K extends keyof AppSettings['dashboard']>(key: K, val: AppSettings['dashboard'][K]) =>
    setSettings(s => ({ ...s, dashboard: { ...s.dashboard, [key]: val } }));

  const handleSave = () => {
    // In future: POST settings to backend
    sessionStorage.setItem('h2s_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your admin dashboard preferences and profile.</p>
        </div>
        <button
          id="settings-save-btn"
          className="btn btn-primary"
          onClick={handleSave}
          aria-label="Save settings"
        >
          <Save size={16} />
          {saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="settings-grid">
        {/* Admin Profile */}
        <div className="card">
          <div className="settings-section-title">
            <User size={12} style={{ display: 'inline', marginRight: 4 }} />
            Admin Profile
          </div>

          <div className="form-group">
            <label htmlFor="settings-admin-name" className="form-label">Full Name</label>
            <input
              id="settings-admin-name"
              type="text"
              className="form-input"
              style={{ paddingLeft: '0.75rem' }}
              value={settings.adminProfile.name}
              onChange={e => updateProfile('name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="settings-admin-email" className="form-label">Email Address</label>
            <input
              id="settings-admin-email"
              type="email"
              className="form-input"
              style={{ paddingLeft: '0.75rem' }}
              value={settings.adminProfile.email}
              onChange={e => updateProfile('email', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="settings-admin-role" className="form-label">Role</label>
            <input
              id="settings-admin-role"
              type="text"
              className="form-input"
              value={settings.adminProfile.role}
              readOnly
              style={{ paddingLeft: '0.75rem', opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="card">
          <div className="settings-section-title">
            <Bell size={12} style={{ display: 'inline', marginRight: 4 }} />
            Notification Preferences
          </div>

          <ToggleSetting
            id="notif-danger-alerts"
            checked={settings.notifications.dangerAlerts}
            onChange={v => updateNotif('dangerAlerts', v)}
            label="Danger Alerts"
            desc="Alert when cumulative exposure (M+L+E) exceeds 10 ppm"
          />
          <ToggleSetting
            id="notif-missed-scan"
            checked={settings.notifications.missedScanAlerts}
            onChange={v => updateNotif('missedScanAlerts', v)}
            label="Missed Scan Alerts"
            desc="Notify when a worker has not completed a scheduled scan"
          />
          <ToggleSetting
            id="notif-shift-summary"
            checked={settings.notifications.shiftSummary}
            onChange={v => updateNotif('shiftSummary', v)}
            label="Shift Summary"
            desc="Receive end-of-shift 3-scan exposure summary"
          />
          <ToggleSetting
            id="notif-daily-report"
            checked={settings.notifications.dailyReport}
            onChange={v => updateNotif('dailyReport', v)}
            label="Daily Report"
            desc="Automated daily exposure report at midnight"
          />
          <ToggleSetting
            id="notif-email"
            checked={settings.notifications.emailNotifications}
            onChange={v => updateNotif('emailNotifications', v)}
            label="Email Notifications"
            desc="Receive alerts via email in addition to dashboard"
          />
        </div>

        {/* Dashboard Preferences */}
        <div className="card">
          <div className="settings-section-title">
            <Monitor size={12} style={{ display: 'inline', marginRight: 4 }} />
            Dashboard Preferences
          </div>

          <div className="setting-row">
            <div className="setting-row-info">
              <div className="setting-row-label">Auto-Refresh Interval</div>
              <div className="setting-row-desc">How often to refresh data (0 = disabled)</div>
            </div>
            <select
              id="settings-refresh-interval"
              className="filter-select"
              value={settings.dashboard.autoRefreshInterval}
              onChange={e => updateDash('autoRefreshInterval', Number(e.target.value))}
              aria-label="Auto refresh interval"
            >
              <option value={0}>Disabled</option>
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-row-info">
              <div className="setting-row-label">Default Landing Page</div>
              <div className="setting-row-desc">Page shown after login</div>
            </div>
            <select
              id="settings-default-page"
              className="filter-select"
              value={settings.dashboard.defaultPage}
              onChange={e => updateDash('defaultPage', e.target.value)}
              aria-label="Default landing page"
            >
              <option value="/dashboard">Dashboard</option>
              <option value="/workers">Workers</option>
              <option value="/exposure">Exposure Monitoring</option>
              <option value="/danger">Danger Workers</option>
            </select>
          </div>

          <ToggleSetting
            id="settings-show-cumulative"
            checked={settings.dashboard.showCumulativeOnCards}
            onChange={v => updateDash('showCumulativeOnCards', v)}
            label="Show Cumulative on Cards"
            desc="Display cumulative exposure in summary stat cards"
          />
        </div>

        {/* About / System Info */}
        <div className="card">
          <div className="settings-section-title">System Information</div>
          {[
            { label: 'System',        value: 'H₂S Worker Safety Monitoring' },
            { label: 'Version',       value: '1.0.0 (Admin Dashboard)' },
            { label: 'Scan Model',    value: '3 scans/day — Morning · Lunch · Evening' },
            { label: 'Mode',          value: 'Demo / Mock Data' },
            { label: 'Threshold',     value: '10 ppm cumulative (M + L + E)' },
            { label: 'Data Source',   value: 'Mock (ML pipeline integration pending)' },
            { label: 'Build Date',    value: '2026-09-12' },
          ].map(({ label, value }) => (
            <div className="detail-info-row" key={label}>
              <span className="detail-info-key">{label}</span>
              <span className="detail-info-value" style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textAlign: 'right', maxWidth: '55%', wordBreak: 'break-word' }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
