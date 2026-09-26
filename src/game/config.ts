/** Every tunable number in the game lives here. */

// ── Spaced repetition ──
/** A missed question comes back within this many questions (inclusive). */
export const MISS_REQUEUE_MIN = 3
export const MISS_REQUEUE_MAX = 5
/** A learning question answered correctly comes back after this many. */
export const LEARN_REQUEUE_MIN = 7
export const LEARN_REQUEUE_MAX = 11
/** Correct answers in a row to graduate from learning to the medium-term pool. */
export const GRADUATE_STREAK = 3
/** Days until each medium-term review; after the last one it moves to long-term. */
export const MEDIUM_INTERVALS_DAYS = [2, 5]
/** Long-term reviews: first interval, growth per success, and ceiling. */
export const LONG_FIRST_DAYS = 21
export const LONG_GROWTH = 1.6
export const LONG_MAX_DAYS = 120
/** Cap on how many questions can be in the learning loop before new ones stop entering. */
export const MAX_ACTIVE_LEARNING = 10

// ── Experience ──
export const XP_CORRECT = 10
export const XP_GRADUATE_MEDIUM = 15
export const XP_GRADUATE_LONG = 30

// ── Supplies ──
export const SUPPLIES_START = 60
export const SUPPLIES_CORRECT = 3
/** Extra Supplies for finally answering a previously-missed question correctly. */
export const SUPPLIES_RECOVERY_BONUS = 7
/** Daily decay: a flat amount plus a percentage of the stockpile. */
export const SUPPLIES_DECAY_FLAT = 5
export const SUPPLIES_DECAY_PERCENT = 0.02
/** Below this, the status bar warns that supplies are running low. */
export const SUPPLIES_LOW = 25

// ── Scrap (building material for the outpost; never decays) ──
export const SCRAP_CORRECT = 2
export const SCRAP_GRADUATE_MEDIUM = 3
export const SCRAP_GRADUATE_LONG = 5
/** Paid once per passed boss battle, before any Signal Bunker bonus. */
export const SCRAP_BOSS_PASS = 20
/** Paid for winning a mini boss (a single sub-element test). */
export const SCRAP_MINI_PASS = 8

// ── Mini bosses ──
export const MINI_LENGTH = 10
/** Same ratio as the real exams (26/35, 37/50). */
export const MINI_PASS_RATIO = 0.74

// ── Streaks and badges ──
/** Answers in a day for it to count toward the study streak. */
export const DAILY_GOAL = 10
export const STREAK_BADGES = [7, 30, 100]
/** Consecutive days with Supplies above zero for the survivor badge. */
export const SURVIVOR_DAYS = 30

// Boss battle length and pass mark come from each pool (src/data/pools/*.json).
