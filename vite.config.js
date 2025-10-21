// vite.config.js
import { defineConfig } from 'vite'
import {resolve} from "path";
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'heiImageViewer',
      fileName: (fmt) => `heiImageViewer.base.${fmt}.min.js`,
      formats: ['umd']
    },
    rollupOptions: {
      output: {
        assetFileNames: 'heiImageViewer.min.css',
        extend: true
      }
    },
  }
})
