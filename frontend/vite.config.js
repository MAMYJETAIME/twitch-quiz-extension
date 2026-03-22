import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    target: 'es2015',
    modulePreload: false,
    cssMinify: false,
    minify: false,
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'app.js',
        inlineDynamicImports: true
      }
    }
  }
})