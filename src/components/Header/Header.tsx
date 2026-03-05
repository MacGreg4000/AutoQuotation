import React from 'react'
import { usePdfStore } from '@/store/usePdfStore'
import { useProjectStore } from '@/store/useProjectStore'
import {
  ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight,
  FolderOpen, Save, Download, FileText, RotateCcw, RotateCw,
  Ruler
} from 'lucide-react'
import clsx from 'clsx'
import { exportExcel } from '@/lib/exportExcel'
import { exportPdf } from '@/lib/exportPdf'
import { saveProject, loadProject } from '@/lib/projectStorage'

const Header: React.FC = () => {
  const { pdfDocument, currentPage, totalPages, setCurrentPage, zoom, pdfFileName } = usePdfStore()
  const { calibration, measurements, projectName, setProjectName, canUndo, canRedo, undo, redo, getProject } = useProjectStore()

  const handleZoomIn = () => window.dispatchEvent(new Event('zoom-in'))
  const handleZoomOut = () => window.dispatchEvent(new Event('zoom-out'))
  const handleZoomFit = () => window.dispatchEvent(new Event('zoom-fit'))
  const handleOpenPdf = () => window.dispatchEvent(new Event('open-pdf'))

  const buildProject = () => ({ ...getProject(), pdfFileName })

  const handleSave = async () => {
    await saveProject(buildProject())
  }

  const handleLoad = async () => {
    const project = await loadProject()
    if (project) {
      useProjectStore.getState().loadProject(project)
    }
  }

  const handleExportExcel = async () => {
    await exportExcel(buildProject())
  }

  const handleExportPdf = () => {
    exportPdf(buildProject())
  }

  const calibStatus = calibration
    ? { label: `1px = ${calibration.ratio.toFixed(4)} ${calibration.unit}`, ok: true }
    : { label: 'Non calibré', ok: false }

  return (
    <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4 shrink-0 select-none">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <Ruler size={20} className="text-blue-400" />
        <span className="font-bold text-white text-sm tracking-wide">MétréPlan</span>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-gray-700" />

      {/* Project name */}
      <input
        className="bg-transparent text-gray-200 text-sm font-medium outline-none border-b border-transparent hover:border-gray-600 focus:border-blue-500 transition-colors px-1 min-w-0 max-w-48"
        value={projectName}
        onChange={e => setProjectName(e.target.value)}
        title="Nom du projet"
      />

      {/* Divider */}
      <div className="h-6 w-px bg-gray-700" />

      {/* File actions */}
      <div className="flex items-center gap-1">
        <HeaderBtn onClick={handleOpenPdf} title="Ouvrir un PDF (Ctrl+O)">
          <FolderOpen size={15} />
          <span className="text-xs">Ouvrir</span>
        </HeaderBtn>
        <HeaderBtn onClick={handleSave} title="Sauvegarder le projet (Ctrl+S)">
          <Save size={15} />
        </HeaderBtn>
        <HeaderBtn onClick={handleLoad} title="Charger un projet .mplan">
          <FileText size={15} />
        </HeaderBtn>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-gray-700" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <HeaderBtn onClick={undo} disabled={!canUndo()} title="Annuler (Ctrl+Z)">
          <RotateCcw size={15} />
        </HeaderBtn>
        <HeaderBtn onClick={redo} disabled={!canRedo()} title="Refaire (Ctrl+Y)">
          <RotateCw size={15} />
        </HeaderBtn>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-gray-700" />

      {/* Page navigation */}
      {pdfDocument && (
        <div className="flex items-center gap-2">
          <HeaderBtn onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1}>
            <ChevronLeft size={15} />
          </HeaderBtn>
          <span className="text-xs text-gray-300 whitespace-nowrap">
            Page {currentPage} / {totalPages}
          </span>
          <HeaderBtn onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages}>
            <ChevronRight size={15} />
          </HeaderBtn>
        </div>
      )}

      {/* Zoom controls */}
      {pdfDocument && (
        <>
          <div className="h-6 w-px bg-gray-700" />
          <div className="flex items-center gap-1">
            <HeaderBtn onClick={handleZoomOut} title="Zoom -">
              <ZoomOut size={15} />
            </HeaderBtn>
            <span className="text-xs text-gray-300 w-14 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <HeaderBtn onClick={handleZoomIn} title="Zoom +">
              <ZoomIn size={15} />
            </HeaderBtn>
            <HeaderBtn onClick={handleZoomFit} title="Ajuster">
              <Maximize2 size={14} />
            </HeaderBtn>
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* PDF file name */}
      {pdfFileName && (
        <span className="text-xs text-gray-500 truncate max-w-48" title={pdfFileName}>
          {pdfFileName}
        </span>
      )}

      {/* Calibration status */}
      <div className={clsx(
        'flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium',
        calibStatus.ok
          ? 'bg-green-900/50 text-green-400 border border-green-800'
          : 'bg-red-900/50 text-red-400 border border-red-800'
      )}>
        <div className={clsx('w-1.5 h-1.5 rounded-full', calibStatus.ok ? 'bg-green-400' : 'bg-red-400')} />
        {calibStatus.label}
      </div>

      {/* Export */}
      {measurements.length > 0 && (
        <>
          <div className="h-6 w-px bg-gray-700" />
          <div className="flex items-center gap-1">
            <HeaderBtn onClick={handleExportExcel} title="Exporter Excel (.xlsx)">
              <Download size={15} />
              <span className="text-xs">Excel</span>
            </HeaderBtn>
            <HeaderBtn onClick={handleExportPdf} title="Exporter rapport PDF">
              <FileText size={15} />
              <span className="text-xs">PDF</span>
            </HeaderBtn>
          </div>
        </>
      )}
    </header>
  )
}

const HeaderBtn: React.FC<{
  onClick?: () => void
  disabled?: boolean
  title?: string
  children: React.ReactNode
}> = ({ onClick, disabled, title, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={clsx(
      'flex items-center gap-1 px-2 py-1 rounded text-gray-300 text-xs transition-colors',
      disabled
        ? 'opacity-30 cursor-not-allowed'
        : 'hover:bg-gray-700 hover:text-white cursor-pointer'
    )}
  >
    {children}
  </button>
)

export default Header
