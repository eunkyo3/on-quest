import type { QuestStats } from '../types/quest';
import {
  STATS_FILTER_KEYS,
  STATS_FILTER_LABEL,
  countForFilter,
  type StatsFilterKey,
} from '../utils/statsFilter';

interface Props {
  stats: QuestStats | null;
  title?: string;
  activeFilter?: StatsFilterKey | null;
  onFilterClick?: (filter: StatsFilterKey) => void;
}

const STAT_COLORS: Partial<Record<StatsFilterKey, string>> = {
  completed: 'var(--success)',
  submitted: 'var(--info)',
  started: 'var(--warning)',
  pending: 'var(--text-muted)',
  rejected: 'var(--danger)',
};

export function ProgressDashboard({
  stats,
  title = '나의 퀘스트 달성률',
  activeFilter,
  onFilterClick,
}: Props) {
  const s = stats ?? {
    total: 0,
    pending: 0,
    started: 0,
    submitted: 0,
    completed: 0,
    rejected: 0,
    declined: 0,
    completionRate: 0,
  };

  const interactive = !!onFilterClick;

  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <div className="card">
        <div
          className="progress-bar"
          role="progressbar"
          aria-valuenow={s.completionRate}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="fill" style={{ width: `${s.completionRate}%` }} />
          <div className="label">{s.completionRate}%</div>
        </div>
        <div className="stat-grid" style={{ marginTop: '1rem' }}>
          {STATS_FILTER_KEYS.map((key) => (
            <Stat
              key={key}
              label={STATS_FILTER_LABEL[key]}
              value={countForFilter(s, key)}
              color={STAT_COLORS[key]}
              active={activeFilter === key}
              interactive={interactive}
              onClick={onFilterClick ? () => onFilterClick(key) : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  color,
  active,
  interactive,
  onClick,
}: {
  label: string;
  value: number;
  color?: string;
  active?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const className = `stat-card${interactive ? ' stat-card-btn' : ''}${active ? ' stat-card-active' : ''}`;

  if (interactive && onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        <div className="label">{label}</div>
        <div className="value" style={{ color }}>{value}</div>
      </button>
    );
  }

  return (
    <div className={className}>
      <div className="label">{label}</div>
      <div className="value" style={{ color }}>{value}</div>
    </div>
  );
}
