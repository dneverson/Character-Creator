// The rewards whose text states a number or a limit the sheet does not carry, each with
// the reason. The audit in rewards.test.ts asks every reward of the data for a row in a
// rule table (hit points, speeds, senses, counters), the spell grants, or a line here.
// None is left: what each states is a row of a table, with the cases the sheet cannot
// check shown as conditions.

export const REWARD_EXCUSED: Readonly<Record<string, string>> = {}
