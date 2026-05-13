import React, { useState } from 'react'
import { Lock, CheckCircle, AlertTriangle, CreditCard, ShieldCheck, X } from 'lucide-react'

// ─── BLAGUE ──────────────────────────────────────────────────────────────────
// Pour désactiver le pop-up : passer ENABLED à false, puis npm run build
const ENABLED = true
// ─────────────────────────────────────────────────────────────────────────────

const LicenseModal: React.FC = () => {
  const [visible, setVisible] = useState(ENABLED)
  const [loading, setLoading] = useState(false)

  if (!visible) return null

  const handlePay = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Bandeau rouge en haut */}
        <div className="bg-gradient-to-r from-red-700 to-red-600 px-6 py-4 flex items-center gap-3">
          <AlertTriangle size={22} className="text-white shrink-0" />
          <div>
            <p className="text-white font-bold text-sm tracking-wide uppercase">Licence expirée</p>
            <p className="text-red-200 text-xs">Action requise pour continuer</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-white text-xs font-mono opacity-70">v2.4.1 — PRO</p>
          </div>
        </div>

        {/* Corps */}
        <div className="px-6 pt-5 pb-2">
          {/* Logo + titre */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <Lock size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">MétréPlan</h2>
              <p className="text-gray-400 text-xs">Édition Professionnelle — Secotech SPRL</p>
            </div>
          </div>

          <p className="text-gray-300 text-sm mb-4">
            Votre période d'essai de <span className="text-white font-semibold">30 jours</span> est
            arrivée à expiration le <span className="text-red-400 font-semibold">31/12/2024</span>.
            Pour continuer à utiliser MétréPlan, veuillez souscrire à une licence active.
          </p>

          {/* Offre */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white font-bold text-base">Licence Professionnelle</p>
                <p className="text-gray-400 text-xs mt-0.5">Par utilisateur · Facturation mensuelle</p>
              </div>
              <div className="text-right">
                <p className="text-white font-black text-2xl">150 €</p>
                <p className="text-gray-400 text-xs">HT / mois</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {[
                'Mesures illimitées (longueur, surface, toiture)',
                'Export Excel & PDF annoté',
                'Sauvegarde de projets avec PDF embarqué',
                'Mises à jour automatiques incluses',
                'Support prioritaire 5j/7 par email',
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-gray-300">
                  <CheckCircle size={13} className="text-green-400 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Mentions légales mini */}
          <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
            <ShieldCheck size={13} className="text-gray-600 shrink-0" />
            <span>Paiement sécurisé · Sans engagement · Résiliable à tout moment</span>
          </div>

          {/* Boutons */}
          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold text-sm py-2.5 rounded-lg transition-colors mb-2"
          >
            <CreditCard size={16} />
            {loading ? 'Connexion au portail de paiement…' : 'Activer ma licence — 150 € / mois'}
          </button>

          <button
            onClick={() => setVisible(false)}
            className="w-full text-center text-xs text-gray-600 hover:text-gray-400 py-2 transition-colors"
          >
            Continuer sans licence (fonctionnalités limitées)
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-600">© 2025 Secotech SPRL · BCE 0123.456.789</p>
          <p className="text-xs text-gray-600">support@secotech.be</p>
        </div>

      </div>
    </div>
  )
}

export default LicenseModal
