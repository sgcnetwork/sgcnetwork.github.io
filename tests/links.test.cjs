const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
test('Reachable customer pages have no missing local HTML, script, style or media targets',()=>{
 const root=path.resolve(__dirname,'..'),seen=new Set(),pending=['index.html','dashboard.html','academy.html','community.html','shop.html','website-builder.html','payment.html','studio.html'],missing=[];
 while(pending.length){const name=pending.pop();if(seen.has(name))continue;seen.add(name);const file=path.join(root,name);const dom=new JSDOM(fs.readFileSync(file,'utf8'));
  for(const node of dom.window.document.querySelectorAll('[href],[src]')){const value=node.getAttribute('href')||node.getAttribute('src');if(!value||/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value))continue;const url=new URL(value,'https://sgcnetwork.co.za/'+name);let target=path.join(root,decodeURIComponent(url.pathname));if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');if(!fs.existsSync(target))missing.push(name+' → '+value);else if(target.endsWith('.html'))pending.push(path.relative(root,target));
  }dom.window.close();
 }assert.deepEqual(missing,[]);assert.ok(seen.size>=17);
});
