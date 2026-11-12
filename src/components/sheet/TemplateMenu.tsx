import Dropdown from 'react-bootstrap/Dropdown'
import {
  SHEET_TEMPLATES,
  sheetTemplate,
  type SheetTemplateId,
} from '../../sheet/templates'

/** Picks the sheet's look from the template registry. */
export function TemplateMenu({
  value,
  onChange,
}: {
  value: SheetTemplateId
  onChange: (id: SheetTemplateId) => void
}) {
  return (
    <Dropdown align="end">
      <Dropdown.Toggle variant="secondary" id="sheet-template">
        Look: {sheetTemplate(value).label}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {SHEET_TEMPLATES.map((t) => (
          <Dropdown.Item
            key={t.id}
            active={t.id === value}
            onClick={() => onChange(t.id)}
          >
            <div>{t.label}</div>
            <div className="small">{t.description}</div>
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  )
}
