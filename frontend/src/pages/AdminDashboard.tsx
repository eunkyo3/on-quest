import { useEffect, useMemo } from 'react';
import { CreateQuestForm } from '../components/CreateQuestForm';
import { QuestList } from '../components/QuestList';
import { useQuestStore } from '../store/questStore';
import { QuestStatus } from '../types/quest';

export default function AdminDashboard() {
  const { quests, loading, error, fetchQuests, fetchStats } = useQuestStore();

  useEffect(() => {
    void fetchQuests();
    void fetchStats();
  }, [fetchQuests, fetchStats]);

  const pendingReview = useMemo(
    () => quests.filter((q) => q.hasProof && q.status !== QuestStatus.COMPLETED),
    [quests],
  );
  const others = useMemo(
    () => quests.filter((q) => !pendingReview.includes(q)),
    [quests, pendingReview],
  );

  return (
    <div className="grid" style={{ gap: '1.5rem' }}>
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
    </div>
  );
}
