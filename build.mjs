import { build } from 'esbuild';
import fs from 'fs';
const r = await build({ entryPoints: ['src/app.jsx'], bundle: true, minify: true, write: false, format: 'iife', charset: 'utf8', jsx: 'transform', loader: { '.js': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' }, target: 'es2020', logLevel: 'error' });
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const rfcss = fs.readFileSync('node_modules/reactflow/dist/style.css', 'utf8');
const css = fs.readFileSync('src/styles.css', 'utf8');
const html = `<title>Zenko Studio</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Noto+Sans:wght@400;500;600;700&display=swap">
<style>${rfcss}\n${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/studio.html', html);
console.log('built', (html.length / 1024).toFixed(0) + ' KB');
