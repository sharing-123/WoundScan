const V='woundscan-v3';
const FILES=['./','index.html','css/style.css','js/geom.js','js/knowledge.js','js/seg.js','js/tissue.js','js/render.js','js/planner.js','js/sim.js','js/donor.js','js/bodymap.js','js/surg-ui.js','js/clinical.js','js/app.js','lib/ort.min.js','lib/ort-wasm-simd-threaded.mjs','lib/ort-wasm-simd-threaded.wasm','models/wound_seg.onnx','models/meta.json','manifest.json','icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(FILES.map(f=>c.add(f).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(V).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request)))});
