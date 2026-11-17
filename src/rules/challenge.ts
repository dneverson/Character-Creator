// Challenge rating: the experience points a creature of each rating is worth, and the
// proficiency bonus that goes with it. Both editions print the same table (2014 Monster
// Manual, 2024 Monster Manual), so a stat block that gives neither is read from here.

/** Experience points by challenge rating, as the Monster Manual's table prints them. */
const XP_BY_CR: Readonly<Record<string, number>> = {
  '0': 10,
  '0.125': 25,
  '0.25': 50,
  '0.5': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
}

/** The experience points of a challenge rating (1/4 is 0.25), undefined off the table. */
export const xpForCr = (cr: number): number | undefined => XP_BY_CR[String(cr)]

/** The proficiency bonus of a challenge rating: +2 up to CR 4, one more every four ratings. */
export const proficiencyForCr = (cr: number): number =>
  Math.max(2, Math.floor((cr - 1) / 4) + 2)
