import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'path'

export default defineConfig({
  // './' = chemins relatifs : compatible navigateur (http) ET Electron (file://)
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          dest: '',
          rename: 'pdf.worker.min.mjs',
        },
        // Moteur WASM de conversion DWG : copié en local pour fonctionner
        // hors ligne et sous Electron (file://), jamais depuis un CDN.
        { src: 'node_modules/dwgdxf/dist/wasm/dwgdxf_bg.wasm', dest: 'wasm-dwg' },
        // Aide en ligne : rend le tutoriel et le manuel joignables depuis la
        // version web (NAS), où l'on n'a pas le menu « Aide » de l'application
        // installée. → http://<serveur>/docs/tutoriel.html
        { src: 'docs/*.html', dest: 'docs' },
        { src: 'docs/images', dest: 'docs' },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Le paquet dwgdxf n'expose pas son module WASM dans ses « exports ».
      // On vise le fichier directement pour pouvoir l'importer statiquement,
      // et ainsi éviter son chargeur dynamique (incompatible Electron/file://).
      'dwgdxf-wasm': path.resolve(__dirname, './node_modules/dwgdxf/dist/wasm/dwgdxf.js'),
    },
    dedupe: ['konva', 'react-konva'],
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
    include: ['konva', 'react-konva'],
  },
})
