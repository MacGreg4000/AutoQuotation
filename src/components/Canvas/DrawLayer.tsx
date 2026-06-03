import React, { useMemo } from 'react'
import { Line, Circle, Rect, Text, Group } from 'react-konva'
import { useProjectStore } from '@/store/useProjectStore'
import { useToolStore } from '@/store/useToolStore'
import { usePdfStore } from '@/store/usePdfStore'
import type { Point, Measurement } from '@/types'
import {
  distance,
  polylineLength,
  polygonArea,
  polygonCentroid,
  toRealUnit,
  getAreaUnit,
} from '@/lib/geometry'

interface DrawLayerProps {
  currentPoints: Point[]
  calibPoints: Point[]
  mousePos: Point | null
  onFinalize: (pts: Point[]) => void
}

const DrawLayer: React.FC<DrawLayerProps> = ({ currentPoints, calibPoints, mousePos }) => {
  const { measurements, selectedMeasurementId, selectMeasurement, updateMeasurement, calibration, postes, legend, setLegend } = useProjectStore()
  const { activeTool, activeColor } = useToolStore()
  const { currentPage, zoom } = usePdfStore()

  // Facteur zoom — toutes les tailles sont divisées par z pour rester constantes à l'écran
  const z = Math.max(zoom, 0.1)
  const iz = 1 / z  // inverse zoom

  // Stats par poste pour la légende
  const posteStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number; unit: string }> = {}
    for (const p of postes) {
      const assigned = measurements.filter(m => m.posteId === p.id)
      const total = assigned.reduce((sum, m) => sum + m.value, 0)
      const unit = assigned.find(m => m.unit)?.unit ?? '—'
      stats[p.id] = { total, count: assigned.length, unit }
    }
    return stats
  }, [postes, measurements])

  // ─── Rendu d'une mesure ────────────────────────────────────────────────────
  const renderMeasurement = (m: Measurement): React.ReactNode => {
    if (!m.visible || m.page !== currentPage) return null
    const pts = m.points
    const isSelected = m.id === selectedMeasurementId
    const sw = isSelected ? 3 : 2  // strokeWidth des lignes (OK sans compensation zoom)

    const poste = postes.find(p => p.id === m.posteId)
    const color = poste ? poste.color : m.color
    const posteName = poste?.name

    // Tailles compensées zoom (constantes en pixels écran)
    const dotR   = (isSelected ? 5 : 3) * iz
    const fs     = 11 * iz          // fontSize valeur
    const fsSm   = 9  * iz          // fontSize secondaire
    const lh     = 16 * iz          // hauteur ligne label
    const pad    = 4  * iz
    const cw     = 7  * iz          // largeur par caractère
    const cwSm   = 6  * iz
    const cr     = 3  * iz          // cornerRadius
    const xR     = 5  * iz          // rayon bouton fermeture

    // Helpers label
    const hideBtn = (ax: number, ay: number) => isSelected ? (
      <Group
        x={ax} y={ay}
        onMouseDown={(e: any) => { e.cancelBubble = true }}
        onClick={(e: any) => { e.cancelBubble = true; updateMeasurement(m.id, { labelHidden: true }) }}
      >
        <Circle radius={xR} fill="rgba(220,38,38,0.9)" />
        <Text x={-xR * 0.45} y={-xR * 0.7} text="×" fill="white" fontSize={xR * 1.6} fontStyle="bold" />
      </Group>
    ) : null

    // Label draggable helpers
    const labelGroupProps = (ax: number, ay: number) => ({
      x: ax + (m.labelOffset?.x ?? 0),
      y: ay + (m.labelOffset?.y ?? 0),
      draggable: true,
      onDragEnd: (e: any) => updateMeasurement(m.id, {
        labelOffset: { x: e.target.x() - ax, y: e.target.y() - ay }
      }),
      onClick: (e: any) => { e.cancelBubble = true; selectMeasurement(m.id) },
    })

    // ── Longueur ───────────────────────────────────────────────────────────
    if (m.type === 'length') {
      if (pts.length < 2) return null
      if (m.labelHidden) return (
        <Group key={m.id} onClick={() => selectMeasurement(m.id)}>
          <Line points={pts.flatMap(p => [p.x, p.y])} stroke={color} strokeWidth={sw} lineCap="round" lineJoin="round" />
          {pts.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={dotR} fill={color} />)}
        </Group>
      )
      const flat = pts.flatMap(p => [p.x, p.y])
      const midIdx = Math.floor(pts.length / 2)
      const ax = (pts[midIdx].x + pts[Math.max(0, midIdx - 1)].x) / 2
      const ay = (pts[midIdx].y + pts[Math.max(0, midIdx - 1)].y) / 2
      const label = `${m.value.toFixed(2)} ${m.unit}`
      const lw = label.length * cw + pad * 2
      const nlw = posteName ? Math.max(posteName.length * cwSm + pad, 30 * iz) : 0
      const totalH = (posteName ? lh + 2 * iz : 0) + lh
      return [
        <Group key={`${m.id}-geo`} onClick={() => selectMeasurement(m.id)}>
          <Line points={flat} stroke={color} strokeWidth={sw} lineCap="round" lineJoin="round" />
          {pts.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={dotR} fill={color} />)}
        </Group>,
        <Group key={`${m.id}-lbl`} {...labelGroupProps(ax, ay)}>
          {posteName && <>
            <Rect x={-nlw / 2} y={-totalH} width={nlw} height={lh} fill={color} cornerRadius={cr} />
            <Text x={-nlw / 2 + pad / 2} y={-totalH + pad / 2} text={posteName} fill="white" fontSize={fsSm} fontStyle="bold" />
          </>}
          <Rect x={-lw / 2} y={-lh} width={lw} height={lh} fill="rgba(0,0,0,0.75)" cornerRadius={cr} />
          <Text x={-lw / 2 + pad} y={-lh + pad / 2} text={label} fill="white" fontSize={fs} fontStyle="bold" />
          {hideBtn(lw / 2 + xR, -lh)}
        </Group>,
      ]
    }

    // ── Surface / Toiture ──────────────────────────────────────────────────
    if (m.type === 'area' || m.type === 'roof') {
      if (pts.length < 3) return null
      const flat = [...pts.flatMap(p => [p.x, p.y]), pts[0].x, pts[0].y]
      const c = polygonCentroid(pts)
      if (m.labelHidden) return (
        <Group key={m.id} onClick={() => selectMeasurement(m.id)}>
          <Line points={flat} stroke={color} strokeWidth={sw} closed fill={color + (isSelected ? '44' : '22')} lineCap="round" lineJoin="round" />
        </Group>
      )
      const label = `${m.value.toFixed(2)} ${m.unit}`
      const lw = label.length * cw + pad * 2
      const nlw = posteName ? Math.max(posteName.length * cwSm + pad, 40 * iz) : 0
      const valH = m.type === 'roof' ? lh * 2 : lh
      const totalH = (posteName ? lh + 2 * iz : 0) + valH
      return [
        <Group key={`${m.id}-geo`} onClick={() => selectMeasurement(m.id)}>
          <Line points={flat} stroke={color} strokeWidth={sw} closed fill={color + (isSelected ? '44' : '22')} lineCap="round" lineJoin="round" />
        </Group>,
        <Group key={`${m.id}-lbl`} {...labelGroupProps(c.x, c.y)}>
          {posteName && <>
            <Rect x={-nlw / 2} y={-totalH} width={nlw} height={lh} fill={color} cornerRadius={cr} />
            <Text x={-nlw / 2 + pad / 2} y={-totalH + pad / 2} text={posteName} fill="white" fontSize={fsSm} fontStyle="bold" />
          </>}
          <Rect x={-lw / 2} y={-valH} width={lw} height={valH} fill="rgba(0,0,0,0.75)" cornerRadius={cr} />
          <Text x={-lw / 2 + pad} y={-valH + pad / 2} text={label} fill="white" fontSize={fs} fontStyle="bold" />
          {m.type === 'roof' && m.slopeFactor && (
            <Text x={-lw / 2 + pad} y={-valH / 2 + pad / 2} text={`pente ×${m.slopeFactor.toFixed(3)}`} fill="#fbbf24" fontSize={fsSm} />
          )}
          {hideBtn(lw / 2 + xR, -valH)}
        </Group>,
      ]
    }

    // ── Déduction ──────────────────────────────────────────────────────────
    if (m.type === 'subtract') {
      if (pts.length < 3) return null
      const flat = [...pts.flatMap(p => [p.x, p.y]), pts[0].x, pts[0].y]
      const c = polygonCentroid(pts)
      if (m.labelHidden) return (
        <Group key={m.id} onClick={() => selectMeasurement(m.id)}>
          <Line points={flat} stroke={color} strokeWidth={sw} closed dash={[8, 4]} fill={color + '11'} lineCap="round" lineJoin="round" />
        </Group>
      )
      const label = `${m.value.toFixed(2)} ${m.unit}`
      const lw = label.length * cw + pad * 2
      return [
        <Group key={`${m.id}-geo`} onClick={() => selectMeasurement(m.id)}>
          <Line points={flat} stroke={color} strokeWidth={sw} closed dash={[8, 4]} fill={color + '11'} lineCap="round" lineJoin="round" />
        </Group>,
        <Group key={`${m.id}-lbl`} {...labelGroupProps(c.x, c.y)}>
          <Rect x={-lw / 2} y={-lh} width={lw} height={lh} fill={color} cornerRadius={cr} />
          <Text x={-lw / 2 + pad} y={-lh + pad / 2} text={label} fill="white" fontSize={fs} fontStyle="bold" />
          {hideBtn(lw / 2 + xR, -lh)}
        </Group>,
      ]
    }

    // ── Surface mur ────────────────────────────────────────────────────────
    if (m.type === 'wall') {
      if (pts.length < 2) return null
      const flat = pts.flatMap(p => [p.x, p.y])
      const midIdx = Math.floor(pts.length / 2)
      const ax = (pts[midIdx].x + pts[Math.max(0, midIdx - 1)].x) / 2
      const ay = (pts[midIdx].y + pts[Math.max(0, midIdx - 1)].y) / 2
      if (m.labelHidden) return (
        <Group key={m.id} onClick={() => selectMeasurement(m.id)}>
          <Line points={flat} stroke={color} strokeWidth={sw} lineCap="round" lineJoin="round" dash={[6, 3]} />
          {pts.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={dotR} fill={color} />)}
        </Group>
      )
      const label = `${m.value.toFixed(2)} ${m.unit}`
      const lw = label.length * cw + pad * 2
      const nlw = posteName ? Math.max(posteName.length * cwSm + pad, 30 * iz) : 0
      const subLabel = m.wallHeight ? `périm.×${m.wallHeight}` : ''
      const valH = subLabel ? lh * 1.75 : lh
      const totalH = (posteName ? lh + 2 * iz : 0) + valH
      return [
        <Group key={`${m.id}-geo`} onClick={() => selectMeasurement(m.id)}>
          <Line points={flat} stroke={color} strokeWidth={sw} lineCap="round" lineJoin="round" dash={[6, 3]} />
          {pts.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={dotR} fill={color} />)}
        </Group>,
        <Group key={`${m.id}-lbl`} {...labelGroupProps(ax, ay)}>
          {posteName && <>
            <Rect x={-nlw / 2} y={-totalH} width={nlw} height={lh} fill={color} cornerRadius={cr} />
            <Text x={-nlw / 2 + pad / 2} y={-totalH + pad / 2} text={posteName} fill="white" fontSize={fsSm} fontStyle="bold" />
          </>}
          <Rect x={-lw / 2} y={-valH} width={lw} height={valH} fill="rgba(88,28,135,0.85)" cornerRadius={cr} />
          <Text x={-lw / 2 + pad} y={-valH + pad / 2} text={label} fill="white" fontSize={fs} fontStyle="bold" />
          {subLabel && <Text x={-lw / 2 + pad} y={-valH / 2 + pad / 2} text={subLabel} fill="#d8b4fe" fontSize={fsSm} />}
          {hideBtn(lw / 2 + xR, -valH)}
        </Group>,
      ]
    }

    // ── Compteur ───────────────────────────────────────────────────────────
    if (m.type === 'count') {
      const p = pts[0]
      if (!p) return null
      return (
        <Group key={m.id} onClick={() => selectMeasurement(m.id)}>
          <Circle x={p.x} y={p.y} radius={9 * iz} fill={color} stroke={isSelected ? 'white' : color} strokeWidth={isSelected ? 2 * iz : 0} />
          <Text x={p.x - 4 * iz} y={p.y - 6 * iz} text="+" fill="white" fontSize={14 * iz} fontStyle="bold" />
        </Group>
      )
    }
    return null
  }

  // ─── Prévisualisation en cours de tracé ───────────────────────────────────
  const renderActive = () => {
    const tool = activeTool
    if (!['length', 'area', 'roof', 'subtract', 'wall'].includes(tool) || currentPoints.length === 0) return null
    const preview = mousePos ? [...currentPoints, mousePos] : currentPoints

    if (tool === 'length' || tool === 'roof' || tool === 'wall') {
      const flat = preview.flatMap(p => [p.x, p.y])
      const last = preview[preview.length - 1]
      const pixLen = polylineLength(preview.slice(0, -1))
      const { wallHeight } = useToolStore.getState()
      let label: string
      if (tool === 'wall' && calibration) {
        const perimeter = toRealUnit(pixLen, calibration)
        const area = perimeter * wallHeight
        label = `${area.toFixed(2)} ${getAreaUnit(calibration.unit)} (p=${perimeter.toFixed(2)})`
      } else {
        label = calibration
          ? `${toRealUnit(pixLen, calibration).toFixed(2)} ${calibration.unit}`
          : `${Math.round(pixLen)}px`
      }
      const previewColor = tool === 'wall' ? '#a855f7' : activeColor
      return (
        <Group>
          <Line points={flat} stroke={previewColor} strokeWidth={2} dash={[8, 4]} lineCap="round" />
          {currentPoints.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={4 * iz} fill={previewColor} />)}
          {last && <>
            <Rect x={last.x + 12 * iz} y={last.y - 14 * iz} width={label.length * 6.5 * iz + 8 * iz} height={16 * iz} fill="rgba(0,0,0,0.85)" cornerRadius={3 * iz} />
            <Text x={last.x + 14 * iz} y={last.y - 12 * iz} text={label} fill="white" fontSize={11 * iz} />
          </>}
        </Group>
      )
    }

    if (tool === 'area' || tool === 'subtract') {
      const flat = preview.flatMap(p => [p.x, p.y])
      const last = preview[preview.length - 1]
      const nearFirst = mousePos && currentPoints.length > 2 && distance(mousePos, currentPoints[0]) < 15
      const pixArea = preview.length >= 3 ? polygonArea(preview) : 0
      const aLabel = calibration && pixArea > 0
        ? `${tool === 'subtract' ? '−' : ''}${toRealUnit(toRealUnit(pixArea, calibration), calibration).toFixed(2)} ${getAreaUnit(calibration.unit)}`
        : null
      const previewColor = tool === 'subtract' ? '#ef4444' : activeColor
      return (
        <Group>
          <Line points={flat} stroke={previewColor} strokeWidth={2} dash={nearFirst ? undefined : [8, 4]}
            closed={!!nearFirst} fill={nearFirst ? previewColor + '22' : undefined} lineCap="round" />
          {currentPoints.map((p, i) => (
            <Circle key={i} x={p.x} y={p.y} radius={(i === 0 ? (nearFirst ? 7 : 5) : 4) * iz}
              fill={i === 0 && nearFirst ? 'white' : previewColor}
              stroke={i === 0 ? previewColor : undefined} strokeWidth={iz} />
          ))}
          {last && aLabel && <>
            <Rect x={last.x + 12 * iz} y={last.y - 14 * iz} width={aLabel.length * 7 * iz + 8 * iz} height={16 * iz} fill="rgba(0,0,0,0.85)" cornerRadius={3 * iz} />
            <Text x={last.x + 14 * iz} y={last.y - 12 * iz} text={aLabel} fill="white" fontSize={11 * iz} />
          </>}
        </Group>
      )
    }
    return null
  }

  // ─── Réticule de calibration ──────────────────────────────────────────────
  const renderCalibration = () => {
    if (activeTool !== 'calibrate' && calibPoints.length === 0) return null

    const sw   = 1 / z
    const arm  = 14 / z
    const gap  = 4 / z
    const dot  = 1.5 / z
    const ring = 10 / z
    const th   = 11 / z
    const to   = 14 / z

    const Reticule = ({ x, y }: { x: number; y: number }) => (
      <React.Fragment>
        <Line points={[x - arm - gap, y, x - gap, y]} stroke="#ef4444" strokeWidth={sw} />
        <Line points={[x + gap, y, x + arm + gap, y]} stroke="#ef4444" strokeWidth={sw} />
        <Line points={[x, y - arm - gap, x, y - gap]} stroke="#ef4444" strokeWidth={sw} />
        <Line points={[x, y + gap, x, y + arm + gap]} stroke="#ef4444" strokeWidth={sw} />
        <Circle x={x} y={y} radius={dot} fill="#ef4444" />
        <Circle x={x} y={y} radius={ring} stroke="#ef4444" strokeWidth={sw} fill="transparent" />
      </React.Fragment>
    )

    return (
      <Group>
        {calibPoints.length >= 1 && mousePos && (
          <Line points={[calibPoints[0].x, calibPoints[0].y, mousePos.x, mousePos.y]}
            stroke="#ef4444" strokeWidth={sw * 1.5} dash={[6 / z, 3 / z]} />
        )}
        {calibPoints.length === 2 && (
          <Line points={calibPoints.flatMap(p => [p.x, p.y])}
            stroke="#ef4444" strokeWidth={sw * 1.5} dash={[6 / z, 3 / z]} />
        )}
        {calibPoints.map((p, i) => <Reticule key={i} x={p.x} y={p.y} />)}
        {activeTool === 'calibrate' && mousePos && calibPoints.length < 2 && (
          <>
            <Reticule x={mousePos.x} y={mousePos.y} />
            <Text x={mousePos.x + to} y={mousePos.y - to}
              text={calibPoints.length === 0 ? 'Clic 1er point' : 'Clic 2ème point'}
              fill="#ef4444" fontSize={th} fontStyle="bold" />
          </>
        )}
      </Group>
    )
  }

  // ─── Légende flottante ────────────────────────────────────────────────────
  const renderLegend = () => {
    if (!legend.visible) return null
    if (legend.page !== currentPage) return null
    const visiblePostes = postes.filter(p => posteStats[p.id]?.count > 0)
    if (visiblePostes.length === 0) return null

    const DOT_W  = 18 * iz
    const NAME_W = 120 * iz
    const VAL_W  = 75 * iz
    const W      = DOT_W + NAME_W + VAL_W
    const ROW_H  = 14 * iz
    const HDR_H  = 14 * iz
    const H      = HDR_H + visiblePostes.length * ROW_H
    const x1     = DOT_W
    const x2     = DOT_W + NAME_W

    return (
      <Group
        x={legend.x} y={legend.y}
        draggable
        onDragEnd={(e: any) => setLegend({ x: e.target.x(), y: e.target.y() })}
      >
        <Rect width={W} height={H} fill="white" stroke="#6b7280" strokeWidth={iz} />
        <Rect width={W} height={HDR_H} fill="#d1d5db" />
        <Line points={[0, HDR_H, W, HDR_H]} stroke="#6b7280" strokeWidth={iz} />
        <Text x={x1 + 3 * iz} y={3 * iz} text="Désignation" fill="#374151" fontSize={8 * iz} fontStyle="bold" width={NAME_W - 4 * iz} />
        <Text x={x2 + 3 * iz} y={3 * iz} text="Total"        fill="#374151" fontSize={8 * iz} fontStyle="bold" width={VAL_W  - 4 * iz} />
        <Line points={[x1, 0, x1, H]} stroke="#9ca3af" strokeWidth={0.5 * iz} />
        <Line points={[x2, 0, x2, H]} stroke="#9ca3af" strokeWidth={0.5 * iz} />

        {visiblePostes.map((p, i) => {
          const s  = posteStats[p.id]
          const ry = HDR_H + i * ROW_H
          return (
            <Group key={p.id} y={ry}>
              {i % 2 !== 0 && <Rect width={W} height={ROW_H} fill="#f3f4f6" />}
              {i > 0 && <Line points={[0, 0, W, 0]} stroke="#e5e7eb" strokeWidth={0.5 * iz} />}
              <Circle x={DOT_W / 2} y={ROW_H / 2} radius={4 * iz} fill={p.color} />
              <Text x={x1 + 3 * iz} y={ROW_H / 2 - 4 * iz} text={p.name}
                fill="#111827" fontSize={8 * iz} width={NAME_W - 5 * iz} ellipsis />
              <Text x={x2 + 3 * iz} y={ROW_H / 2 - 4 * iz}
                text={`${s.total.toFixed(2)} ${s.unit}`}
                fill="#111827" fontSize={8 * iz} width={VAL_W - 5 * iz} />
            </Group>
          )
        })}
      </Group>
    )
  }

  return (
    <>
      {measurements.map(renderMeasurement)}
      {renderActive()}
      {renderCalibration()}
      {renderLegend()}
    </>
  )
}

export default DrawLayer
