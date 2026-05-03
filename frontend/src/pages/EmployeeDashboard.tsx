import { useEffect } from 'react';
import { ProgressDashboard } from '../components/ProgressDashboard';
import { QuestList } from '../components/QuestList';
import { useQuestStore } from '../store/questStore';

export default function EmployeeDashboard() {
  const { quests, stats, loading, error, fetchQuests, fetchStats } = useQuestStore();

  useEffect(() => {
    void fetchQuests();
    void fetchStats();
  }, [fetchQuests, fetchStats]);

  return (
    <div>
      <ProgressDashboard stats={stats} />

      <h2 className="section-title" style={{ marginTop: '1.5rem' }}>🗂 내 퀘스트</h2>
      {error && <div className="feedback">⚠ {error}</div>}
      {loading ? (
        <div className="empty">불러오는 중…</div>
      ) : (
        <QuestList
          quests={quests}
          mode="employee"
          emptyText="아직 배정된 퀘스트가 없어요. 관리자에게 요청해보세요!"
        />
      )}
    </div>
  );
}
