// The conditions of the books, with their full text, for the sheet's condition picker.

import { memoizeContent } from '../content/epoch'
import type { Entry } from '../text/Entries'
import { fetchData } from './dataClient'

export interface Condition {
  name: string
  source: string
  /** The page the book prints it on, when the data says. */
  page?: number
  entries: Entry[]
}

interface ConditionsFile {
  condition: Condition[]
}

/** Every condition of every book, in the order the data gives them. */
export const loadConditions = memoizeContent(async (): Promise<Condition[]> => {
  const data = await fetchData<ConditionsFile>('conditionsdiseases.json')
  return data.condition.map(({ name, source, page, entries }) => ({
    name,
    source,
    page,
    entries,
  }))
})

/** The name the sheet tracks as a stepper, not as a tag. */
export const EXHAUSTION = 'Exhaustion'
