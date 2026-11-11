// The one shared component behind both class views: a cell that renders a set of
// features (name + full text) for a single level. The level itself is carried by
// the owning row's left-hand header - in the Compare modal's column and in the
// browser's detail pane alike - so it is not repeated here. Kept in its own file
// so classViewShared stays a pure helper module (component/helper separation).

import { type ResolvedFeature } from '../../data/class'
import { Entries } from '../../text/Entries'

export function FeatureCell({ features }: { features: ResolvedFeature[] }) {
  return (
    <>
      {features.map((f, i) => (
        <div className={i > 0 ? 'mt-3' : ''} key={i}>
          <div className="fw-bold mb-1">{f.name}</div>
          {f.entries.length > 0 ? (
            <Entries entries={f.entries} />
          ) : (
            <span className="text-body-secondary">No description available.</span>
          )}
        </div>
      ))}
    </>
  )
}
