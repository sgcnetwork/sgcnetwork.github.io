import {build} from 'esbuild';
import fs from 'node:fs/promises';
await build({entryPoints:['src/main.tsx'],bundle:true,loader:{'.webp':'dataurl'},minify:true,format:'esm',target:'es2020',outfile:'app.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
await fs.copyFile('src/style.css','style.css');
