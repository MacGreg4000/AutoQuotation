import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useProjectStore, nextPosteColor } from '@/store/useProjectStore'
import { usePdfStore } from '@/store/usePdfStore'
import type { Measurement, MeasurementType, Poste } from '@/types'
import {
  Eye, EyeOff, Trash2, Ruler, Square, Hash, Home, Plus,
  ChevronRight, ChevronDown, Target, SquareMinus, Building2, AlertTriangle,
} from 'lucide-react'
import clsx from 'clsx'
import { nanoid } from '@/lib/nanoid'

const TYPE_ICONS: Record<MeasurementType, React.ReactNode> = {
  length: <Ruler size={12} />,
  area: <Square size={12} />,
  count: <Hash size={12} />,
  roof: <Home size={12} />,
  subtract: <SquareMinus size={12} />,
  wall: <Building2 size={12} />,
}

/** Totaux regroupés par unité — évite d'additionner des m et des m². */
function totalsByUnit(items: Measurement[]): { unit: string; total: number }[] {
  const acc: Record<string, number> = {}
  for (const m of items) {
    if (m.type === 'count') continue
    acc[m.unit] = (acc[m.unit] ?? 0) + m.value
  }
  return Object.entries(acc).map(([unit, total]) => ({ unit, total }))
}

// ─── Ligne mesure ────────────────────────────────────────────────────────────

const MeasurementRow: React.FC<{
  measurement: Measurement
  isSelected: boolean
  showPage: boolean
  /** Postes proposés dans le menu de (ré)assignation. */
  assignablePostes: Poste[]
  onSelect: () => void
  onDelete: () => void
  onToggleVisibility: () => void
  /** posteId vide = retirer la mesure de son poste. */
  onAssign: (posteId: string | undefined) => void
}> = ({ measurement: m, isSelected, showPage, assignablePostes, onSelect, onDelete, onToggleVisibility, onAssign }) => (
  <div
    className={clsx(
      'flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group',
      isSelected ? 'bg-blue-900/50 border border-blue-700' : 'hover:bg-gray-800 border border-transparent',
      !m.visible && 'opacity-50'
    )}
    onClick={onSelect}
  >
    <span className="text-gray-500 shrink-0">{TYPE_ICONS[m.type]}</span>

    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-gray-200 truncate">{m.name}</p>
      <p className="text-xs text-gray-500">
        {m.type === 'count' ? '1 unité' : `${m.value.toFixed(2)} ${m.unit}`}
        {m.type === 'roof' && m.slopeFactor && (
          <span className="text-orange-400 ml-1">×{m.slopeFactor.toFixed(3)}</span>
        )}
        {showPage && <span className="text-gray-600 ml-1">· p.{m.page}</span>}
      </p>

      {assignablePostes.length > 0 && (
        <select
          className={clsx(
            'mt-1 w-full rounded px-1 py-0.5 text-xs outline-none focus:border-blue-500 border',
            m.posteId
              ? 'bg-gray-800/60 border-gray-700/70 text-gray-400'
              : 'bg-amber-900/30 border-amber-700/60 text-amber-300'
          )}
          value={m.posteId ?? ''}
          onClick={e => e.stopPropagation()}
          onChange={e => onAssign(e.target.value || undefined)}
          title="Changer le poste de cette mesure"
        >
          <option value="">— Aucun poste —</option>
          {assignablePostes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
    </div>

    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <button onClick={e => { e.stopPropagation(); onToggleVisibility() }}
        className="p-0.5 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300"
        title={m.visible ? 'Masquer sur le plan' : 'Afficher sur le plan'}>
        {m.visible ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>
      <button onClick={e => { e.stopPropagation(); onDelete() }}
        className="p-0.5 rounded hover:bg-red-900 text-gray-500 hover:text-red-400" title="Supprimer la mesure">
        <Trash2 size={12} />
      </button>
    </div>
  </div>
)

// ─── Bloc poste (dépliable) ──────────────────────────────────────────────────

const PosteBlock: React.FC<{
  poste: Poste
  items: Measurement[]
  isActive: boolean
  showPage: boolean
  onToggleActive: () => void
  onRename: (name: string) => void
  onDelete: () => void
}> = ({ poste, items, isActive, showPage, onToggleActive, onRename, onDelete }) => {
  const { postes, selectedMeasurementId, selectMeasurement, deleteMeasurement, toggleMeasurementVisibility, updateMeasurement } = useProjectStore()
  const { setCurrentPage } = usePdfStore()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(poste.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const commitEdit = () => {
    const trimmed = editVal.trim()
    if (trimmed) onRename(trimmed)
    else setEditVal(poste.name)
    setEditing(false)
  }

  const totals = totalsByUnit(items)
  const countOnly = items.filter(m => m.type === 'count').length

  const handleSelect = (m: Measurement) => {
    selectMeasurement(m.id === selectedMeasurementId ? null : m.id)
    setCurrentPage(m.page)
  }

  return (
    <div className={clsx(
      'rounded-xl transition-all border overflow-hidden',
      isActive ? 'bg-blue-900/30 border-blue-600 shadow-sm shadow-blue-900' : 'bg-gray-800/50 border-gray-800 hover:border-gray-700'
    )}>
      <div className="flex items-center gap-2 p-2.5">
        {/* Pastille couleur = activer le poste */}
        <button
          onClick={onToggleActive}
          className={clsx(
            'w-8 h-8 rounded-lg shrink-0 flex items-center justify-center transition-all',
            isActive ? 'ring-2 ring-blue-400 scale-110' : 'hover:scale-105'
          )}
          style={{ backgroundColor: poste.color }}
          title={isActive ? 'Désactiver ce poste' : 'Activer ce poste (les mesures iront ici)'}
        >
          {isActive && <Target size={14} className="text-white" />}
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              className="w-full bg-gray-700 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white outline-none"
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') { setEditVal(poste.name); setEditing(false) }
              }}
            />
          ) : (
            <p className="text-xs font-semibold text-gray-100 truncate cursor-text"
              onDoubleClick={() => { setEditVal(poste.name); setEditing(true) }}
              title="Double-clic pour renommer">
              {poste.name}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">
            {items.length === 0
              ? <span className="italic">Aucune mesure assignée</span>
              : <>
                  {totals.map(t => (
                    <span key={t.unit} className="mr-2">
                      <span className="text-white font-semibold">{t.total.toFixed(2)}</span> {t.unit}
                    </span>
                  ))}
                  {countOnly > 0 && <span className="mr-2"><span className="text-white font-semibold">{countOnly}</span> u.</span>}
                  <span className="text-gray-600">({items.length})</span>
                </>
            }
          </p>
        </div>

        {items.length > 0 && (
          <button onClick={() => setExpanded(v => !v)}
            className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 shrink-0"
            title={expanded ? 'Masquer le détail' : 'Voir le détail des mesures'}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        <button onClick={onDelete}
          className="p-1 rounded hover:bg-red-900 text-gray-600 hover:text-red-400 transition-colors shrink-0"
          title="Supprimer ce poste">
          <Trash2 size={13} />
        </button>
      </div>

      {isActive && (
        <p className="text-xs text-blue-400 px-2.5 pb-2 flex items-center gap-1">
          <Target size={10} /> Poste actif — les prochaines mesures arrivent ici
        </p>
      )}

      {expanded && items.length > 0 && (
        <div className="px-1.5 pb-1.5 space-y-0.5 border-t border-gray-800/80 pt-1.5">
          {items.map(m => (
            <MeasurementRow
              key={m.id}
              measurement={m}
              isSelected={m.id === selectedMeasurementId}
              showPage={showPage}
              assignablePostes={postes}
              onSelect={() => handleSelect(m)}
              onDelete={() => deleteMeasurement(m.id)}
              onToggleVisibility={() => toggleMeasurementVisibility(m.id)}
              onAssign={posteId => updateMeasurement(m.id, { posteId })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Bloc « non assignées » ──────────────────────────────────────────────────

const UnassignedBlock: React.FC<{ items: Measurement[]; postes: Poste[]; showPage: boolean }> = ({ items, postes, showPage }) => {
  const { selectedMeasurementId, selectMeasurement, deleteMeasurement, toggleMeasurementVisibility, updateMeasurement } = useProjectStore()
  const { setCurrentPage } = usePdfStore()
  const [expanded, setExpanded] = useState(true)

  if (items.length === 0) return null

  return (
    <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 overflow-hidden">
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center gap-2 p-2.5 text-left">
        <span className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-amber-900/50">
          <AlertTriangle size={14} className="text-amber-400" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-300">Non assignées</p>
          <p className="text-xs text-amber-600/90 mt-0.5">
            {items.length} mesure{items.length > 1 ? 's' : ''} hors devis
          </p>
        </div>
        {expanded ? <ChevronDown size={14} className="text-amber-500 shrink-0" /> : <ChevronRight size={14} className="text-amber-500 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-1.5 pb-1.5 space-y-0.5 border-t border-amber-900/40 pt-1.5">
          {items.map(m => (
            <MeasurementRow
              key={m.id}
              measurement={m}
              isSelected={m.id === selectedMeasurementId}
              showPage={showPage}
              assignablePostes={postes}
              onSelect={() => { selectMeasurement(m.id === selectedMeasurementId ? null : m.id); setCurrentPage(m.page) }}
              onDelete={() => deleteMeasurement(m.id)}
              onToggleVisibility={() => toggleMeasurementVisibility(m.id)}
              onAssign={posteId => updateMeasurement(m.id, { posteId })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Panneau Métré ───────────────────────────────────────────────────────────

const MetrePanel: React.FC = () => {
  const { postes, activePosteId, measurements, addPoste, updatePoste, deletePoste, setActivePosteId } = useProjectStore()
  const { totalPages } = usePdfStore()
  const showPage = totalPages > 1

  const handleAddPoste = () => {
    const newPoste: Poste = { id: nanoid(), name: 'Nouveau poste', color: nextPosteColor(postes) }
    addPoste(newPoste)
    setActivePosteId(newPoste.id)
  }

  const byPoste = useMemo(() => {
    const map: Record<string, Measurement[]> = {}
    for (const p of postes) map[p.id] = []
    const orphans: Measurement[] = []
    for (const m of measurements) {
      if (m.posteId && map[m.posteId]) map[m.posteId].push(m)
      else orphans.push(m)
    }
    return { map, orphans }
  }, [postes, measurements])

  const isEmpty = postes.length === 0 && measurements.length === 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-800 shrink-0">
        <button onClick={handleAddPoste}
          className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Nouveau poste
        </button>
      </div>

      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-gray-600">
            <Target size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucun poste</p>
            <p className="text-xs mt-1 leading-relaxed">Créez un poste, activez-le,<br />puis mesurez sur le plan</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {postes.map(poste => (
            <PosteBlock
              key={poste.id}
              poste={poste}
              items={byPoste.map[poste.id] ?? []}
              isActive={activePosteId === poste.id}
              showPage={showPage}
              onToggleActive={() => setActivePosteId(activePosteId === poste.id ? null : poste.id)}
              onRename={name => updatePoste(poste.id, { name })}
              onDelete={() => deletePoste(poste.id)}
            />
          ))}
          <UnassignedBlock items={byPoste.orphans} postes={postes} showPage={showPage} />
        </div>
      )}

      {/* Total global */}
      {measurements.length > 0 && (
        <div className="p-3 border-t border-gray-800 shrink-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Total global devis</p>
          {postes.map(p => {
            const items = byPoste.map[p.id] ?? []
            if (items.length === 0) return null
            const totals = totalsByUnit(items)
            const countOnly = items.filter(m => m.type === 'count').length
            return (
              <div key={p.id} className="flex justify-between items-start text-xs py-0.5 gap-2">
                <span className="text-gray-400 flex items-center gap-1.5 min-w-0">
                  <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="truncate">{p.name}</span>
                </span>
                <span className="font-semibold text-white text-right shrink-0">
                  {totals.map(t => <span key={t.unit} className="ml-1.5">{t.total.toFixed(2)} {t.unit}</span>)}
                  {countOnly > 0 && <span className="ml-1.5">{countOnly} u.</span>}
                </span>
              </div>
            )
          })}
          {byPoste.orphans.length > 0 && (
            <div className="flex justify-between text-xs py-0.5 mt-1 pt-1 border-t border-gray-800/80">
              <span className="text-amber-500/90 flex items-center gap-1.5">
                <AlertTriangle size={10} /> Non assignées
              </span>
              <span className="font-semibold text-amber-400">{byPoste.orphans.length}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Panneau principal ───────────────────────────────────────────────────────

const MIN_WIDTH = 200
const MAX_WIDTH = 700
const DEFAULT_WIDTH = 288

const RightPanel: React.FC = () => {
  const { postes, activePosteId } = useProjectStore()

  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const isResizing = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    startX.current = e.clientX
    startWidth.current = panelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [panelWidth])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const delta = startX.current - e.clientX   // dragging left → wider
      const newWidth = Math.min(Math.max(startWidth.current + delta, MIN_WIDTH), MAX_WIDTH)
      setPanelWidth(newWidth)
    }
    const onMouseUp = () => {
      if (!isResizing.current) return
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div
      className="relative bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 overflow-hidden"
      style={{ width: panelWidth }}
    >
      {/* Poignée de redimensionnement (bord gauche) */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 z-10 cursor-col-resize group flex items-center justify-center"
        onMouseDown={onResizeStart}
        title="Glisser pour redimensionner"
      >
        <div className="w-px h-full bg-gray-800 group-hover:bg-blue-500/60 transition-colors" />
        <div className="absolute top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-1 rounded-full bg-blue-400" />
          <div className="w-1 h-1 rounded-full bg-blue-400" />
          <div className="w-1 h-1 rounded-full bg-blue-400" />
        </div>
      </div>

      {/* En-tête */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-800 shrink-0 pl-4">
        <span className="text-xs font-semibold text-white">Métré</span>
        {activePosteId
          ? <span className="w-2 h-2 rounded-full bg-blue-500" title="Un poste est actif" />
          : postes.length > 0 && <span className="text-gray-600 text-[10px]">{postes.length} poste{postes.length > 1 ? 's' : ''}</span>}
      </div>

      <MetrePanel />
    </div>
  )
}

export default RightPanel
