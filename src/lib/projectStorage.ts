import type { Project } from '@/types'

const MPLAN_VERSION = '1.0'

export async function saveProject(project: Project): Promise<void> {
  const payload = JSON.stringify({ version: MPLAN_VERSION, ...project }, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.mplan`
  a.click()
  URL.revokeObjectURL(url)
}

export async function loadProject(): Promise<Project | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.mplan,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const text = await file.text()
      try {
        const data = JSON.parse(text)
        // Strip version field if present
        const { version: _, ...project } = data
        resolve(project as Project)
      } catch {
        alert('Fichier .mplan invalide.')
        resolve(null)
      }
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}
