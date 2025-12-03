import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // สำคัญ: ใช้ relative path เพื่อให้ทำงานได้บน GitHub Pages (https://user.github.io/repo/)
  build: {
    outDir: 'dist',
  },
});