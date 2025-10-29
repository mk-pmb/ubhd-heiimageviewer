import { defineConfig } from 'vite';

const viteCfg = {
  build: {
    lib: {
      entry: '.',
      name: 'heiImageViewer',
      fileName: fmt => `heiImageViewer.base.${fmt}.min.js`,
      formats: ['umd'],
    },
    rollupOptions: {
      output: {
        assetFileNames: 'heiImageViewer.min.css',
        extend: true,
      },
    },
  },
};

export default defineConfig(viteCfg);
