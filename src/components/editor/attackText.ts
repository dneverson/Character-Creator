/**
 * "1d8 + 3": the die and the bonus with its sign; the kind of damage has its own
 * column. With no die the bonus is the whole damage ("4").
 */
export function damageText(dice: string, bonus: number): string {
  if (dice === '') return String(bonus)
  const amount = bonus === 0 ? '' : ` ${bonus < 0 ? '-' : '+'} ${Math.abs(bonus)}`
  return `${dice}${amount}`
}
