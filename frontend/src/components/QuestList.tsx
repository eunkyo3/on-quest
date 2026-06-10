import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QUEST_STATUS_COLOR,
  QUEST_STATUS_LABEL,
  QuestStatus,
  type Quest,
} from '../types/quest';
import { formatDateTimeToMinute } from '../utils/formatDateTime';
import { QuestActions } from './QuestActions';

interface Props {
  quests: Quest[];
  mode: 'employee' | 'admin';
  detailBasePath: string;
  emptyText?: string;
}

function isOverdue(q: Quest): boolean {
  return (
    new Date(q.deadline).getTime() < Date.now() &&
    q.status !== QuestStatus.COMPLETED
  );
}

/**
 * 퀘스트 목록 — 가독성을 위해 카드 대신 테이블로 표시한다.
 * 행을 펼치면(인라인 확장) 그 자리에서 설명 확인과 역할별 작업(착수/제출/거부/검토)을 수행한다.
 */
export function QuestList({
  quests,
  mode,
  detailBasePath,
  emptyText = '등록된 퀘스트가 없습니다.',
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isAdmin = mode === 'admin';
  const colCount = isAdmin ? 6 : 5;

  if (quests.length === 0) {
    return <div className="empty">{emptyText}</div>;
  }

  return (
    <div className="card table-wrap">
      <table className="data-table quest-table">
        <thead>
          <tr>
            <th scope="col">제목</th>
            {isAdmin && <th scope="col">담당자</th>}
            <th scope="col">상태</th>
            <th scope="col">마감</th>
            <th scope="col">증빙</th>
            <th scope="col" aria-label="상세 펼치기" />
          </tr>
        </thead>
        <tbody>
          {quests.map((q) => {
            const expanded = expandedId === q.id;
            const overdue = isOverdue(q);
            return (
              <Fragment key={q.id}>
                <tr
                  className={expanded ? 'quest-row quest-row-expanded' : 'quest-row'}
                  onClick={() => setExpandedId(expanded ? null : q.id)}
                >
                  <td>
                    <Link
                      to={`${detailBasePath}/${q.id}`}
                      className="quest-row-title"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {q.title}
                    </Link>
                    <div className="meta mono" style={{ fontSize: '0.72rem' }}>
                      {q.id}
                    </div>
                  </td>
                  {isAdmin && (
                    <td>
                      <div>{q.assigneeName ?? '—'}</div>
                      <div className="meta mono" style={{ fontSize: '0.72rem' }}>
                        {q.assigneeId}
                      </div>
                    </td>
                  )}
                  <td>
                    <span
                      className="badge"
                      style={{ background: QUEST_STATUS_COLOR[q.status] }}
                    >
                      {QUEST_STATUS_LABEL[q.status]}
                    </span>
                  </td>
                  <td>
                    <span className={overdue ? 'overdue-text' : undefined}>
                      {formatDateTimeToMinute(q.deadline)}
                    </span>
                    {overdue && <div className="meta overdue-text">기한 경과</div>}
                  </td>
                  <td>{q.hasProof ? '있음' : '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="ghost"
                      aria-expanded={expanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(expanded ? null : q.id);
                      }}
                    >
                      {expanded ? '접기' : '펼치기'}
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr className="quest-row-detail">
                    <td colSpan={colCount}>
                      <div className="quest-row-detail-body">
                        <p className="quest-row-desc">{q.description}</p>
                        <QuestActions quest={q} mode={mode} />
                        <p
                          className="text-muted"
                          style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}
                        >
                          <Link to={`${detailBasePath}/${q.id}`}>상세 페이지 열기 →</Link>
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
