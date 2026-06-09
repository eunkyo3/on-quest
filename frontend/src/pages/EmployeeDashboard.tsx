import { useEffect, useState } from 'react';
import { ProgressDashboard } from '../components/ProgressDashboard';
import { QuestList } from '../components/QuestList';
import { StatsQuestListSection } from '../components/StatsQuestListSection';
import { useQuestStore } from '../store/questStore';
import { QuestStatus, QUEST_STATUS_LABEL } from '../types/quest';
import type { StatsFilterKey } from '../utils/statsFilter';

type Tab = 'quests' | 'stats';

export default function EmployeeDashboard() {
  const [tab, setTab] = useState<Tab>('quests');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [statsFilter, setStatsFilter] = useState<StatsFilterKey | null>(null);
  const { quests, page, totalPages, total, stats, loading, error, fetchQuests, fetchStats } =
    useQuestStore();

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const status =
      statusFilter === '' ? undefined : (Number(statusFilter) as QuestStatus);
    void fetchQuests({ page: 1, status });
  }, [statusFilter, fetchQuests]);

  return (
    <div>
      <section className="card role-banner role-banner-employee">
        <div>
          <h2 style={{ margin: 0 }}>내 온보딩 퀘스트</h2>
          <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
            배정된 퀘스트를 착수·제출하고, 수행이 어려운 퀘스트는 사유와 함께 거부할 수 있습니다.
          </p>
        </div>
      </section>

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
        <div className="grid" style={{ gap: '1.25rem', marginTop: '1rem' }}>
          <ProgressDashboard
            stats={stats}
            activeFilter={statsFilter}
            onFilterClick={(key) => setStatsFilter(key)}
          />
          {statsFilter && (
            <StatsQuestListSection
              filter={statsFilter}
              mode="employee"
              detailBasePath="/employee/quests"
            />
          )}
        </div>
      ) : (
        <>
          <section className="card filter-bar" style={{ marginTop: '1rem' }}>
            <label htmlFor="emp-status-filter">상태 필터</label>
            <select
              id="emp-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">전체</option>
              {(Object.values(QuestStatus).filter((v) => typeof v === 'number') as QuestStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {QUEST_STATUS_LABEL[s]}
                  </option>
                ),
              )}
            </select>
            <p className="text-muted" style={{ margin: '0.5rem 0 0' }}>
              총 {total}건 · {page}/{totalPages || 1} 페이지
            </p>
            <div className="quest-actions" style={{ marginTop: '0.5rem' }}>
              <button
                type="button"
                className="ghost"
                disabled={page <= 1 || loading}
                onClick={() => void fetchQuests({ page: page - 1 })}
              >
                이전
              </button>
              <button
                type="button"
                className="ghost"
                disabled={page >= totalPages || loading}
                onClick={() => void fetchQuests({ page: page + 1 })}
              >
                다음
              </button>
            </div>
          </section>

          {error && <div className="feedback">{error}</div>}
          {loading ? (
            <div className="empty">불러오는 중…</div>
          ) : (
            <QuestList
              quests={quests}
              mode="employee"
              detailBasePath="/employee/quests"
              emptyText="배정된 퀘스트가 없습니다."
            />
          )}
        </>
      )}
    </div>
  );
}
