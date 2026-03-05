import * as XLSX from 'xlsx'
import type { Project, Measurement, MeasurementType } from '@/types'

const TYPE_LABELS: Record<MeasurementType, string> = {
  length: 'Longueur',
  area: 'Surface',
  count: 'Compteur',
  roof: 'Toiture',
}

export function exportExcel(project: Project) {
  const wb = XLSX.utils.book_new()

  // ─── Sheet 0: Bordereau de métrés (if postes exist) ──────────────────────
  if (project.postes && project.postes.length > 0) {
    const bordereauRows: (string | number)[][] = [
      [`Bordereau de métrés — ${project.name}`],
      ['Projet:', project.name],
      ['Date:', new Date().toLocaleDateString('fr-FR')],
      [],
      ['Désignation', 'Unité', 'Total', 'Nb mesures', 'Détail (mesures)'],
    ]

    for (const poste of project.postes) {
      const assigned = project.measurements.filter(m => m.posteId === poste.id)
      const total = assigned.reduce((sum, m) => sum + m.value, 0)
      const unit = assigned[0]?.unit ?? '—'
      const detail = assigned.map(m => `${m.name}: ${m.value.toFixed(3)} ${m.unit} (p.${m.page})`).join(' | ')
      bordereauRows.push([poste.name, unit, parseFloat(total.toFixed(3)), assigned.length, detail])
    }

    // Unassigned measurements note
    const unassigned = project.measurements.filter(m => !m.posteId)
    if (unassigned.length > 0) {
      bordereauRows.push([])
      bordereauRows.push([`${unassigned.length} mesure(s) non assignée(s) à un poste`, '', '', '', ''])
    }

    const wsBordereau = XLSX.utils.aoa_to_sheet(bordereauRows)
    wsBordereau['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, wsBordereau, 'Bordereau')
  }

  // ─── Sheet 1: Summary ─────────────────────────────────────────────────────
  const totals: Record<string, { type: string; unit: string; total: number; count: number }> = {}
  for (const m of project.measurements) {
    const key = m.type === 'count' ? `count:${m.name}` : m.type
    if (!totals[key]) totals[key] = { type: TYPE_LABELS[m.type], unit: m.unit, total: 0, count: 0 }
    totals[key].total += m.value
    totals[key].count++
  }

  const summaryData = [
    ['MétréPlan — Résumé du projet'],
    ['Projet:', project.name],
    ['Date:', new Date().toLocaleDateString('fr-FR')],
    ['Fichier PDF:', project.pdfFileName],
    ['Calibration:', project.calibration
      ? `1px = ${project.calibration.ratio.toFixed(5)} ${project.calibration.unit}`
      : 'Non calibré'],
    [],
    ['Type', 'Sous-type', 'Quantité', 'Total', 'Unité'],
    ...Object.entries(totals).map(([key, t]) => [
      t.type,
      key.includes(':') ? key.split(':')[1] : '',
      t.count,
      t.type === 'Compteur' ? t.count : t.total.toFixed(3),
      t.type === 'Compteur' ? 'unités' : t.unit,
    ]),
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData)
  wsSummary['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Résumé')

  // ─── Sheet 2: All measurements ────────────────────────────────────────────
  const allData = [
    ['ID', 'Nom', 'Type', 'Page', 'Valeur', 'Unité', 'Poste', 'Pente', 'Note'],
    ...project.measurements.map(m => {
      const posteName = project.postes?.find(p => p.id === m.posteId)?.name ?? ''
      return [
        m.id, m.name, TYPE_LABELS[m.type], m.page,
        m.type === 'count' ? 1 : m.value, m.unit,
        posteName,
        m.slopeFactor ? `×${m.slopeFactor.toFixed(4)}` : '',
        m.note || '',
      ]
    }),
  ]
  const wsAll = XLSX.utils.aoa_to_sheet(allData)
  wsAll['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 10 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, wsAll, 'Toutes les mesures')

  // ─── One sheet per page ───────────────────────────────────────────────────
  const pages = [...new Set(project.measurements.map(m => m.page))].sort()
  for (const page of pages) {
    const pageMeasurements = project.measurements.filter(m => m.page === page)
    const pageData = [
      [`Page ${page}`],
      ['Nom', 'Type', 'Valeur', 'Unité', 'Poste', 'Pente'],
      ...pageMeasurements.map(m => {
        const posteName = project.postes?.find(p => p.id === m.posteId)?.name ?? ''
        return [
          m.name, TYPE_LABELS[m.type], m.type === 'count' ? 1 : m.value,
          m.unit, posteName, m.slopeFactor ? `×${m.slopeFactor.toFixed(4)}` : '',
        ]
      }),
    ]
    const wsPage = XLSX.utils.aoa_to_sheet(pageData)
    wsPage['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsPage, `Page ${page}`)
  }

  // ─── Metadata ─────────────────────────────────────────────────────────────
  const metaData = [
    ['Métadonnées'],
    ['Généré par', 'MétréPlan'],
    ['Date export', new Date().toISOString()],
    ['Projet', project.name],
    ['Calibration ratio', project.calibration?.ratio ?? 'N/A'],
    ['Calibration unité', project.calibration?.unit ?? 'N/A'],
    ['Nombre de mesures', project.measurements.length],
    ['Nombre de postes', project.postes?.length ?? 0],
    ['Nombre de pages', pages.length],
  ]
  const wsMeta = XLSX.utils.aoa_to_sheet(metaData)
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Métadonnées')

  XLSX.writeFile(wb, `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_métré.xlsx`)
}
