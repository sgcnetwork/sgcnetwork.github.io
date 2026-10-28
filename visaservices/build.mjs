import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
await build({entryPoints:['src/main.tsx'],bundle:true,minify:true,outfile:'app.js',jsx:'automatic',target:['es2022'],legalComments:'none',define:{'process.env.NODE_ENV':'"production"'}});
await copyFile('src/style.css','style.css');
console.log('Visa Services static assets built.');
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','pdf.worker.mjs');
