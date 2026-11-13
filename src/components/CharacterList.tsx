import { useRef } from 'react'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import Card from 'react-bootstrap/Card'
import Col from 'react-bootstrap/Col'
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Stack from 'react-bootstrap/Stack'
import { downloadCharacter, parseImportedCharacter } from '../character/io'
import { classLine } from '../character/identity'
import { useCharacterStore } from '../character/store'
import { formatTimestamp } from '../ui/date'

export function CharacterList() {
  const { characters, order } = useCharacterStore()
  const newCharacter = useCharacterStore((s) => s.newCharacter)
  const openCharacter = useCharacterStore((s) => s.openCharacter)
  const duplicateCharacter = useCharacterStore((s) => s.duplicateCharacter)
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter)
  const importCharacter = useCharacterStore((s) => s.importCharacter)
  const fileInput = useRef<HTMLInputElement>(null)

  const list = order.map((id) => characters[id]).filter((c) => c != null)

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-importing the same file
    if (!file) return
    try {
      importCharacter(parseImportedCharacter(await file.text()))
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <Container as="main" className="py-4">
      <Stack direction="horizontal" gap={2} className="mb-4">
        <h1 className="h3 mb-0">My Characters</h1>
        <div className="ms-auto d-flex gap-2">
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            Import
          </Button>
          <Button variant="primary" onClick={newCharacter}>
            + New Character
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="d-none"
          onChange={onImportFile}
        />
      </Stack>

      {list.length === 0 ? (
        <Card body className="text-center text-body-secondary py-5">
          No characters yet. Create one to get started.
        </Card>
      ) : (
        <Row xs={1} md={2} lg={3} className="g-3">
          {list.map((c) => (
            <Col key={c.id}>
              <Card className="h-100">
                <Card.Body className="d-flex flex-column">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    {c.portrait && (
                      <img
                        src={c.portrait}
                        alt=""
                        width={40}
                        height={40}
                        className="rounded flex-shrink-0"
                      />
                    )}
                    <Card.Title className="text-truncate mb-0" style={{ minWidth: 0 }}>
                      {c.name}
                    </Card.Title>
                  </div>
                  <div className="mb-1 small">
                    {c.completedAt === undefined ? (
                      <Badge bg="secondary">In progress</Badge>
                    ) : (
                      classLine(c) || 'No class'
                    )}
                  </div>
                  <Card.Subtitle className="mb-3 text-body-secondary small">
                    Updated {formatTimestamp(c.updatedAt)}
                  </Card.Subtitle>
                  <div className="mt-auto d-flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => openCharacter(c.id)}
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => duplicateCharacter(c.id)}
                    >
                      Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadCharacter(c)}
                    >
                      Export
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="ms-auto"
                      onClick={() => {
                        if (confirm(`Delete "${c.name}"? This cannot be undone.`))
                          deleteCharacter(c.id)
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  )
}
