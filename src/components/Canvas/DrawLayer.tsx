import React from 'react'
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
  const { measurements, selectedMeasurementId, selectMeasurement, calibration } = useProjectStore()
  const { activeTool, activeColor } = useToolStore()
  const { currentPage, zoom } = usePdfStore()

  const renderMeasurement = (m: Measurement) => {
    if (!m.visible || m.page !== currentPage) return null
    const pts = m.points
    const isSelected = m.id === selectedMeasurementId
    const sw = isSelected ? 3 : 2

    if (m.type === 'length') {
      if (pts.length < 2) return null
      const flat = pts.flatMap(p => [p.x, p.y])
      const midIdx = Math.floor(pts.length / 2)
      const lx = (pts[midIdx].x + pts[Math.max(0, midIdx - 1)].x) / 2
      const ly = (pts[midIdx].y + pts[Math.max(0, midIdx - 1)].y) / 2
      const label = `${m.value.toFixed(2)} ${m.unit}`
      return (
        <Group key={m.id} onClick={() => selectMeasurement(m.id)}>
          <Line points={flat} stroke={m.color} strokeWidth={sw} lineCap="round" lineJoin="round" />
          {pts.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={isSelected ? 5 : 3} fill={m.color} />)}
          <Rect x={lx - 2} y={ly - 14} width={label.length * 7 + 8} height={16} fill="rgba(0,0,0,0.75)" cornerRadius={3} />
          <Text x={lx} y={ly - 12} text={label} fill="white" fontSize={11} fontStyle="bold" />
        </Group>
      )
    }

    if (m.type === 'area' || m.type === 'roof') {
      if (pts.length < 3) return null
      const flat = [...pts.flatMap(p => [p.x, p.y]), pts[0].x, pts[0].y]
      const c = polygonCentroid(pts)
      const label = `${m.value.toFixed(2)} ${m.unit}`
      const lw = label.length * 7 + 8
      return (
        <Group key={m.id} onClick={() => selectMeasurement(m.id)}>
          <Line points={flat} stroke={m.color} strokeWidth={sw} closed fill={m.color + (isSelected ? '44' : '22')} lineCap="round" lineJoin="round" />
          <Rect x={c.x - lw / 2} y={c.y - 14} width={lw} height={m.type === 'roof' ? 30 : 16} fill="rgba(0,0,0,0.75)" cornerRadius={3} />
          <Text x={c.x - lw / 2 + 4} y={c.y - 12} text={label} fill="white" fontSize={11} fontStyle="bold" />
          {m.type === 'roof' && m.slopeFactor && (
            <Text x={c.x - lw / 2 + 4} y={c.y + 4} text={`pente \u00d7${m.slopeFactor.toFixed(3)}`} fill="#fbbf24" fontSize={9} />
          )}
        </Group>
      )
    }

    if (m.type === 'count') {
      const p = pts[0]
      if (!p) return null
      return (
        <Group key={m.id} onClick={() => selectMeasurement(m.id)}>
          <Circle x={p.x} y={p.y} radius={9} fill={m.color} stroke={isSelected ? 'white' : m.color} strokeWidth={isSelected ? 2 : 0} />
          <Text x={p.x - 4} y={p.y - 6} text="+" fill="white" fontSize={14} fontStyle="bold" />
        </Group>
      )
    }
    return null
  }

  const renderActive = () => {
    const tool = activeTool
    if (!['length', 'area', 'roof'].includes(tool) || currentPoints.length === 0) return null
    const preview = mousePos ? [...currentPoints, mousePos] : currentPoints

    if (tool === 'length' || tool === 'roof') {
      const flat = preview.flatMap(p => [p.x, p.y])
      const last = preview[preview.length - 1]
      const pixLen = polylineLength(preview.slice(0, -1))
      const label = calibration
        ? `${toRealUnit(pixLen, calibration).toFixed(2)} ${calibration.unit}`
        : `${Math.round(pixLen)}px`
      return (
        <Group>
          <Line points={flat} stroke={activeColor} strokeWidth={2} dash={[8, 4]} lineCap="round" />
          {currentPoints.map((p, i) => <Circle key={i} x={p.x} y={p.y} radius={4} fill={activeColor} />)}
          {last && <>
            <Rect x={last.x + 12} y={last.y - 14} width={label.length * 7 + 8} height={16} fill="rgba(0,0,0,0.85)" cornerRadius={3} />
            <Text x={last.x + 14} y={last.y - 12} text={label} fill="white" fontSize={11} />
          </>}
        </Group>
      )
    }

    if (tool === 'area') {
      const flat = preview.flatMap(p => [p.x, p.y])
      const last = preview[preview.length - 1]
      const nearFirst = mousePos && currentPoints.length > 2 && distance(mousePos, currentPoints[0]) < 15
      const pixArea = preview.length >= 3 ? polygonArea(preview) : 0
      const aLabel = calibration && pixArea > 0
        ? `${toRealUnit(toRealUnit(pixArea, calibration), calibration).toFixed(2)} ${getAreaUnit(calibration.unit)}`
        : null
      return (
        <Group>
          <Line points={flat} stroke={activeColor} strokeWidth={2} dash={nearFirst ? undefined : [8, 4]}
            closed={!!nearFirst} fill={nearFirst ? activeColor + '22' : undefined} lineCap="round" />
          {currentPoints.map((p, i) => (
            <Circle key={i} x={p.x} y={p.y} radius={i === 0 ? (nearFirst ? 7 : 5) : 4}
              fill={i === 0 && nearFirst ? 'white' : activeColor}
              stroke={i === 0 ? activeColor : undefined} strokeWidth={1} />
          ))}
          {last && aLabel && <>
            <Rect x={last.x + 12} y={last.y - 14} width={aLabel.length * 7 + 8} height={16} fill="rgba(0,0,0,0.85)" cornerRadius={3} />
            <Text x={last.x + 14} y={last.y - 12} text={aLabel} fill="white" fontSize={11} />
          </>}
        </Group>
      )
    }
    return null
  }

  const renderCalibration = () => {
    if (activeTool !== 'calibrate' && calibPoints.length === 0) return null

    // Tailles constantes en pixels écran, compensées par le zoom
    const z = Math.max(zoom, 0.1)
    const sw   = 1 / z       // trait 1px écran
    const arm  = 14 / z      // longueur bras 14px écran
    const gap  = 4 / z       // gap central 4px écran (on voit le point exact)
    const dot  = 1.5 / z     // point central 1.5px écran
    const ring = 10 / z      // rayon cercle extérieur 10px écran
    const th   = 11 / z      // taille texte
    const to   = 14 / z      // offset texte

    // Réticule de précision : croix avec gap + mini point central + cercle extérieur
    const Reticule = ({ x, y }: { x: number; y: number }) => (
      <React.Fragment>
        {/* Bras horizontaux */}
        <Line points={[x - arm - gap, y, x - gap, y]} stroke="#ef4444" strokeWidth={sw} />
        <Line points={[x + gap, y, x + arm + gap, y]} stroke="#ef4444" strokeWidth={sw} />
        {/* Bras verticaux */}
        <Line points={[x, y - arm - gap, x, y - gap]} stroke="#ef4444" strokeWidth={sw} />
        <Line points={[x, y + gap, x, y + arm + gap]} stroke="#ef4444" strokeWidth={sw} />
        {/* Point central minuscule */}
        <Circle x={x} y={y} radius={dot} fill="#ef4444" />
        {/* Cercle extérieur léger */}
        <Circle x={x} y={y} radius={ring} stroke="#ef4444" strokeWidth={sw} fill="transparent" />
      </React.Fragment>
    )

    return (
      <Group>
        {/* Ligne entre les deux points */}
        {calibPoints.length >= 1 && mousePos && (
          <Line
            points={[calibPoints[0].x, calibPoints[0].y, mousePos.x, mousePos.y]}
            stroke="#ef4444" strokeWidth={sw * 1.5} dash={[6 / z, 3 / z]}
          />
        )}
        {calibPoints.length === 2 && (
          <Line
            points={calibPoints.flatMap(p => [p.x, p.y])}
            stroke="#ef4444" strokeWidth={sw * 1.5} dash={[6 / z, 3 / z]}
          />
        )}

        {/* Points posés */}
        {calibPoints.map((p, i) => <Reticule key={i} x={p.x} y={p.y} />)}

        {/* Curseur actif (souris) */}
        {activeTool === 'calibrate' && mousePos && calibPoints.length < 2 && (
          <>
            <Reticule x={mousePos.x} y={mousePos.y} />
            <Text
              x={mousePos.x + to} y={mousePos.y - to}
              text={calibPoints.length === 0 ? 'Clic 1er point' : 'Clic 2ème point'}
              fill="#ef4444" fontSize={th} fontStyle="bold"
            />
          </>
        )}
      </Group>
    )
  }

  return (
    <>
      {measurements.map(renderMeasurement)}
      {renderActive()}
      {renderCalibration()}
    </>
  )
}

export default DrawLayer
