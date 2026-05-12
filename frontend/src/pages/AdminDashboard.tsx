import { useEffect, useMemo, useState } from 'react';
import { CreateQuestForm } from '../components/CreateQuestForm';
import { ProgressDashboard } from '../components/ProgressDashboard';
import { QuestList } from '../components/QuestList';
import { useQuestStore } from '../store/questStore';
import { QuestStatus } from '../types/quest';

type Tab = 'work' | 'stats';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('work');
  const {
    quests,
    stats,
    assigneeStats,
    loading,
    error,
    fetchQuests,
    fetchStats,
    fetchAssigneeStats,
  } = useQuestStore();

  useEffect(() => {
    void fetchQuests();
    void fetchStats();
    void fetchAssigneeStats();
  }, [fetchQuests, fetchStats, fetchAssigneeStats]);

  const pendingReview = useMemo(
    () =>
      quests.filter(
        (q) => Boolean(q.proofFileName?.trim()) && q.status !== QuestStatus.COMPLETED,
      ),
    [quests],
  );
  const others = useMemo(
    () => quests.filter((q) => !pendingReview.includes(q)),
    [quests, pendingReview],
  );

  return (
    <div className="grid" style={{ gap: '1.5rem' }}>
      <div className="tab-row" role="tablist" aria-label="관리자 메뉴">
        <button
          type="button"
          className={tab === 'work' ? '' : 'ghost'}
          role="tab"
          aria-selected={tab === 'work'}
          onClick={() => setTab('work')}
        >
          업무
        </button>
        <button
          type="button"
          className={tab === 'stats' ? '' : 'ghost'}
          role="tab"
          aria-selected={tab === 'stats'}
          onClick={() => setTab('stats')}
        >
          통계
        </button>
      </div>

      {tab === 'stats' ? (
        <div className="grid" style={{ gap: '1.5rem' }}>
          <ProgressDashboard stats={stats} title="📊 전사 발행 퀘스트 현황" />
          <section>
            <h2 className="section-title">👥 담당자별 상세 통계</h2>
            <p className="text-muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
              퀘스트를 한 번이라도 배정받은 사원만 표시됩니다.
            </p>
            {assigneeStats.length === 0 ? (
              <div className="card text-muted">집계할 배정 이력이 없습니다.</div>
            ) : (
              <div className="card table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>Slack ID</th>
                      <th>전체</th>
                      <th>완료</th>
                      <th>진행</th>
                      <th>대기</th>
                      <th>반려</th>
                      <th>달성률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assigneeStats.map((row) => (
                      <tr key={row.assigneeId}>
                        <td>{row.assigneeName ?? '—'}</td>
                        <td className="mono">{row.assigneeId}</td>
                        <td>{row.total}</td>
                        <td>{row.completed}</td>
                        <td>{row.inProgress}</td>
                        <td>{row.pending}</td>
                        <td>{row.rejected}</td>
                        <td>{row.completionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        <>
          <CreateQuestForm />

          <section>
            <h2 className="section-title">🧾 검토 대기</h2>
            {error && <div className="feedback">⚠ {error}</div>}
            {loading ? (
              <div className="empty">불러오는 중…</div>
            ) : (
              <QuestList
                quests={pendingReview}
                mode="admin"
                emptyText="검토할 증빙 자료가 없습니다."
              />
            )}
          </section>

          <section>
            <h2 className="section-title">📚 전체 퀘스트</h2>
            <QuestList quests={others} mode="admin" emptyText="등록된 퀘스트가 없습니다." />
          </section>
        </>
      )}
    </div>
  );
}
