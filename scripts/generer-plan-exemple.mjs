/**
 * Génère le plan d'exemple utilisé par le tutoriel (public/exemple-plan.pdf).
 * Appartement fictif de 10 × 7 m, dessiné à l'échelle 1:50.
 *
 *   node scripts/generer-plan-exemple.mjs
 */
import { jsPDF } from 'jspdf'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const S = 20          // mm par mètre → échelle 1:50
const OX = 22, OY = 20 // origine du plan en mm
const X = m => OX + m * S
const Y = m => OY + m * S

const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })

// ── Murs ────────────────────────────────────────────────────────────────────
const wall = (x1, y1, x2, y2, w = 1.2) => {
  doc.setLineWidth(w)
  doc.setDrawColor(20)
  doc.line(X(x1), Y(y1), X(x2), Y(y2))
}

// Enveloppe extérieure
wall(0, 0, 10, 0); wall(10, 0, 10, 7); wall(10, 7, 0, 7); wall(0, 7, 0, 0)

// Refends intérieurs (avec réservations de portes)
wall(5, 0, 5, 1.6, 0.8); wall(5, 2.5, 5, 7, 0.8)      // refend vertical central
wall(0, 4, 1.2, 4, 0.8); wall(2.1, 4, 5, 4, 0.8)      // séjour / hall
wall(2.5, 4, 2.5, 5.1, 0.8); wall(2.5, 6, 2.5, 7, 0.8) // hall / chambre
wall(5, 3.5, 6.4, 3.5, 0.8); wall(7.3, 3.5, 10, 3.5, 0.8) // cuisine / SDB

// ── Portes (battant + arc de débattement) ───────────────────────────────────
const door = (cx, cy, r, a0) => {
  doc.setLineWidth(0.3)
  doc.setDrawColor(90)
  const a1 = a0 + Math.PI / 2
  const pts = []
  for (let i = 0; i <= 12; i++) {
    const a = a0 + (a1 - a0) * (i / 12)
    pts.push([X(cx + Math.cos(a) * r), Y(cy + Math.sin(a) * r)])
  }
  for (let i = 1; i < pts.length; i++) doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])
  doc.line(X(cx), Y(cy), pts[0][0], pts[0][1])
}
door(5, 1.6, 0.9, 0)          // séjour → cuisine
door(1.2, 4, 0.9, 0)          // séjour → hall
door(2.5, 5.1, 0.9, Math.PI / 2) // hall → chambre
door(6.4, 3.5, 0.9, 0)        // cuisine → SDB

// ── Libellés des pièces ─────────────────────────────────────────────────────
const room = (cx, cy, name, area) => {
  doc.setTextColor(30)
  doc.setFontSize(9); doc.setFont('helvetica', 'bold')
  doc.text(name, X(cx), Y(cy), { align: 'center' })
  doc.setFontSize(7); doc.setFont('helvetica', 'normal')
  doc.setTextColor(110)
  doc.text(area, X(cx), Y(cy) + 4, { align: 'center' })
}
room(2.5, 2.0, 'SEJOUR', '20.00 m2')
room(7.5, 1.75, 'CUISINE', '17.50 m2')
room(1.25, 5.5, 'HALL', '7.50 m2')
room(3.75, 5.5, 'CHAMBRE', '7.50 m2')
room(7.5, 5.25, 'SALLE DE BAIN', '17.50 m2')

// ── Cotation (chaîne 5.00 + 5.00 = 10.00 m) ─────────────────────────────────
const dimY = 7.9
const tick = (x, y) => {
  doc.setLineWidth(0.25); doc.setDrawColor(200, 40, 40)
  doc.line(X(x) - 1.2, Y(y) + 1.2, X(x) + 1.2, Y(y) - 1.2)
}
doc.setLineWidth(0.25); doc.setDrawColor(200, 40, 40)
doc.line(X(0), Y(dimY), X(10), Y(dimY))
doc.line(X(0), Y(7.1), X(0), Y(dimY + 0.2))
doc.line(X(5), Y(7.1), X(5), Y(dimY + 0.2))
doc.line(X(10), Y(7.1), X(10), Y(dimY + 0.2))
;[0, 5, 10].forEach(x => tick(x, dimY))
doc.setTextColor(200, 40, 40); doc.setFontSize(8); doc.setFont('helvetica', 'bold')
doc.text('5.00 m', X(2.5), Y(dimY) - 1.8, { align: 'center' })
doc.text('5.00 m', X(7.5), Y(dimY) - 1.8, { align: 'center' })

// Cote verticale totale
doc.setDrawColor(200, 40, 40)
doc.line(X(10.5), Y(0), X(10.5), Y(7))
doc.line(X(10.1), Y(0), X(10.6), Y(0))
doc.line(X(10.1), Y(7), X(10.6), Y(7))
doc.text('7.00 m', X(10.5) + 3, Y(3.5), { align: 'left' })

// ── Flèche du nord ──────────────────────────────────────────────────────────
doc.setDrawColor(40); doc.setLineWidth(0.4)
const nx = X(9.2), ny = Y(8.6)
doc.line(nx, ny, nx, ny - 8)
doc.line(nx, ny - 8, nx - 2, ny - 5)
doc.line(nx, ny - 8, nx + 2, ny - 5)
doc.setTextColor(40); doc.setFontSize(8)
doc.text('N', nx, ny + 3.5, { align: 'center' })

// ── Cartouche ───────────────────────────────────────────────────────────────
const cx0 = 232, cy0 = 150, cw = 60, ch = 45
doc.setDrawColor(40); doc.setLineWidth(0.4)
doc.rect(cx0, cy0, cw, ch)
doc.line(cx0, cy0 + 10, cx0 + cw, cy0 + 10)
doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(20)
doc.text('PLAN D\'EXEMPLE', cx0 + cw / 2, cy0 + 6.5, { align: 'center' })
doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(60)
const rows = [
  ['Projet', 'Tutoriel MetrePlan'],
  ['Niveau', 'Rez-de-chaussee'],
  ['Echelle', '1:50'],
  ['Surface', '70.00 m2'],
  ['Format', 'A4 paysage'],
]
rows.forEach(([k, v], i) => {
  const y = cy0 + 17 + i * 6
  doc.setTextColor(120); doc.text(k, cx0 + 3, y)
  doc.setTextColor(30); doc.text(v, cx0 + 22, y)
})

// ── Titre ───────────────────────────────────────────────────────────────────
doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(20)
doc.text('APPARTEMENT TYPE - PLAN DE NIVEAU', 22, 12)
doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(130)
doc.text('Document fictif genere pour la documentation de MetrePlan', 22, 16.5)

mkdirSync(join(ROOT, 'public'), { recursive: true })
const out = join(ROOT, 'public', 'exemple-plan.pdf')
writeFileSync(out, Buffer.from(doc.output('arraybuffer')))
console.log('Plan généré :', out)
