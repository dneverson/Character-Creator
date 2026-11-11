// A die table as the book prints it: the die, then what each roll gives.

import Table from 'react-bootstrap/Table'
import type { DieTable } from '../../data/dieTables'

export function DieTableView({ table }: { table: DieTable }) {
  return (
    <Table size="sm" className="mb-0">
      <thead>
        <tr>
          <th scope="col" className="text-nowrap">
            d{table.die}
          </th>
          <th scope="col">{table.label}</th>
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row) => (
          <tr key={row.min}>
            <td className="text-nowrap">
              {row.min === row.max ? row.min : `${row.min}-${row.max}`}
            </td>
            <td>{row.text}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
