import { useEffect, useMemo, useState } from 'react';
import { questApi } from '../api/questApi';
import { BulkCreateQuests } from '../components/BulkCreateQuests';
import { CreateQuestForm } from '../components/CreateQuestForm';
import { Modal } from '../components/Modal';
import { Pager } from '../components/Pager';
import { ProgressDashboard } from '../components/ProgressDashboard';
import { QuestList } from '../components/QuestList';
import { StatsQuestListSection } from '../components/StatsQuestListSection';
import { useQuestStore } from '../store/questStore';
import {
  QuestStatus,
  QUEST_STATUS_LABEL,
  type AssigneeQuestStats,
  type Quest,
} from '../types/quest';
import {
  STATS_FILTER_LABEL,
  assigneeStatsToQuestStats,
  type StatsFilterKey,
} from '../utils/statsFilter';

type Tab = 'work' | 'stats';

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('work');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [statsModalFilter, setStatsModalFilter] = useState<StatsFilterKey | null>(null);
  const [assigneeModal, setAssigneeModal] = useState<AssigneeQuestStats | null>(null);
  const [assigneeModalFilter, setAssigneeModalFilter] = useState<StatsFilterKey | null>(null);
  const {
    quests,
    page,
    totalPages,
    total,
    stats,
    assigneeStats,
    loading,
    error,
    fetchQuests,
    fetchStats,
    fetchAssigneeStats,
  } = useQuestStore();

  // 검토 대기는 현재 페이지에 한정되지 않도록 전 페이지에서 별도 조회한다.
  const [reviewQueue, setReviewQueue] = useState<Quest[]>([]);

  useEffect(() => {
    void fetchStats();
    void fetchAssigneeStats();
  }, [fetchStats, fetchAssigneeStats]);

  useEffect(() => {
    const status =
      statusFilter === '' ? undefined : (Number(statusFilter) as QuestStatus);
    void fetchQuests({ page: 1, status, search: search || undefined });
  }, [statusFilter, search, fetchQuests]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const status =
        statusFilter === '' ? undefined : (Number(statusFilter) as QuestStatus);
      await questApi.exportCsv({ status, search: search || undefined });
    } catch {
      /* axios interceptor toast 처리 외 침묵 */
    } finally {
      setExporting(false);
    }
  };

  // stats 가 갱신될 때마다(=발행·검토·제출 등 변동 시) 검토 대기 목록을 다시 가져온다.
  useEffect(() => {
    let cancelled = false;
    void questApi
      .list({ page: 1, limit: 100, status: QuestStatus.SUBMITTED })
      .then((res) => {
        if (!cancelled) setReviewQueue(res.items);
      })
      .catch(() => {
        if (!cancelled) setReviewQueue([]);
      });
    return () => {
      cancelled = true;
    };
  }, [stats]);

  const others = useMemo(
    () => quests.filter((q) => q.status !== QuestStatus.SUBMITTED),
    [quests],
  );

  const openCompanyStats = (key: StatsFilterKey) => {
    setStatsModalFilter(key);
  };

  const openAssigneeDetail = (row: AssigneeQuestStats) => {
    setAssigneeModal(row);
    setAssigneeModalFilter(null);
  };

  return (
    <div className="grid" style={{ gap: '1.5rem' }}>
      <section className="card role-banner role-banner-admin">
        <div>
          <h2 style={{ margin: 0 }}>관리자 워크스페이스</h2>
          <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
            퀘스트를 발행하고 제출된 증빙을 검토합니다.
          </p>
        </div>
      </section>

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
          <ProgressDashboard
            stats={stats}
            title="전사 발행 퀘스트 현황"
            onFilterClick={openCompanyStats}
          />
          <section>
            <h2 className="section-title">담당자별 상세 통계</h2>
            {assigneeStats.length === 0 ? (
              <div className="card text-muted">집계할 배정 이력이 없습니다.</div>
            ) : (
              <div className="card table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">이름</th>
                      <th scope="col">Slack ID</th>
                      <th scope="col">전체</th>
                      <th scope="col">완료</th>
                      <th scope="col">검토 대기</th>
                      <th scope="col">착수</th>
                      <th scope="col">대기</th>
                      <th scope="col">반려</th>
                      <th scope="col">거부</th>
                      <th scope="col">달성률</th>
                      <th scope="col" aria-label="상세" />
                    </tr>
                  </thead>
                  <tbody>
                    {assigneeStats.map((row) => (
                      <tr key={row.assigneeId}>
                        <td>{row.assigneeName ?? '—'}</td>
                        <td className="mono">{row.assigneeId}</td>
                        <td>{row.total}</td>
                        <td>{row.completed}</td>
                        <td>{row.submitted}</td>
                        <td>{row.started}</td>
                        <td>{row.pending}</td>
                        <td>{row.rejected}</td>
                        <td>{row.declined}</td>
                        <td>{row.completionRate}%</td>
                        <td>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => openAssigneeDetail(row)}
                          >
                            상세
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="grid" style={{ gap: '1.25rem' }}>
          <div>
            <button
              type="button"
              className="collapsible-head"
              aria-expanded={showCreate}
              onClick={() => setShowCreate((v) => !v)}
            >
              <span>새 퀘스트 발행</span>
              <span className="chevron">{showCreate ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>
            {showCreate && (
              <div style={{ marginTop: '0.75rem' }}>
                <CreateQuestForm />
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              className="collapsible-head"
              aria-expanded={showBulk}
              onClick={() => setShowBulk((v) => !v)}
            >
              <span>CSV 일괄 발행</span>
              <span className="chevron">{showBulk ? '▲ 접기' : '▼ 펼치기'}</span>
            </button>
            {showBulk && (
              <div style={{ marginTop: '0.75rem' }}>
                <BulkCreateQuests />
              </div>
            )}
          </div>

          <section>
            <h2 className="section-title" style={{ marginTop: 0 }}>
              검토 대기 ({reviewQueue.length}건)
            </h2>
            {error && <div className="alert-error">{error}</div>}
            <QuestList
              quests={reviewQueue}
              mode="admin"
              detailBasePath="/admin/quests"
              emptyText="검토할 증빙 자료가 없습니다."
            />
          </section>

          <section>
            <h2 className="section-title">전체 퀘스트</h2>
            <p className="text-muted" style={{ margin: '0 0 0.5rem', fontSize: '0.82rem' }}>
              검토 대기 건은 위 “검토 대기” 섹션에서 확인하세요.
            </p>
            <section className="card toolbar" style={{ marginBottom: '0.85rem' }}>
              <div className="toolbar-field">
                <label htmlFor="status-filter">상태 필터</label>
                <select
                  id="status-filter"
                  className="select-inline"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">전체</option>
                  {(Object.values(QuestStatus).filter(
                    (v) => typeof v === 'number' && v !== QuestStatus.SUBMITTED,
                  ) as QuestStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {QUEST_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="toolbar-field">
                <label htmlFor="quest-search">검색 (제목·Slack ID)</label>
                <div className="search-row">
                  <input
                    id="quest-search"
                    className="select-inline"
                    value={searchInput}
                    placeholder="검색어 입력 후 Enter"
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSearch(searchInput.trim());
                    }}
                  />
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setSearch(searchInput.trim())}
                  >
                    검색
                  </button>
                  {search && (
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setSearchInput('');
                        setSearch('');
                      }}
                    >
                      해제
                    </button>
                  )}
                </div>
              </div>
              <div className="toolbar-meta">
                <span className="count">총 {total}건</span>
                <button
                  type="button"
                  className="ghost"
                  disabled={exporting}
                  onClick={() => void handleExport()}
                >
                  {exporting ? '내보내는 중…' : '엑셀(CSV) 내보내기'}
                </button>
                <Pager
                  page={page}
                  totalPages={totalPages}
                  loading={loading}
                  onPage={(p) => void fetchQuests({ page: p })}
                />
              </div>
            </section>
            <QuestList
              quests={others}
              mode="admin"
              detailBasePath="/admin/quests"
              emptyText="등록된 퀘스트가 없습니다."
            />
            {totalPages > 1 && (
              <div className="pager-bottom">
                <Pager
                  page={page}
                  totalPages={totalPages}
                  loading={loading}
                  onPage={(p) => void fetchQuests({ page: p })}
                />
              </div>
            )}
          </section>
        </div>
      )}

      <Modal
        open={statsModalFilter !== null}
        title={
          statsModalFilter
            ? `전사 · ${STATS_FILTER_LABEL[statsModalFilter]}`
            : '퀘스트 목록'
        }
        onClose={() => setStatsModalFilter(null)}
        wide
      >
        {statsModalFilter && (
          <StatsQuestListSection
            filter={statsModalFilter}
            mode="admin"
            detailBasePath="/admin/quests"
          />
        )}
      </Modal>

      <Modal
        open={assigneeModal !== null}
        title={
          assigneeModal
            ? `${assigneeModal.assigneeName ?? assigneeModal.assigneeId} · 상세 통계`
            : '담당자 상세'
        }
        onClose={() => {
          setAssigneeModal(null);
          setAssigneeModalFilter(null);
        }}
        wide
      >
        {assigneeModal && (
          <div className="grid" style={{ gap: '1rem' }}>
            <ProgressDashboard
              stats={assigneeStatsToQuestStats(assigneeModal)}
              title={`${assigneeModal.assigneeName ?? '담당자'} 퀘스트 현황`}
              activeFilter={assigneeModalFilter}
              onFilterClick={(key) => setAssigneeModalFilter(key)}
            />
            {assigneeModalFilter && (
              <StatsQuestListSection
                filter={assigneeModalFilter}
                assigneeId={assigneeModal.assigneeId}
                mode="admin"
                detailBasePath="/admin/quests"
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
