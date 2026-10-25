// Dev-only: tiny local receiver that saves raw POST bodies as files (used to pull downloads out of a browser tab).
//   node tools/recv-bin.cjs <outDir> [port=5198]     then in the page:  fetch('http://127.0.0.1:5198/<name>', {method:'POST', body: blob})
const http = require('http'), fs = require('fs'), path = require('path');
const dir = process.argv[2], port = Number(process.argv[3] || 5198);
fs.mkdirSync(dir, { recursive: true });
http.createServer((q, s) => {
  s.setHeader('Access-Control-Allow-Origin', '*');
  s.setHeader('Access-Control-Allow-Headers', '*');
  s.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (q.method === 'OPTIONS') { s.end(); return; }
  const name = path.basename(decodeURIComponent(q.url.slice(1))) || 'file.bin';
  const parts = [];
  q.on('data', (d) => parts.push(d));
  q.on('end', () => {
    const buf = Buffer.concat(parts);
    fs.writeFileSync(path.join(dir, name), buf);
    console.log('saved', name, buf.length);
    s.end(`ok ${name} ${buf.length}`);
  });
}).listen(port, '127.0.0.1');
