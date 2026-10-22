const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const env={window:{},location:{origin:'https://sgcnetwork.co.za'},URL,innerWidth:1200,crypto:globalThis.crypto};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../creative-renderer.js'),'utf8'),env);const C=env.window.SgcCreative,d=C.defaults(),r={cart:[],history:[],save(){}};
function render(route,data=d){const host={style:{setProperty(){}},classList:{add(){}},querySelector(){return null},querySelectorAll(){return []},innerHTML:''};C.render(host,data,route,{preview:true,runtime:r});return host.innerHTML;}
for(const route of ['home','portfolio','portfolio/art','portfolio/design','portfolio/photography','project/project-0','services','commissions','menu','category/prints','item/artwork-0','about','gallery','reservations','catering','contact','journal','article/0','testimonials','cart','checkout','orders','faq','delivery','refunds','privacy','terms']){const html=render(route);assert(!html.includes('Page not found'),route);assert(!html.includes('undefined'),route);}
assert.equal((render('portfolio/art').match(/class="creative-project"/g)||[]).length,2);
d.projects[0].name='<script>alert(1)</script>';assert(render('project/project-0').includes('&lt;script&gt;'));
d.hiddenSections=['hero'];assert(!render('home').includes('data-section="hero"'));
d.customPages.push({id:'my-prints',title:'My print collection'});d.pageContent['my-prints']={background:'#ffffff',color:'#111111',category:'prints',blocks:[]};assert(render('my-prints').includes('item/artwork-0'));
const variants=C.variants(d.items[0]);assert.equal(variants.length,8);assert.equal(variants[5].price,1000);r.cart=[{productId:'artwork-0',variantIndex:5,quantity:2}];assert(render('checkout').includes('R2000'));
console.log('PASS: 28 public routes render, portfolio filters work, text escapes, hidden sections stay hidden, pages link categories, and artwork variants drive checkout totals.');
