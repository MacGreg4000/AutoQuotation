/**
 * Génère la version DXF du plan d'exemple (public/exemple-plan.dxf).
 *
 * Même appartement que le PDF, mais en vrai fichier CAO : coordonnées en
 * millimètres et $INSUNITS renseigné, pour que l'application calibre seule.
 *
 *   node scripts/generer-plan-dxf.mjs
 */
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const H = 7                      // hauteur du bâtiment en mètres
const mm = m => Math.round(m * 1000)
const X = m => mm(m)
const Y = m => mm(H - m)         // l'axe Y du DXF monte, celui du plan descend

const g = (code, val) => `${code}\n${val}\n`
let d = ''

d += g(0, 'SECTION') + g(2, 'HEADER')
d += g(9, '$INSUNITS') + g(70, 4)          // 4 = millimètres → calibration automatique
d += g(9, '$MEASUREMENT') + g(70, 1)       // système métrique
d += g(0, 'ENDSEC')

d += g(0, 'SECTION') + g(2, 'ENTITIES')

const ligne = (x1, y1, x2, y2, calque) =>
  g(0, 'LINE') + g(8, calque) + g(10, X(x1)) + g(20, Y(y1)) + g(30, 0) + g(11, X(x2)) + g(21, Y(y2)) + g(31, 0)

// Enveloppe extérieure
for (const [a, b, c, e] of [[0,0,10,0],[10,0,10,7],[10,7,0,7],[0,7,0,0]]) d += ligne(a,b,c,e,'MURS')

// Refends, avec les réservations de portes
for (const [a,b,c,e] of [
  [5,0,5,1.6],[5,2.5,5,7],
  [0,4,1.2,4],[2.1,4,5,4],
  [2.5,4,2.5,5.1],[2.5,6,2.5,7],
  [5,3.5,6.4,3.5],[7.3,3.5,10,3.5],
]) d += ligne(a,b,c,e,'CLOISONS')

// Libellés des pièces
const texte = (x, y, s, h = 0.25) =>
  g(0,'TEXT') + g(8,'TEXTES') + g(10,X(x)) + g(20,Y(y)) + g(30,0)
  + g(40, mm(h)) + g(1, s) + g(72, 1) + g(11, X(x)) + g(21, Y(y)) + g(31, 0)

for (const [x, y, nom, surf] of [
  [2.5, 2.0, 'SEJOUR', '20.00 m2'],
  [7.5, 1.75, 'CUISINE', '17.50 m2'],
  [1.25, 5.5, 'HALL', '7.50 m2'],
  [3.75, 5.5, 'CHAMBRE', '7.50 m2'],
  [7.5, 5.25, 'SALLE DE BAIN', '17.50 m2'],
]) { d += texte(x, y, nom); d += texte(x, y + 0.35, surf, 0.18) }

// Cotation de contrôle, comme sur le PDF
d += ligne(0, 7.9, 10, 7.9, 'COTES')
d += texte(2.5, 8.15, '5.00 m', 0.22)
d += texte(7.5, 8.15, '5.00 m', 0.22)
d += texte(5, -0.5, 'APPARTEMENT TYPE - PLAN DE NIVEAU', 0.35)

d += g(0, 'ENDSEC') + g(0, 'EOF')

mkdirSync(join(ROOT, 'public'), { recursive: true })
const sortie = join(ROOT, 'public', 'exemple-plan.dxf')
writeFileSync(sortie, d)
console.log('DXF généré :', sortie, `(${(d.length / 1024).toFixed(1)} Ko)`)
