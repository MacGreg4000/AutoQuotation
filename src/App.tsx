import React, { useEffect } from 'react'
import Header from './components/Header/Header'
import Toolbar from './components/Toolbar/Toolbar'
import CanvasArea from './components/Canvas/CanvasArea'
import RightPanel from './components/RightPanel/RightPanel'
import CalibrationModal from './components/Modals/CalibrationModal'
import { useProjectStore } from './store/useProjectStore'
import { saveProject } from './lib/projectStorage'
import { usePdfStore } from './store/usePdfStore'

function App() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const inInput = ['input', 'textarea', 'select'].includes(
        (e.target as Element)?.tagName?.toLowerCase()
      )
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !inInput) {
        e.preventDefault()
        const project = {
          ...useProjectStore.getState().getProject(),
          pdfFileName: usePdfStore.getState().pdfFileName,
        }
        saveProject(project)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o' && !inInput) {
        e.preventDefault()
        window.dispatchEvent(new Event('open-pdf'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-950">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Toolbar />
        <CanvasArea />
        <RightPanel />
      </div>
      <CalibrationModal />
    </div>
  )
}

export default App
