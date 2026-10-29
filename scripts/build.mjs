import { mkdir, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
console.log('Static assets built in dist/. Vercel serves api/search.js as a function.');
