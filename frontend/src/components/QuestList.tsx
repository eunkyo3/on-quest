import type { Quest } from '../types/quest';
import { QuestItem } from './QuestItem';

interface Props {
  quests: Quest[];
  mode: 'employee' | 'admin';
  detailBasePath: string;
  emptyText?: string;
}

export function QuestList({
  quests,
  mode,
  detailBasePath,
  emptyText = '등록된 퀘스트가 없습니다.',
}: Props) {
  if (quests.length === 0) {
    return <div className="empty">{emptyText}</div>;
  }
  return (
    <div className="quest-list">
      {quests.map((q) => (
        <QuestItem key={q.id} quest={q} mode={mode} detailBasePath={detailBasePath} />
      ))}
    </div>
  );
}
