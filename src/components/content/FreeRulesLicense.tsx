import { freeRulesLicense } from '../../config/content'

/** The attribution the license of the free rules asks for, document by document. */
export function FreeRulesLicense() {
  return (
    <div className="small text-break">
      {freeRulesLicense.documents.map((document) => (
        <div key={document.flag} className="mb-3">
          <h6 className="small fw-semibold mb-1">{document.name}</h6>
          <p className="mb-0">{document.attribution}</p>
        </div>
      ))}
      <p className="mb-0">{freeRulesLicense.changes}</p>
    </div>
  )
}
