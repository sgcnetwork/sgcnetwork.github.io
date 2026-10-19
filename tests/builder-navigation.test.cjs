const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('website-builder.html','utf8');
function fixture(preferences={}){
 const dom=new JSDOM('<div id="preview-shell"><div id="preview"><div class="preview-top"><strong id="pname">Business</strong><nav class="sgc-preview-navlinks"><button>Home</button><button>Products</button><button>Services</button></nav></div></div></div>',{runScripts:'outside-only'});
 const w=dom.window;w.MutationObserver=class{observe(){} disconnect(){}};w.ResizeObserver=class{observe(){}};
 w.sgcGetBuilderDraft=()=>preferences;w.sgcRenderFullPreview=()=>{};
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 w.eval(scripts.find(s=>s.includes('let opened=false,scheduled=false;')));
 return dom;
}
test('all inline builder scripts parse',()=>{for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new Function(match[1]);});
test('rendered menu buttons inherit custom menu text and font size',()=>{const dom=fixture({menuColorMode:'Custom color',menuColor:'#814b70',menuPosition:'Center'});const nav=dom.window.document.querySelector('nav');assert.equal(nav.style.justifyContent,'center');for(const link of nav.children){assert.equal(link.style.fontSize,'inherit');assert.equal(link.style.getPropertyPriority('color'),'important');}assert.equal(dom.window.document.getElementById('sgc-preview-overflow-panel').style.getPropertyValue('--sgc-menu-ink'),'#814b70');dom.window.close();});
test('forced desktop collapse opens the chosen menu and honours left positioning',()=>{const dom=fixture({alwaysCollapsed:'Yes',hamburgerPosition:'Left',hamburgerIcon:'≡',menuEntries:[{id:'Products',label:'Shop',visible:true},{id:'Hidden',label:'Hidden',visible:false}]});const d=dom.window.document,b=d.querySelector('.sgc-preview-menu-toggle');assert.equal(b.hidden,false);assert.equal(b.textContent,'≡');assert.equal(d.querySelector('.sgc-preview-actions').style.getPropertyValue('order'),'0');assert.equal(d.querySelector('.preview-top').firstChild.className,'sgc-preview-actions');b.click();assert.equal(b.getAttribute('aria-expanded'),'true');assert.match(d.getElementById('sgc-preview-overflow-panel').textContent,/Shop/);assert.doesNotMatch(d.getElementById('sgc-preview-overflow-panel').textContent,/Hidden/);assert.doesNotMatch(html,/#preview-shell:not\(\.mobile\) \.sgc-preview-menu-toggle,#preview-shell/);dom.window.close();});
