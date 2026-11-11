/**
 * How an ability score reads at a glance: gold for a perfect 18+, then green
 * high, blue mid, red low. One bucket function drives both the text-colour class
 * (`scoreColorClass`) and the matrix cell-background class (`scoreCellClass`).
 */
export type ScoreBucket = 'perfect' | 'high' | 'mid' | 'low'

export function scoreBucket(score: number): ScoreBucket {
  if (score >= 18) return 'perfect'
  if (score >= 16) return 'high'
  if (score <= 9) return 'low'
  return 'mid'
}

/**
 * Text-colour class for an ability score. `.score-perfect` is a local class
 * (see index.css); the rest are Bootstrap utilities.
 */
export function scoreColorClass(score: number): string {
  switch (scoreBucket(score)) {
    case 'perfect':
      return 'score-perfect'
    case 'high':
      return 'text-success'
    case 'low':
      return 'text-danger'
    case 'mid':
      return 'text-primary'
  }
}

/**
 * Background-tint class for a score square (a matrix cell or a rolled-pool dice
 * tile), so a grid of scores reads by colour before you read the numbers (a red
 * square is a low score, gold is a perfect one). See `.score-tint--*` in
 * index.css.
 */
export function scoreCellClass(score: number): string {
  return `score-tint--${scoreBucket(score)}`
}
