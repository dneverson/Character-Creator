// One die drawn as inline SVG: the outline of its kind, a surface from the look (solid,
// gradient, metallic, translucent, marble, speckled, starry), the edges and its number.
// The number sits on a plate of the body colour, so it reads whatever the surface does.

import { useId } from 'react'
import type { DiceLook } from '../../config/diceLooks'
import { readableLook, shade } from '../../dice/look'
import { SPECKS, VEINS, shapeOf } from './dieShapes'

/** A mark of four points, about (x, y). */
const star = (x: number, y: number, r: number) => {
  const n = r * 0.3
  return `M${x} ${y - r} L${x + n} ${y - n} L${x + r} ${y} L${x + n} ${y + n} L${x} ${y + r} L${x - n} ${y + n} L${x - r} ${y} L${x - n} ${y - n} Z`
}

/** The size of the number so that two and three digits fit. */
const fontSize = (text: string) => (text.length >= 3 ? 20 : text.length === 2 ? 28 : 36)

/** The stops of the gradient the body is filled with, by finish. */
function BodyStops({ look }: { look: DiceLook }) {
  const { body, finish } = look
  if (finish === 'metallic') {
    return (
      <>
        <stop offset="0" stopColor={shade(body, 0.5)} />
        <stop offset="0.3" stopColor={body} />
        <stop offset="0.55" stopColor={shade(body, -0.35)} />
        <stop offset="0.78" stopColor={shade(body, 0.4)} />
        <stop offset="1" stopColor={shade(body, -0.2)} />
      </>
    )
  }
  if (finish === 'translucent') {
    return (
      <>
        <stop offset="0" stopColor={shade(body, 0.55)} />
        <stop offset="1" stopColor={body} />
      </>
    )
  }
  const spread = finish === 'gradient' ? 0.3 : 0.12
  return (
    <>
      <stop offset="0" stopColor={shade(body, spread)} />
      <stop offset="1" stopColor={shade(body, -spread)} />
    </>
  )
}

/** The defs and the layers that make up a finish. */
function Surface({ id, look, path }: { id: string; look: DiceLook; path: string }) {
  const { body, edge, finish } = look
  return (
    <>
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={path} />
        </clipPath>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          <BodyStops look={look} />
        </linearGradient>
        <radialGradient id={`${id}-plate`}>
          <stop offset="0.6" stopColor={body} stopOpacity="1" />
          <stop offset="1" stopColor={body} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d={path}
        fill={finish === 'solid' ? body : `url(#${id}-fill)`}
        fillOpacity={finish === 'translucent' ? 0.82 : 1}
      />
      <g clipPath={`url(#${id}-clip)`}>
        {finish === 'marble' &&
          VEINS.map((vein, at) => (
            <path
              key={vein}
              d={vein}
              fill="none"
              stroke={at % 2 === 0 ? shade(body, 0.45) : shade(body, -0.45)}
              strokeWidth={at === 0 ? 3 : 2}
              strokeOpacity="0.5"
            />
          ))}
        {finish === 'speckled' &&
          SPECKS.map(([x, y, r], at) => (
            <circle
              key={at}
              cx={x}
              cy={y}
              r={r}
              fill={at % 2 === 0 ? shade(body, 0.5) : shade(body, -0.5)}
              fillOpacity="0.8"
            />
          ))}
        {finish === 'starry' &&
          SPECKS.map(([x, y, r], at) => (
            <path key={at} d={star(x, y, r * 3)} fill={edge} fillOpacity="0.85" />
          ))}
        {finish === 'translucent' && (
          <ellipse cx="34" cy="26" rx="24" ry="12" fill="#ffffff" fillOpacity="0.35" />
        )}
      </g>
    </>
  )
}

export interface DieProps {
  /** The kind of die: 4, 6, 8, 10, 12, 20; another count of sides is drawn round. */
  sides: number
  /** What its top face shows. */
  face: string | number
  look: DiceLook
  className?: string
}

export function Die({ sides, face, look, className }: DieProps) {
  const id = useId().replace(/:/g, '')
  const shown = readableLook(look).look
  const { path, facets, numberY } = shapeOf(sides)
  const text = String(face)
  return (
    <svg
      viewBox="0 0 100 100"
      className={`die${className ? ` ${className}` : ''}`}
      style={shown.glow ? { filter: `drop-shadow(0 0 5px ${shown.edge})` } : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <Surface id={id} look={shown} path={path} />
      <path
        d={facets}
        fill="none"
        stroke={shown.edge}
        strokeWidth="1.2"
        strokeOpacity="0.6"
        strokeLinejoin="round"
      />
      <path
        d={path}
        fill="none"
        stroke={shown.edge}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="50" cy={numberY} r="27" fill={`url(#${id}-plate)`} />
      <text
        x="50"
        y={numberY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize(text)}
        fontWeight="700"
        fill={shown.number}
        style={
          shown.glow ? { filter: `drop-shadow(0 0 2px ${shown.number})` } : undefined
        }
      >
        {text}
      </text>
    </svg>
  )
}
