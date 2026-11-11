import { BackgroundSelection } from './BackgroundSelection'
import { BackgroundStory } from './BackgroundStory'
import { EditorSection } from './EditorSection'

/**
 * Background in one card: the background itself, then the story. The story's
 * traits, ideals, bonds, and flaws come from the background's characteristic
 * tables, so the two belong together.
 */
export function BackgroundSection() {
  return (
    <EditorSection
      title="Background"
      subtitle="Every background from your books, stat by stat, then the story: pick or roll each table, or write your own."
    >
      <BackgroundSelection />
      <BackgroundStory />
    </EditorSection>
  )
}
