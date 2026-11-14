import { useMemo } from 'react'
import { subclassesFor } from '../../data/class'
import { useCharacter } from '../../character/useCharacterDoc'
import { BrowseTable, type RowAction } from '../table/BrowseTable'
import { referenceColumns, searchText } from '../editor/classReference'
import { rowKey, type ClassRow } from '../editor/classRows'
import { classTags, colTitle, describeClasses } from '../editor/classViewShared'
import { classKey, useClassBuild } from '../editor/useClassBuild'

/**
 * The subclasses of the class the level goes to, from the character's books, in the class
 * reference table: the one chosen can be cleared, any other chosen.
 */
export function SubclassStep({ classIndex }: { classIndex: number }) {
  const character = useCharacter()
  const { byKey, setSubclass } = useClassBuild()
  const cls = character?.classes[classIndex]
  const loaded = cls ? byKey.get(classKey(cls.name, cls.source)) : undefined
  const books = character?.selectedBooks
  const rows = useMemo<ClassRow[]>(() => {
    if (!loaded || !books) return []
    return subclassesFor(loaded)
      .filter((s) => books.includes(s.source))
      .map((subclass) => ({ loaded, subclass }))
  }, [loaded, books])
  if (!cls || rows.length === 0) return null

  const action = (r: ClassRow): RowAction | undefined => {
    const sub = r.subclass
    if (!sub) return undefined
    const chosen =
      cls.subclass?.shortName === sub.shortName && cls.subclass.source === sub.source
    return chosen
      ? {
          label: 'Clear',
          detailLabel: 'Clear the subclass',
          variant: 'danger',
          run: () => setSubclass(classIndex, ''),
        }
      : {
          label: 'Choose',
          detailLabel: `Choose ${sub.name}`,
          run: () => setSubclass(classIndex, `${sub.shortName}|${sub.source}`),
        }
  }

  return (
    <BrowseTable<ClassRow>
      tableId="levelup-subclass"
      rows={rows}
      columns={referenceColumns}
      idOf={rowKey}
      nameOf={colTitle}
      tagsOf={classTags}
      describe={describeClasses}
      searchText={searchText}
      action={{ key: 'choose', header: 'Subclass', of: action }}
      labels={{
        compare: 'Compare subclasses',
        search: 'Search subclasses...',
        table: `${cls.name} subclasses`,
      }}
    />
  )
}
