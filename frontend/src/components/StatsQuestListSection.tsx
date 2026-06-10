import { useEffect, useState } from 'react';
import { questApi } from '../api/questApi';
import { QuestList } from './QuestList';
import {
  STATS_FILTER_LABEL,
  STATS_FILTER_TO_STATUS,
  type StatsFilterKey,
} from '../utils/statsFilter';
import type { Quest } from '../types/quest';

interface Props {
  filter: StatsFilterKey;
  assigneeId?: string;
  mode: 'employee' | 'admin';
  detailBasePath: string;
}

export function StatsQuestListSection({
  filter,
  assigneeId,
  mode,
  detailBasePath,
}: Props) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void questApi
      .list({
        page: 1,
        limit: 100,
        status: STATS_FILTER_TO_STATUS[filter],
        assigneeId,
      })
      .then((result) => {
        if (!cancelled) setQuests(result.items);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, assigneeId]);

  return (
    <section className="stats-quest-list">
      <h3 className="section-title" style={{ fontSize: '1rem' }}>
        {STATS_FILTER_LABEL[filter]} ({quests.length}건)
      </h3>
      {error && <div className="alert-error">{error}</div>}
      {loading ? (
        <div className="empty">불러오는 중…</div>
      ) : (
        <QuestList
          quests={quests}
          mode={mode}
          detailBasePath={detailBasePath}
          emptyText="해당 상태의 퀘스트가 없습니다."
        />
      )}
    </section>
  );
}
