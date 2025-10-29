import { defineConfig } from 'vite';

const flags = new Set();
String(process.env.BUILD_FLAGS || '').replace(/\S+/g, m => flags.add(m));

const viteCfg = {
  build: {
    minify: !flags.has('noMinify'),
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
