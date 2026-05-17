import type { QuestStats } from '../types/quest';

interface Props {
  stats: QuestStats | null;
  /** 기본: 나의 퀘스트 달성률 */
  title?: string;
}

export function ProgressDashboard({ stats, title = '📊 나의 퀘스트 달성률' }: Props) {
  const s = stats ?? {
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    rejected: 0,
    completionRate: 0,
  };

  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <div className="card">
        <div className="progress-bar" role="progressbar" aria-valuenow={s.completionRate} aria-valuemin={0} aria-valuemax={100}>
          <div className="fill" style={{ width: `${s.completionRate}%` }} />
          <div className="label">{s.completionRate}%</div>
        </div>
        <div className="stat-grid" style={{ marginTop: '1rem' }}>
          <Stat label="전체" value={s.total} />
          <Stat label="완료" value={s.completed} color="var(--success)" />
          <Stat label="검토 대기" value={s.inProgress} color="var(--info)" />
          <Stat label="대기" value={s.pending} color="var(--text-muted)" />
          <Stat label="반려" value={s.rejected} color="var(--danger)" />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value" style={{ color }}>{value}</div>
    </div>
  );
}
