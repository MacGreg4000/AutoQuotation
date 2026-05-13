import JSZip from 'jszip'
import type { Project } from '@/types'

const MPLAN_VERSION = '2.0'

export interface LoadResult {
  project: Project
  pdfBytes: Uint8Array | null
  pdfFileName: string | null
}

export async function saveProject(project: Project, pdfBytes: Uint8Array | null, pdfFileName: string | null): Promise<void> {
  const zip = new JSZip()
  zip.file('project.json', JSON.stringify({ version: MPLAN_VERSION, ...project }, null, 2))
  if (pdfBytes && pdfFileName) {
    zip.file('document.pdf', pdfBytes)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.mplan`
  a.click()
  URL.revokeObjectURL(url)
}

export async function loadProject(): Promise<LoadResult | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mplan,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      try {
        const arrayBuf = await file.arrayBuffer()
        const uint8 = new Uint8Array(arrayBuf)
        // ZIP magic bytes: PK (0x50 0x4B)
        if (uint8[0] === 0x50 && uint8[1] === 0x4B) {
          const zip = await JSZip.loadAsync(arrayBuf)
          const projectEntry = zip.file('project.json')
          if (!projectEntry) throw new Error('project.json manquant dans le fichier .mplan')
          const projectJson = await projectEntry.async('string')
          const { version: _, ...project } = JSON.parse(projectJson)
          const pdfEntry = zip.file('document.pdf')
          const pdfBytes = pdfEntry ? await pdfEntry.async('uint8array') : null
          const pdfFileName = pdfBytes ? (project.pdfFileName || 'document.pdf') : null
          resolve({ project: project as Project, pdfBytes, pdfFileName })
        } else {
          // Ancien format JSON — compatibilité ascendante
          const text = new TextDecoder().decode(uint8)
          const { version: _, ...project } = JSON.parse(text)
          resolve({ project: project as Project, pdfBytes: null, pdfFileName: null })
        }
      } catch {
        alert('Fichier .mplan invalide.')
        resolve(null)
      }
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}
