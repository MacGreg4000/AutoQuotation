/**
 * Test de non-régression du paquet de production.
 *
 * Charge dist/index.html via file:// — exactement comme l'application installée —
 * puis vérifie que le PDF s'importe et se rend réellement. C'est le scénario qui
 * avait échoué sous Electron/Windows (worker pdf.js bloqué, API JS trop récente).
 *
 *   npm run build && npx electron scripts/test-paquet.mjs
 *
 * Sort en code 1 si un test échoue.
 */
import { app, BrowserWindow } from 'electron'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const INDEX = join(__dirname, '..', 'dist', 'index.html')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const resultats = []
const verifier = (nom, ok, detail = '') => {
  resultats.push({ nom, ok, detail })
  console.log(`  ${ok ? '✓' : '✗'} ${nom}${detail ? '  — ' + detail : ''}`)
}

app.whenReady().then(async () => {
  console.log('Electron', process.versions.electron, '· Chromium', process.versions.chrome)
  console.log('Page    ', INDEX, '\n')

  const win = new BrowserWindow({
    width: 1280, height: 800, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })

  const erreursConsole = []
  win.webContents.on('console-message', (e, level, message) => {
    // Electron ≥ 41 passe un objet d'événement ; les versions antérieures des arguments séparés.
    const niveau = typeof e === 'object' && e?.level !== undefined ? e.level : level
    const texte  = typeof e === 'object' && e?.message !== undefined ? e.message : message
    const estErreur = niveau === 'error' || niveau >= 2
    if (estErreur) erreursConsole.push(String(texte))
  })

  await win.loadFile(INDEX)
  await sleep(2500)

  verifier('protocole file://', await win.webContents.executeJavaScript('location.protocol') === 'file:')

  verifier(
    "l'interface est montée",
    await win.webContents.executeJavaScript(`!!document.querySelector('canvas') || !!document.getElementById('pdf-file-input')`)
  )

  // ── Import du PDF par le vrai circuit (input fichier) ──────────────────────
  const res = await win.webContents.executeJavaScript(`(async () => {
    const r = await fetch('./exemple-plan.pdf');
    const blob = await r.blob();
    const file = new File([blob], 'exemple-plan.pdf', { type: 'application/pdf' });
    const dt = new DataTransfer(); dt.items.add(file);
    const input = document.getElementById('pdf-file-input');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 3000));
    const canvas = document.querySelector('canvas');
    // Le rendu est-il autre chose qu'une page blanche ?
    let pixelsNonBlancs = 0;
    try {
      const c2 = document.createElement('canvas');
      c2.width = 200; c2.height = 200;
      const ctx = c2.getContext('2d');
      ctx.drawImage(canvas, 0, 0, 200, 200);
      const d = ctx.getImageData(0, 0, 200, 200).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] < 240 || d[i+1] < 240 || d[i+2] < 240) pixelsNonBlancs++;
      }
    } catch (e) { /* canvas éventuellement souillé */ }
    return {
      octetsSource: blob.size,
      canvasW: canvas ? canvas.width : 0,
      canvasH: canvas ? canvas.height : 0,
      pixelsNonBlancs,
    };
  })()`)

  verifier('le PDF est récupéré', res.octetsSource > 10000, `${res.octetsSource} octets`)
  verifier('le canevas est dimensionné', res.canvasW > 100 && res.canvasH > 100, `${res.canvasW}×${res.canvasH}`)
  verifier('le plan est réellement dessiné', res.pixelsNonBlancs > 200, `${res.pixelsNonBlancs} pixels tracés`)

  // L'avertissement CSP d'Electron est consultatif (page locale), pas une erreur d'exécution.
  const bloquantes = erreursConsole.filter(m =>
    !/DevTools|Autofill|GPU stall|deprecated|Electron Security Warning/i.test(m))
  verifier('aucune erreur console bloquante', bloquantes.length === 0,
    bloquantes.length ? bloquantes[0].slice(0, 120) : 'console propre')

  const echecs = resultats.filter(r => !r.ok).length
  console.log(`\n${resultats.length - echecs}/${resultats.length} tests réussis`)
  app.exit(echecs === 0 ? 0 : 1)
})

app.on('window-all-closed', () => app.quit())
