import Nav from 'react-bootstrap/Nav'
import { useContext } from 'react'
import { selectSheetTab, useCharacterStore } from '../../character/store'
import type { DerivedSheet } from '../../derived'
import { visibleTabs } from '../../sheet/tabs'
import { ResizableSplit } from '../table/ResizableSplit'
import { useReadOnly } from './readOnly'
import { SheetDetailPane, useSheetDetail, useWideSheet } from './SheetDetail'
import { SheetTabContext } from './sheetTabContext'

/** The switching box: a strip of tabs and the panel of the one that is open. */
export function SheetTabs({ sheet, phone }: { sheet: DerivedSheet; phone: boolean }) {
  // Kept in the store, so the address can name the open tab.
  const storeTab = useCharacterStore(selectSheetTab)
  const storeSetTab = useCharacterStore((s) => s.setSheetTab)
  // A shared character is not in the store: its sheet keeps its tab itself.
  const own = useContext(SheetTabContext)
  const openId = own ? own.tab : storeTab
  const setOpenId = own ? own.setTab : storeSetTab
  const readOnly = useReadOnly()
  const wide = useWideSheet()
  const { current, dismissRow } = useSheetDetail()
  const tabs = visibleTabs(sheet, phone, readOnly)
  // The open tab may have left (a phone turned wide, a caster who lost the spells).
  const open = tabs.find((t) => t.id === openId) ?? tabs[0]
  if (!open) return null
  const Panel = open.Panel
  return (
    <div className="sheet-tabs">
      <Nav className="sheet-tabs__strip flex-nowrap" role="tablist" aria-label="Sheet">
        {tabs.map((tab) => (
          <Nav.Item key={tab.id}>
            <button
              type="button"
              role="tab"
              id={`sheet-tab-${tab.id}`}
              aria-selected={tab.id === open.id}
              aria-controls="sheet-tab-panel"
              className={`sheet-tabs__tab${tab.id === open.id ? ' active' : ''}`}
              onClick={() => {
                if (tab.id !== open.id) dismissRow()
                setOpenId(tab.id)
              }}
            >
              {tab.label}
            </button>
          </Nav.Item>
        ))}
      </Nav>
      <div
        id="sheet-tab-panel"
        role="tabpanel"
        aria-labelledby={`sheet-tab-${open.id}`}
        className="sheet-tabs__panel"
      >
        {wide ? (
          <ResizableSplit
            master={<Panel sheet={sheet} />}
            detail={current ? <SheetDetailPane /> : undefined}
          />
        ) : (
          <Panel sheet={sheet} />
        )}
      </div>
    </div>
  )
}
