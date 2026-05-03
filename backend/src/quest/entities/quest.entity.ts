import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuestStatus } from '../enums/quest-status.enum';

/**
 * Quest (퀘스트) Entity
 * - 설계명세서 §클래스다이어그램 / §테이블정의서 기준
 * - 증빙자료(proofData)는 PostgreSQL bytea(BLOB) 로 저장한다.
 *   ※ select: false 옵션으로 일반 조회 시 본문을 로드하지 않아 성능 저하를 방지.
 */
@Entity({ name: 'quests' })
export class QuestEntity {
  /** 8자리 문자열 식별자 (설계명세서 §5) */
  @PrimaryColumn({ type: 'varchar', length: 8 })
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'timestamptz' })
  deadline!: Date;

  @Index()
  @Column({
    type: 'smallint',
    default: QuestStatus.PENDING,
    comment: '0:대기 / 1:진행중 / 2:완료 / 3:반려',
  })
  status!: QuestStatus;

  @Column({ type: 'text', nullable: true })
  feedback!: string | null;

  /** 증빙자료 — BLOB. 조회 성능을 위해 기본 SELECT 에서 제외 */
  @Column({ type: 'bytea', nullable: true, select: false })
  proofData!: Buffer | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  proofMimeType!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  proofFileName!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  assigneeId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  reviewerId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
