import { useEffect, useState } from 'react';
import { ProgressDashboard } from '../components/ProgressDashboard';
import { QuestList } from '../components/QuestList';
import { useQuestStore } from '../store/questStore';

type Tab = 'quests' | 'stats';

export default function EmployeeDashboard() {
  const [tab, setTab] = useState<Tab>('quests');
  const { quests, stats, loading, error, fetchQuests, fetchStats } = useQuestStore();

  useEffect(() => {
    void fetchQuests();
    void fetchStats();
  }, [fetchQuests, fetchStats]);

  return (
    <div>
      <div className="tab-row" role="tablist" aria-label="사원 메뉴">
        <button
          type="button"
          className={tab === 'quests' ? '' : 'ghost'}
          role="tab"
          aria-selected={tab === 'quests'}
          onClick={() => setTab('quests')}
        >
          내 퀘스트
        </button>
        <button
          type="button"
          className={tab === 'stats' ? '' : 'ghost'}
          role="tab"
          aria-selected={tab === 'stats'}
          onClick={() => setTab('stats')}
        >
          내 통계
        </button>
      </div>

      {tab === 'stats' ? (
        <ProgressDashboard stats={stats} title="📊 내 퀘스트 통계" />
      ) : (
        <>
          {error && <div className="feedback">⚠ {error}</div>}
          <h2 className="section-title" style={{ marginTop: 0 }}>🗂 배정된 퀘스트</h2>
          {loading ? (
            <div className="empty">불러오는 중…</div>
          ) : (
            <QuestList
              quests={quests}
              mode="employee"
              emptyText="아직 배정된 퀘스트가 없어요. 관리자에게 요청해보세요!"
            />
          )}
        </>
      )}
    </div>
  );
}
