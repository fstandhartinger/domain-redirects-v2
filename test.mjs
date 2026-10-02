import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { request } from 'node:http';
function probe(path, host) { return new Promise((resolve,reject)=>{const req=request({host:'localhost',port:3000,path,headers:{Host:host}},r=>{r.resume();resolve({status:r.statusCode,location:r.headers.location})});req.on('error',reject);req.end()}) }
const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('.', import.meta.url), stdio: 'inherit' });
try {
  let ready = false;
  for (let i=0; i<30; i++) { try { const r=await fetch('http://localhost:3000/healthz'); ready=r.status===204; } catch {} if (ready) break; await new Promise(r=>setTimeout(r,100)); }
  assert.ok(ready, 'service healthy');
  const cfg=JSON.parse(readFileSync(new URL('./domains.json',import.meta.url)));
  let checked=0;
  for (const [domain, route] of Object.entries(cfg)) {
    for (const host of route.hosts ?? [domain, `www.${domain}`]) {
      const r=await probe('/',host);
      assert.equal(r.status,301); assert.equal(new URL(r.location).hostname,new URL(route.to).hostname);
      assert.equal(new URL(r.location).pathname,route.root);
      const q=await probe('/docs?from=test',host);
      assert.equal(q.status,301); const url=new URL(q.location); assert.equal(url.pathname,'/docs');assert.equal(url.searchParams.get('from'),'test');checked++;
    }
  }
  assert.equal((await probe('/','unowned.example')).status,404);
  assert.equal((await probe('//other.example/','system1models.eu')).status,400);
  console.log(`PASS: ${checked} redirect hosts, paths, query strings, health and unknown-host rejection`);
} finally { child.kill(); }
