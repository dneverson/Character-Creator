import { AbilityScores } from './AbilityScores'
import { EditorSection } from './EditorSection'
import { StatGeneration } from './StatGeneration'

/** Ability scores in one card: pick a generation method, then assign the results. */
export function AbilityScoresSection() {
  return (
    <EditorSection
      title="Ability Scores"
      subtitle="Generate your scores, then assign them and add any bonuses."
    >
      <StatGeneration />
      <AbilityScores />
    </EditorSection>
  )
}
