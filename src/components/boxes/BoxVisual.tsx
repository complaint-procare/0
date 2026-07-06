import { formatBoxNumber, layerInfo, type BoxMatch } from '@/lib/boxes'

function itemClass(type?: string) {
  return type === 'lying_top' ? 'plan-item-top' : 'plan-item'
}

function cellRects(
  info: ReturnType<typeof layerInfo>,
  layout: { x: number; y: number; w: number; h: number; boxLength: number; boxWidth: number },
) {
  const [countX, countY] = info.counts
  const maxCells = 90
  const cellCount = countX * countY
  const itemW = countX ? (info.orientation[0] / layout.boxLength) * layout.w : 0
  const itemH = countY ? (info.orientation[1] / layout.boxWidth) * layout.h : 0
  const gap = cellCount > 30 ? 1 : 2
  const cls = itemClass(info.active?.type)

  if (!cellCount) {
    return <rect x={layout.x} y={layout.y} width={layout.w} height={layout.h} rx="5" className="plan-empty" />
  }

  if (cellCount > maxCells) {
    const usedRatio = Math.min(1, info.drawnLayerItems / cellCount)
    const usedW = Math.max(0, layout.w * usedRatio)
    return (
      <>
        <rect x={layout.x} y={layout.y} width={usedW} height={layout.h} rx="5" className={cls} />
        <rect
          x={layout.x + usedW}
          y={layout.y}
          width={Math.max(0, layout.w - usedW)}
          height={layout.h}
          rx="5"
          className="plan-empty"
        />
      </>
    )
  }

  const rects = []
  for (let y = 0; y < countY; y += 1) {
    for (let x = 0; x < countX; x += 1) {
      const index = y * countX + x
      const filled = index < info.drawnLayerItems
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={layout.x + x * itemW + gap / 2}
          y={layout.y + y * itemH + gap / 2}
          width={Math.max(1, itemW - gap)}
          height={Math.max(1, itemH - gap)}
          rx="4"
          className={filled ? cls : 'plan-empty'}
        />,
      )
    }
  }

  return rects
}

function singleLayerBar(info: ReturnType<typeof layerInfo>, layout: { x: number; y: number; w: number; h: number }) {
  const totalLayers = Math.max(1, info.counts[2])
  const maxLayerRows = Math.min(totalLayers, 8)
  const layerH = layout.h / maxLayerRows

  return Array.from({ length: maxLayerRows }, (_, index) => {
    const layerIndex = maxLayerRows - index
    const realLayer = totalLayers > maxLayerRows ? Math.ceil((layerIndex / maxLayerRows) * totalLayers) : layerIndex
    const filled = realLayer <= info.usedLayers
    return (
      <rect
        key={index}
        x={layout.x}
        y={layout.y + index * layerH + 1}
        width={layout.w}
        height={Math.max(1, layerH - 2)}
        rx="3"
        className={filled ? itemClass(info.active?.type) : 'plan-layer-free'}
      />
    )
  })
}

function mixedLayerBar(
  info: ReturnType<typeof layerInfo>,
  layout: { x: number; y: number; w: number; h: number },
  box: BoxMatch,
) {
  const nodes = []
  let cursor = layout.y + layout.h

  for (const segment of info.segments) {
    if (!segment.usedHeight) continue
    const height = Math.max(5, (segment.usedHeight / box.height_cm) * layout.h)
    cursor -= height
    nodes.push(
      <rect
        key={segment.index}
        x={layout.x}
        y={cursor}
        width={layout.w}
        height={height}
        rx="3"
        className={segment.type === 'lying_top' ? 'plan-layer-top' : 'plan-layer-used'}
      />,
    )
  }

  if (cursor > layout.y + 1) {
    nodes.unshift(
      <rect key="free" x={layout.x} y={layout.y} width={layout.w} height={cursor - layout.y} rx="3" className="plan-layer-free" />,
    )
  }

  return nodes
}

function visualTitle(info: ReturnType<typeof layerInfo>) {
  if (!info.mixed) return `${info.counts.join(' x ')} шт`
  return 'стоячі + зверху'
}

function mixedCaption(info: ReturnType<typeof layerInfo>) {
  if (!info.mixed) return `1 шар: ${info.drawnLayerItems}/${info.perLayer} шт`
  const standing = info.segments.find((segment) => segment.type === 'upright')?.usedItems || 0
  const lying = info.segments.find((segment) => segment.type === 'lying_top')?.usedItems || 0
  return `стоячі ${standing} + зверху ${lying} шт`
}

export function BoxVisual({ box, qty }: { box: BoxMatch; qty: number }) {
  const info = layerInfo(box, qty)
  const layout = { x: 18, y: 30, w: 205, h: 132, boxLength: box.length_cm, boxWidth: box.width_cm }
  const barLayout = { x: 252, y: 30, w: 32, h: 132 }
  const freeRight = info.freeX > 0 ? (info.freeX / box.length_cm) * layout.w : 0
  const freeBottom = info.freeY > 0 ? (info.freeY / box.width_cm) * layout.h : 0
  const freePercent = Math.max(0, 100 - (box.fill_percent || 0))

  return (
    <section className="box-visual" aria-label="Схема розкладки">
      <div className="box-visual-head">
        <span>Схема</span>
        <strong>{visualTitle(info)}</strong>
      </div>
      <svg className="box-plan" viewBox="0 0 320 198" role="img" aria-label="Візуалізація коробки і товарів">
        <text x="18" y="18" className="plan-label">вид зверху</text>
        <rect x={layout.x} y={layout.y} width={layout.w} height={layout.h} rx="8" className="plan-box" />
        {cellRects(info, layout)}
        {freeRight > 0.5 && <rect x={layout.x + layout.w - freeRight} y={layout.y} width={freeRight} height={layout.h} rx="5" className="plan-free" />}
        {freeBottom > 0.5 && <rect x={layout.x} y={layout.y + layout.h - freeBottom} width={layout.w} height={freeBottom} rx="5" className="plan-free" />}
        <text x="18" y="184" className="plan-caption">{mixedCaption(info)}</text>
        <text x="252" y="18" className="plan-label">висота</text>
        <rect x={barLayout.x} y={barLayout.y} width={barLayout.w} height={barLayout.h} rx="5" className="plan-box" />
        {info.mixed ? mixedLayerBar(info, barLayout, box) : singleLayerBar(info, barLayout)}
        <text x="238" y="184" className="plan-caption">
          {formatBoxNumber(info.usedHeight)} / {formatBoxNumber(box.height_cm)} см
        </text>
      </svg>
      <div className="free-space-grid">
        <span>Довжина<strong>{formatBoxNumber(info.freeX)} см</strong></span>
        <span>Ширина<strong>{formatBoxNumber(info.freeY)} см</strong></span>
        <span>Висота<strong>{formatBoxNumber(info.freeZ)} см</strong></span>
        <span>Вільно<strong>{formatBoxNumber(freePercent)}%</strong></span>
      </div>
      <div className="space-meter" aria-label={`Вільний простір ${formatBoxNumber(freePercent)}%`}>
        <span style={{ width: `${Math.min(100, Math.max(0, freePercent))}%` }} />
      </div>
    </section>
  )
}
