/**
 * Génère les captures d'écran du tutoriel (docs/images/*.png).
 *
 * Pilote l'application dans une fenêtre Electron, injecte un scénario de métré
 * réaliste sur le plan d'exemple, puis capture chaque étape.
 *
 *   npm run dev                                  # dans un autre terminal
 *   npx electron scripts/capturer-tutoriel.mjs
 */
import { app, BrowserWindow } from 'electron'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'docs', 'images')
const URL_APP = process.env.APP_URL || 'http://localhost:5173'

const sleep = ms => new Promise(r => setTimeout(r, ms))
const js = code => `(async () => { ${code} })()`

// ── Géométrie du plan d'exemple (coordonnées PDF, 1 pt = 1/72 pouce) ─────────
// Le plan est dessiné à 20 mm/m avec une origine à (22 mm, 20 mm).
const PRELUDE = `
  const K = 72 / 25.4, OX = 22, OY = 20, S = 20;
  const X = m => (OX + m * S) * K, Y = m => (OY + m * S) * K;
  const proj = await import('/src/store/useProjectStore.ts');
  const geo  = await import('/src/lib/geometry.ts');
  const P = () => proj.useProjectStore.getState();
  const rect = (x1, y1, x2, y2) => [{x:X(x1),y:Y(y1)},{x:X(x2),y:Y(y1)},{x:X(x2),y:Y(y2)},{x:X(x1),y:Y(y2)}];
  const surface = (pts) => {
    const c = P().calibration;
    return parseFloat(geo.toRealUnit(geo.toRealUnit(geo.polygonArea(pts), c), c).toFixed(3));
  };
  const longueur = (pts) => {
    const c = P().calibration;
    return parseFloat(geo.toRealUnit(geo.polylineLength(pts), c).toFixed(3));
  };
  const clickTitle = (t) => {
    const b = [...document.querySelectorAll('button')].find(b => (b.title||'').includes(t));
    if (b) b.click();
    return !!b;
  };
`

// Le plan d'exemple porte une cotation de 5,00 m entre x=0 et x=5.
const CALIBRER = `
  const d = X(5) - X(0);
  P().setCalibration({ pixelDistance: d, realValue: 5, unit: 'm', ratio: 5 / d });
`

const IMPORTER = `
  const res = await fetch('/exemple-plan.pdf');
  const file = new File([await res.blob()], 'exemple-plan.pdf', { type: 'application/pdf' });
  const dt = new DataTransfer(); dt.items.add(file);
  const input = document.getElementById('pdf-file-input');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 2200));
  P().setProjectName('Appartement type — RDC');
  window.dispatchEvent(new Event('zoom-fit'));
`

/** Écrit dans un champ React (le setter natif est requis pour déclencher onChange). */
const SAISIR = `
  const saisir = (sel, val) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
`

const etapes = [
  { nom: '01-interface', attente: 1200 },

  { nom: '02-plan-importe', code: PRELUDE + IMPORTER, attente: 1800 },

  {
    nom: '03-calibration-fenetre',
    code: PRELUDE + SAISIR + `
      window.dispatchEvent(new CustomEvent('calibration-ready', {
        detail: { points: [{x:X(0),y:Y(7.9)},{x:X(5),y:Y(7.9)}], pixelDistance: X(5) - X(0) }
      }));
      await new Promise(r => setTimeout(r, 600));
      // Cibler le champ de la fenêtre de calibration, pas le nom du projet
      saisir('input[placeholder*="ex:"]', '5.00');
    `,
    attente: 900,
  },

  {
    nom: '04-echelle-calibree',
    code: PRELUDE + `
      [...document.querySelectorAll('button')].forEach(b => {
        if (/annuler|fermer/i.test(b.textContent || '')) b.click();
      });
      ${CALIBRER}
    `,
    attente: 900,
  },

  {
    nom: '05-poste-actif',
    code: PRELUDE + `
      P().addPoste({ id: 'sol', name: 'Sol carrelage 60x60', color: '#3b82f6' });
      P().setActivePosteId('sol');
    `,
    attente: 700,
  },

  {
    nom: '06-premiere-surface',
    code: PRELUDE + `
      const pts = rect(0, 0, 5, 4);            // le séjour
      P().addMeasurement({ id: 'm1', type: 'area', name: 'Surface 1', color: '#3b82f6',
        page: 1, points: pts, value: surface(pts), unit: 'm²', visible: true, posteId: 'sol' });
    `,
    attente: 800,
  },

  {
    nom: '07-metre-complet',
    code: PRELUDE + `
      P().addPoste({ id: 'plinthe', name: 'Plinthes', color: '#22c55e' });
      P().addPoste({ id: 'faience', name: 'Faïence murale', color: '#a855f7' });

      const cuisine = rect(5, 0, 10, 3.5);
      P().addMeasurement({ id: 'm2', type: 'area', name: 'Surface 2', color: '#3b82f6',
        page: 1, points: cuisine, value: surface(cuisine), unit: 'm²', visible: true, posteId: 'sol' });

      const tremie = rect(1.2, 1.2, 2.4, 2.4);
      P().addMeasurement({ id: 'm3', type: 'subtract', name: 'Déduction 1', color: '#ef4444',
        page: 1, points: tremie, value: -surface(tremie), unit: 'm²', visible: true, posteId: 'sol',
        labelOffset: { x: -60, y: -46 } });   // décalée pour ne pas recouvrir la surface

      const perim = [{x:X(0),y:Y(0)},{x:X(5),y:Y(0)},{x:X(5),y:Y(4)},{x:X(0),y:Y(4)},{x:X(0),y:Y(0)}];
      P().addMeasurement({ id: 'm4', type: 'length', name: 'Longueur 1', color: '#22c55e',
        page: 1, points: perim, value: longueur(perim), unit: 'm', visible: true, posteId: 'plinthe' });

      const sdb = [{x:X(5),y:Y(3.5)},{x:X(10),y:Y(3.5)},{x:X(10),y:Y(7)}];
      P().addMeasurement({ id: 'm5', type: 'wall', name: 'Mur 1', color: '#a855f7',
        page: 1, points: sdb, value: parseFloat((longueur(sdb) * 2.5).toFixed(3)),
        unit: 'm²', wallHeight: 2.5, visible: true, posteId: 'faience' });

      P().addMeasurement({ id: 'm6', type: 'count', name: 'Prises', color: '#eab308',
        page: 1, points: [{x:X(3.6),y:Y(3.2)}], value: 1, unit: 'unites', visible: true });
      P().addMeasurement({ id: 'm7', type: 'count', name: 'Prises', color: '#eab308',
        page: 1, points: [{x:X(7.4),y:Y(1.1)}], value: 1, unit: 'unites', visible: true });
      P().setActivePosteId(null);
    `,
    attente: 1000,
  },

  { nom: '08-detail-poste', code: PRELUDE + `clickTitle('Voir le détail des mesures');`, attente: 800, zone: 'panneau' },

  { nom: '09-non-assignees', attente: 300, zone: 'panneau' },

  {
    nom: '10-legende',
    code: PRELUDE + `
      clickTitle('Masquer le détail');
      P().setLegend({ visible: true, page: 1, x: 470, y: 70 });
    `,
    attente: 900,
  },

  { nom: '11-barre-outils', attente: 300, zone: 'outils' },

  { nom: '12-entete', attente: 300, zone: 'entete' },

  // Import CAO : on repart d'un projet vierge, le plan DXF remplaçant le PDF.
  {
    nom: '13-import-cao',
    code: PRELUDE + `
      P().newProject();
      const res = await fetch('/exemple-plan.dxf');
      const file = new File([await res.blob()], 'exemple-plan.dxf', { type: 'application/octet-stream' });
      const dt = new DataTransfer(); dt.items.add(file);
      const input = document.getElementById('pdf-file-input');
      const vrai = window.alert; window.alert = () => {};
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 6000));
      window.alert = vrai;
      // l'application cadre déjà le plan elle-même : ne pas le refaire ici
    `,
    attente: 2000,
  },
]

app.whenReady().then(async () => {
  mkdirSync(OUT, { recursive: true })
  const win = new BrowserWindow({
    width: 1280, height: 800, show: true, x: 0, y: 0,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  await win.loadURL(URL_APP)
  await sleep(2500)

  const [W, H] = win.getContentSize()
  const zones = {
    entete:  { x: 0, y: 0, width: W, height: 56 },
    panneau: { x: W - 300, y: 0, width: 300, height: H },
    outils:  { x: 0, y: 0, width: 176, height: H },
  }

  for (const e of etapes) {
    if (e.code) {
      try { await win.webContents.executeJavaScript(js(e.code)) }
      catch (err) { console.error('  ! étape', e.nom, ':', err.message) }
    }
    await sleep(e.attente ?? 800)
    const img = await win.webContents.capturePage(e.zone ? zones[e.zone] : undefined)
    const png = img.getSize().width > 1400 ? img.resize({ width: 1280 }) : img
    writeFileSync(join(OUT, e.nom + '.png'), png.toPNG())
    console.log('  ✓', e.nom, `${png.getSize().width}×${png.getSize().height}`)
  }

  console.log('Captures écrites dans', OUT)
  app.quit()
})

app.on('window-all-closed', () => app.quit())
