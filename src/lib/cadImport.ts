/**
 * Import de plans CAO (DWG / DXF).
 *
 * La conversion produit un PDF, qui est ensuite confié au circuit d'import
 * existant : mesures, postes, sauvegarde et exports fonctionnent sans
 * modification. Tout se passe côté navigateur, aucun serveur n'est sollicité.
 *
 *   .dwg ──WASM──▶ .dxf ──dxf──▶ SVG ──svg2pdf──▶ PDF ──▶ loadPdf()
 */
import { Helper } from 'dxf'
import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import type { Calibration, Unit } from '@/types'

export interface ResultatCao {
  pdfBytes: Uint8Array
  /** Calibration déduite des unités du dessin, si elles sont connues. */
  calibration: Calibration | null
  avertissements: string[]
}

export function estFichierCao(nom: string): boolean {
  return /\.(dwg|dxf)$/i.test(nom)
}

// ─── Chargement du module WebAssembly ────────────────────────────────────────
// Import statique : Vite peut l'analyser et l'embarquer. On récupère nous-mêmes
// les octets du .wasm, car le chargeur du paquet utilise un import() dynamique
// calculé à l'exécution — invisible pour Vite et bloqué sous Electron (file://).
let wasmPret: Promise<typeof import('dwgdxf-wasm')> | null = null
function chargerWasm() {
  if (!wasmPret) {
    wasmPret = (async () => {
      const mod = await import('dwgdxf-wasm')
      const url = new URL('./wasm-dwg/dwgdxf_bg.wasm', window.location.href).href
      const octets = await (await fetch(url)).arrayBuffer()
      await mod.default({ module_or_path: octets })
      return mod
    })()
  }
  return wasmPret
}

// ─── Unités de dessin ────────────────────────────────────────────────────────
// $INSUNITS du DXF → facteur de conversion vers le mètre.
const UNITES: Record<number, { unite: Unit; versMetre: number }> = {
  1: { unite: 'in', versMetre: 0.0254 },
  2: { unite: 'ft', versMetre: 0.3048 },
  4: { unite: 'mm', versMetre: 0.001 },
  5: { unite: 'cm', versMetre: 0.01 },
  6: { unite: 'm',  versMetre: 1 },
}

// ─── Textes ──────────────────────────────────────────────────────────────────
// toSVG() dessine la géométrie mais ignore les textes : sur un plan on perdrait
// les noms de pièces, les cotes écrites et le cartouche. On les reconstruit.
const ANCRES: Record<number, string> = { 1:'start',2:'middle',3:'end',4:'start',5:'middle',6:'end',7:'start',8:'middle',9:'end' }
const LIGNES_BASE: Record<number, string> = { 1:'hanging',2:'hanging',3:'hanging',4:'middle',5:'middle',6:'middle',7:'auto',8:'auto',9:'auto' }

/** Retire les codes de formatage AutoCAD : {\fPolice|b0|i0;Texte} → Texte */
function texteBrut(s: string): string {
  return s
    .replace(/\\f[^;]*;/g, '')
    .replace(/\\[A-Za-z][^;\\]*;/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\P/g, ' ')
    .replace(/\\~/g, ' ')
    .trim()
}

const echapper = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function balisesTexte(entites: any[]): string {
  return entites
    .filter(e => ['MTEXT', 'TEXT', 'ATTRIB'].includes(e.type))
    .map(e => {
      const t = texteBrut(String(e.string ?? e.text ?? ''))
      if (!t) return ''
      const taille = e.nominalTextHeight || e.textHeight || e.height || 10
      const ancre = ANCRES[e.attachmentPoint] ?? 'start'
      const ligne = LIGNES_BASE[e.attachmentPoint] ?? 'auto'
      const rot = e.rotation ? ` rotate(${-e.rotation})` : ''
      // Le calque parent applique un miroir vertical : on le compense ici,
      // sans quoi tous les textes sortiraient à l'envers.
      return `<g transform="translate(${e.x},${e.y}) scale(1,-1)${rot}">`
        + `<text x="0" y="0" font-size="${taille}" text-anchor="${ancre}"`
        + ` dominant-baseline="${ligne}" fill="#000" stroke="none"`
        + ` font-family="Helvetica, Arial, sans-serif">${echapper(t)}</text></g>`
    })
    .filter(Boolean)
    .join('\n')
}

// ─── Conversion ──────────────────────────────────────────────────────────────

/** Taille maximale de la page produite, en points PDF (~1,4 m de côté).
 *  Assez grand pour rester précis au zoom, assez petit pour rester manipulable. */
const COTE_MAX_PT = 4000

export async function convertirEnPdf(fichier: File): Promise<ResultatCao> {
  const avertissements: string[] = []
  const octets = new Uint8Array(await fichier.arrayBuffer())

  // 1. Obtenir le DXF
  let dxfTexte: string
  if (/\.dwg$/i.test(fichier.name)) {
    const wasm = await chargerWasm()
    dxfTexte = new TextDecoder().decode(wasm.convertDwgToDxf(octets))
  } else {
    dxfTexte = new TextDecoder().decode(octets)
  }

  // 2. Analyser et rendre
  const helper = new Helper(dxfTexte)
  const entites: any[] = helper.denormalised ?? []
  if (entites.length === 0) throw new Error('Aucune entité exploitable dans ce fichier.')

  let svgTexte: string = helper.toSVG()
  const textes = balisesTexte(entites)
  if (textes) svgTexte = svgTexte.replace(/<\/g>\s*<\/svg>\s*$/, `${textes}</g></svg>`)

  // 3. Dimensions réelles du dessin, lues dans le viewBox
  const vb = (svgTexte.match(/viewBox="([^"]+)"/) || [])[1]
  if (!vb) throw new Error('Rendu impossible : dessin sans étendue exploitable.')
  const [, , largeurDessin, hauteurDessin] = vb.split(/\s+/).map(Number)

  const facteur = Math.min(COTE_MAX_PT / largeurDessin, COTE_MAX_PT / hauteurDessin, 4)
  const largeurPt = largeurDessin * facteur
  const hauteurPt = hauteurDessin * facteur

  // 4. SVG → PDF vectoriel (reste net quel que soit le zoom)
  const hote = document.createElement('div')
  hote.style.cssText = 'position:fixed;left:-99999px;top:0'
  hote.innerHTML = svgTexte
  document.body.appendChild(hote)
  try {
    const element = hote.querySelector('svg')!
    element.setAttribute('width', String(largeurPt))
    element.setAttribute('height', String(hauteurPt))

    const pdf = new jsPDF({
      orientation: largeurPt >= hauteurPt ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [largeurPt, hauteurPt],
    })
    await svg2pdf(element, pdf, { x: 0, y: 0, width: largeurPt, height: hauteurPt })
    var pdfBytes = new Uint8Array(pdf.output('arraybuffer'))
  } finally {
    hote.remove()
  }

  // 5. Calibration automatique — le dessin porte ses unités réelles
  let calibration: Calibration | null = null
  const entete = helper.parsed?.header ?? {}
  const insunits = Number(entete.insUnits ?? entete.$INSUNITS ?? 0)
  const u = UNITES[insunits]
  if (u) {
    // 1 point PDF vaut (1 / facteur) unités de dessin
    const parPoint = 1 / facteur
    calibration = {
      pixelDistance: 1,
      realValue: parPoint,
      unit: u.unite,
      ratio: parPoint,
    }
  } else {
    avertissements.push(
      "Le fichier ne précise pas ses unités : calibrez l'échelle manuellement (touche C)."
    )
  }

  const nbTextes = entites.filter(e => ['MTEXT','TEXT','ATTRIB'].includes(e.type)).length
  avertissements.push(
    `Conversion approximative (${entites.length} entités, ${nbTextes} textes). `
    + 'Vérifiez une cote connue du plan avant de chiffrer.'
  )

  return { pdfBytes, calibration, avertissements }
}
