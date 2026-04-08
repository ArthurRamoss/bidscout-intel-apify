// =============================================================================
// Recompete Score Calculator
// Score 0-100: likelihood that a federal contract will be recompeted
//
// Formula breakdown:
//   Proximity (40 pts) — closer to expiration = higher score
//   Value     (30 pts) — larger contracts more likely to recompete
//   Duration  (30 pts) — longer contracts = more established = higher recompete
// =============================================================================

export interface ScoreInput {
  endDate: string;
  startDate: string;
  awardAmount: number;
}

/**
 * Calculate recompete probability score (0–100).
 */
export function calculateRecompeteScore(contract: ScoreInput): number {
  const now = new Date();
  const end = new Date(contract.endDate);
  const start = new Date(contract.startDate);

  const daysUntilExpiration = Math.max(
    0,
    (end.getTime() - now.getTime()) / 86_400_000
  );
  const totalDurationDays = Math.max(
    1,
    (end.getTime() - start.getTime()) / 86_400_000
  );

  // --- Proximity score (40 pts max) ---
  // 0 days left = 40pts, 365 days = ~20pts, 730+ days = 5pts
  const proximityScore = Math.max(5, 40 - (daysUntilExpiration / 365) * 20);

  // --- Value score (30 pts max) ---
  const amount = contract.awardAmount;
  const valueScore =
    amount >= 50_000_000
      ? 30
      : amount >= 10_000_000
        ? 25
        : amount >= 5_000_000
          ? 20
          : amount >= 1_000_000
            ? 15
            : amount >= 500_000
              ? 10
              : 5;

  // --- Duration score (30 pts max) ---
  const durationYears = totalDurationDays / 365;
  const durationScore =
    durationYears >= 5
      ? 30
      : durationYears >= 3
        ? 25
        : durationYears >= 2
          ? 20
          : durationYears >= 1
            ? 15
            : 10;

  return Math.min(100, Math.round(proximityScore + valueScore + durationScore));
}
