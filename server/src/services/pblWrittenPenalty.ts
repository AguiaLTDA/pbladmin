const PENALTY_START_EXCLUSIVE = Date.parse('2026-11-04T23:59:59.999-03:00');
const PENALTY_END_INCLUSIVE = Date.parse('2026-11-15T23:59:59.999-03:00');
export const PBL_WRITTEN_RESUBMISSION_END = PENALTY_END_INCLUSIVE;

export interface PblWrittenPenalty {
  original: number;
  written: number;
  penaltyPercent: number;
}

export function canResubmitEarlyPblWrittenSubmission(
  firstSubmittedAt?: string | Date | null,
  now: string | Date = new Date()
): boolean {
  const first = firstSubmittedAt ? new Date(firstSubmittedAt).getTime() : Number.NaN;
  const current = new Date(now).getTime();
  return first <= PENALTY_START_EXCLUSIVE && first <= current && current <= PENALTY_END_INCLUSIVE;
}

export function calculatePblWrittenPenalty(
  original: number,
  isPbl1: boolean,
  submittedAt?: string | Date | null,
  firstSubmittedAt?: string | Date | null
): PblWrittenPenalty {
  const timestamp = submittedAt ? new Date(submittedAt).getTime() : Number.NaN;
  const exemptResubmission = isPbl1 && canResubmitEarlyPblWrittenSubmission(firstSubmittedAt, submittedAt || new Date(NaN));
  const applies = isPbl1 && !exemptResubmission && timestamp > PENALTY_START_EXCLUSIVE && timestamp <= PENALTY_END_INCLUSIVE;
  return {
    original,
    written: applies ? original * 0.8 : original,
    penaltyPercent: applies ? 20 : 0
  };
}
