// The dice customizer: how the dice look, as presets or as custom colors, a finish and a
// glow, with a live preview of every kind of die. The look belongs to this device (kept
// with the other device settings), not to the character.

import Alert from 'react-bootstrap/Alert'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import { DICE_PRESETS, FINISHES, type DiceLook } from '../../config/diceLooks'
import { contrastRatio, readableLook } from '../../dice/look'
import { appConfig } from '../../config/app'
import { Die } from './Die'
import { DiceTray, type TrayDie } from './DiceTray'

/** One die of each kind, showing a high face. */
const SAMPLE: TrayDie[] = [
  { key: 'd4', sides: 4, value: 3 },
  { key: 'd6', sides: 6, value: 5 },
  { key: 'd8', sides: 8, value: 7 },
  { key: 'd10', sides: 10, value: 9 },
  { key: 'd12', sides: 12, value: 11 },
  { key: 'd20', sides: 20, value: 20 },
  { key: 'd100', sides: 100, value: 70 },
]

const same = (a: DiceLook, b: DiceLook) =>
  a.body === b.body &&
  a.number === b.number &&
  a.edge === b.edge &&
  a.finish === b.finish &&
  a.glow === b.glow

type ColorKey = 'body' | 'number' | 'edge'

const COLORS: { key: ColorKey; label: string }[] = [
  { key: 'body', label: 'Body color' },
  { key: 'number', label: 'Number color' },
  { key: 'edge', label: 'Edge color' },
]

export function DiceCustomizer({
  look,
  onChange,
  onReset,
}: {
  look: DiceLook
  onChange: (look: DiceLook) => void
  onReset: () => void
}) {
  const readable = readableLook(look)
  return (
    <div className="dice-customizer d-flex flex-column gap-3">
      <p className="text-body-secondary mb-0">
        How your dice look. This is saved on this device, for every character. It is not
        part of the character.
      </p>

      <section aria-label="Presets">
        <h3 className="h6">Presets</h3>
        <div className="dice-customizer__presets">
          {DICE_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              variant="secondary"
              size="sm"
              active={same(look, preset.look)}
              aria-pressed={same(look, preset.look)}
              className="dice-customizer__preset"
              onClick={() => onChange(preset.look)}
            >
              <Die sides={20} face={20} look={preset.look} />
              <span>{preset.label}</span>
            </Button>
          ))}
        </div>
      </section>

      <section aria-label="Custom">
        <h3 className="h6">Custom</h3>
        <div className="dice-customizer__controls">
          {COLORS.map(({ key, label }) => (
            <Form.Group key={key} controlId={`dice-look-${key}`}>
              <Form.Label>{label}</Form.Label>
              <Form.Control
                type="color"
                value={look[key]}
                onChange={(event) => onChange({ ...look, [key]: event.target.value })}
              />
            </Form.Group>
          ))}
          <Form.Group controlId="dice-look-finish">
            <Form.Label>Finish</Form.Label>
            <Form.Select
              value={look.finish}
              onChange={(event) => {
                const found = FINISHES.find(
                  (entry) => entry.finish === event.target.value,
                )
                if (found) onChange({ ...look, finish: found.finish })
              }}
            >
              {FINISHES.map(({ finish, label }) => (
                <option key={finish} value={finish}>
                  {label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Check
            type="switch"
            id="dice-look-glow"
            label="Glow"
            checked={look.glow}
            onChange={(event) => onChange({ ...look, glow: event.target.checked })}
          />
        </div>
        {readable.adjusted && (
          <Alert variant="info" className="mt-2 mb-0 py-2">
            The number color was changed to{' '}
            {readable.look.number === '#000000' ? 'black' : 'white'} because{' '}
            {contrastRatio(look.number, look.body).toFixed(1)} to 1 is too hard to read.
            Dice keep at least {appConfig.dice.minNumberContrast} to 1.
          </Alert>
        )}
      </section>

      <section aria-label="Preview">
        <h3 className="h6">Preview</h3>
        <DiceTray
          sections={[{ dice: SAMPLE }]}
          look={look}
          phase="landed"
          reducedMotion
        />
      </section>

      <div>
        <Button variant="secondary" onClick={onReset}>
          Reset to default
        </Button>
      </div>
    </div>
  )
}
