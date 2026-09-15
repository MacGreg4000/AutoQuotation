import JSZip from 'jszip'
import type { Project } from '@/types'

const MPLAN_VERSION = '2.0'

export interface LoadResult {
  project: Project
  pdfBytes: Uint8Array | null
  pdfFileName: string | null
}

/** Nettoie un nom de projet pour en faire un nom de fichier valide (accents et espaces conservés). */
function toFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim()
  return `${cleaned || 'projet'}.mplan`
}

export async function saveProject(project: Project, pdfBytes: Uint8Array | null, pdfFileName: string | null): Promise<void> {
  const zip = new JSZip()
  zip.file('project.json', JSON.stringify({ version: MPLAN_VERSION, ...project }, null, 2))
  // byteLength > 0 : un buffer détaché par pdf.js ne doit jamais être écrit tel quel
  if (pdfBytes && pdfBytes.byteLength > 0 && pdfFileName) {
    zip.file('document.pdf', pdfBytes)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const suggestedName = toFileName(project.name)

  // Boîte de dialogue « Enregistrer sous » native (Electron, Chrome, Edge) :
  // l'utilisateur choisit où ranger son projet et le retrouve ensuite.
  const showSaveFilePicker = (window as any).showSaveFilePicker
  if (typeof showSaveFilePicker === 'function') {
    try {
      const handle = await showSaveFilePicker({
        suggestedName,
        types: [{ description: 'Projet MétréPlan', accept: { 'application/x-mplan': ['.mplan'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (err: any) {
      if (err?.name === 'AbortError') return // annulé par l'utilisateur
      console.warn('Dialogue natif indisponible, repli sur le téléchargement :', err)
    }
  }

  // Repli navigateur : téléchargement classique
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  a.click()
  // Révoquer trop tôt peut annuler le téléchargement sur certains navigateurs
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
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
