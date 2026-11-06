const PENALTY_START_EXCLUSIVE = Date.parse('2026-11-04T23:59:59.999-03:00');
const PENALTY_END_INCLUSIVE = Date.parse('2026-11-10T23:59:59.999-03:00');

export interface PblWrittenPenalty {
  original: number;
  written: number;
  penaltyPercent: number;
}

export function calculatePblWrittenPenalty(
  original: number,
  isPbl1: boolean,
  submittedAt?: string | Date | null
): PblWrittenPenalty {
  const timestamp = submittedAt ? new Date(submittedAt).getTime() : Number.NaN;
  const applies = isPbl1 && timestamp > PENALTY_START_EXCLUSIVE && timestamp <= PENALTY_END_INCLUSIVE;
  return {
    original,
    written: applies ? original * 0.8 : original,
    penaltyPercent: applies ? 20 : 0
  };
}
