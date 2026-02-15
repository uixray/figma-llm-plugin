import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export default defineConfig([
  {
    // UI bundle
    entry: { ui: 'src/ui/main.ts' },
    format: ['iife'],
    outDir: 'dist',
    minify: false,
    sourcemap: false, // Отключаем source maps для production (избегаем CSP ошибок)
    target: 'es2017', // Figma поддерживает ES2017
    noExternal: [/.*/], // Bundle всё в один файл
    globalName: 'UI',
    outExtension: () => ({ js: '.js' }), // Убираем .global суффикс
    onSuccess: async () => {
      // Создаём dist если не существует
      mkdirSync('dist', { recursive: true });

      // Читаем HTML, CSS и JS
      const html = readFileSync('src/ui/index.html', 'utf-8');
      const cssMain = readFileSync('src/ui/styles.css', 'utf-8');
      const cssGroups = readFileSync('src/ui/styles-groups.css', 'utf-8');
      const cssTheme = readFileSync('src/ui/theme.css', 'utf-8');
      const js = readFileSync('dist/ui.js', 'utf-8');

      // Вставляем CSS и JS внутрь HTML
      const allCss = cssTheme + '\n' + cssMain + '\n' + cssGroups;
      let htmlWithAssets = html.replace('</head>', `<style>${allCss}</style></head>`);
      htmlWithAssets = htmlWithAssets.replace('<script src="ui.js"></script>', `<script>${js}</script>`);

      // Сохраняем в dist/ui.html
      writeFileSync('dist/ui.html', htmlWithAssets);
      console.log('✓ Built dist/ui.html');
    },
  },
  {
    // Sandbox bundle (code.ts)
    entry: { code: 'src/sandbox/code.ts' },
    format: ['iife'],
    outDir: 'dist',
    minify: false,
    sourcemap: false, // Отключаем source maps для production (избегаем CSP ошибок)
    target: 'es2017', // Figma поддерживает ES2017
    noExternal: [/.*/],
    globalName: 'PluginCode',
    outExtension: () => ({ js: '.js' }), // Убираем .global суффикс
  },
]);
