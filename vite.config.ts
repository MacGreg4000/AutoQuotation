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
    },
    dedupe: ['konva', 'react-konva'],
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
    include: ['konva', 'react-konva'],
  },
})
