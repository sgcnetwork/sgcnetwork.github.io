(function(){
'use strict';
const css=document.createElement('style');
css.textContent=`
.sgc-color-picker{display:grid;grid-template-columns:minmax(130px,1fr) minmax(170px,1.1fr);gap:13px;padding:13px;margin:8px 0 15px;background:#fff;border:1px solid #e8dfe5;border-radius:14px;box-shadow:0 5px 17px #54374a12;max-width:520px}
.sgc-color-swatches{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:5px;align-content:start}
.sgc-color-swatch{aspect-ratio:1;border:1px solid #00000010;border-radius:4px;cursor:pointer;padding:0;min-width:0;position:relative}
.sgc-color-swatch[aria-pressed=true]::after{content:'✓';position:absolute;inset:0;display:grid;place-items:center;color:white;text-shadow:0 1px 3px #000;font-size:15px}
.sgc-color-main{display:grid;grid-template-columns:minmax(0,1fr) 15px;gap:8px}
.sgc-color-square{height:160px;border-radius:6px;position:relative;cursor:crosshair;touch-action:none;overflow:hidden}
.sgc-color-dot{position:absolute;width:13px;height:13px;border:2px solid white;box-shadow:0 0 2px 1px #333;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none}
.sgc-color-hue{width:15px;height:160px;appearance:none;-webkit-appearance:none;writing-mode:vertical-lr;direction:rtl;border:0;border-radius:8px;background:linear-gradient(to bottom,red,#ff0,lime,cyan,blue,magenta,red);cursor:pointer}
.sgc-color-hue::-webkit-slider-thumb{appearance:none;width:19px;height:12px;border-radius:6px;background:white;border:1px solid #ccc;box-shadow:0 0 2px #555}
.sgc-color-hex{grid-column:1/-1;width:100%;border:1px solid #ded2dd!important;border-radius:8px;padding:9px;text-align:center;font:13px monospace}
.sgc-color-picker[hidden]{display:none!important}
@media(max-width:510px){.sgc-color-picker{grid-template-columns:1fr}.sgc-color-swatches{grid-template-columns:repeat(10,minmax(0,1fr))}}
`;
document.head.append(css);
const hex=n=>Math.max(0,Math.min(255,Math.round(n))).toString(16).padStart(2,'0');
const rgbToHex=rgb=>'#'+rgb.map(hex).join('');
function hsvRgb(h,s,v){const f=n=>{const k=(n+h/60)%6;return Math.round((v-v*s*Math.max(Math.min(k,4-k,1),0))*255)};return [f(5),f(3),f(1)]}
function rgbHsv(rgb){let [r,g,b]=rgb.map(x=>x/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,h=0;if(d){switch(max){case r:h=((g-b)/d)%6;break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}h=(h*60+360)%360;}return [h,max?d/max:0,max];}
const palette=['#000000','#333333','#555555','#888888','#bbbbbb','#dddddd','#eeeeee','#ffffff','#e63b25','#f27a31','#f3aa37','#f5d766','#a8d29c','#85c8dd','#86b2e8','#bba3d9','#f58b9a','#f8b4b6','#ffd38b','#c8e3b5','#b2d9e3','#b2c9f1','#9e9cce','#e1b4cf','#eb6a6c','#f49c53','#f3c847','#80bc78','#69b5ae','#6596d8','#8979b8','#b76d96','#e33b27','#e7782c','#f3b329','#67a951','#39989a','#337ab8','#694d9e','#ad4b82','#b90d0d','#bc420b','#ca8b00','#397f33','#11717a','#07559b','#402779','#7d255a','#7d0909','#8c390c','#996800','#2c5c2a','#16565d','#123f69','#311d5a','#632344'];
function enhance(input){
 if(input.dataset.sgcPicker)return;input.dataset.sgcPicker='1';
 const wrap=document.createElement('div');wrap.className='sgc-color-picker';input.insertAdjacentElement('afterend',wrap);
 const swatches=document.createElement('div');swatches.className='sgc-color-swatches';
 const main=document.createElement('div');main.className='sgc-color-main';
 const square=document.createElement('div');square.className='sgc-color-square';square.setAttribute('aria-label','Colour saturation and brightness');
 const dot=document.createElement('span');dot.className='sgc-color-dot';square.append(dot);
 const hue=document.createElement('input');hue.type='range';hue.min='0';hue.max='360';hue.value='0';hue.className='sgc-color-hue';hue.setAttribute('aria-label','Colour hue');
 const hexInput=document.createElement('input');hexInput.type='text';hexInput.className='sgc-color-hex';hexInput.maxLength=7;hexInput.setAttribute('aria-label','Hex colour code');
 main.append(square,hue,hexInput);wrap.append(swatches,main);
 let h=0,s=1,v=1;
 function updateUi(){square.style.background='linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),hsl('+h+' 100% 50%)';dot.style.left=(s*100)+'%';dot.style.top=((1-v)*100)+'%';hue.value=String(Math.round(h));hexInput.value=input.value.toUpperCase();swatches.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.hex===input.value.toLowerCase())));}
 function setColor(color){if(!/^#[0-9a-f]{6}$/i.test(color))return;input.value=color.toLowerCase();const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));[h,s,v]=rgbHsv(rgb);updateUi();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
 for(const color of palette){const b=document.createElement('button');b.type='button';b.className='sgc-color-swatch';b.dataset.hex=color;b.style.background=color;b.title=color;b.setAttribute('aria-label','Choose '+color);b.onclick=()=>setColor(color);swatches.append(b);}
 function chooseSquare(e){const r=square.getBoundingClientRect();s=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));v=1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));setColor(rgbToHex(hsvRgb(h,s,v)));}
 square.addEventListener('pointerdown',e=>{square.setPointerCapture(e.pointerId);chooseSquare(e);});square.addEventListener('pointermove',e=>{if(e.buttons)chooseSquare(e);});
 hue.addEventListener('input',()=>{h=Number(hue.value);setColor(rgbToHex(hsvRgb(h,s,v)));});
 hexInput.addEventListener('change',()=>{let x=hexInput.value.trim();if(/^[0-9a-f]{6}$/i.test(x))x='#'+x;setColor(x);updateUi();});
 input.addEventListener('input',()=>{const rgb=[1,3,5].map(i=>parseInt(input.value.slice(i,i+2),16));[h,s,v]=rgbHsv(rgb);updateUi();});
 input.style.width='56px';input.style.height='34px';input.title='Open browser colour picker';updateUi();
 const label=input.previousElementSibling;
 const sync=()=>{wrap.hidden=input.hidden||!!label?.hidden||!!input.closest('[hidden]');};
 const observer=new MutationObserver(sync);observer.observe(input,{attributes:true,attributeFilter:['hidden']});if(label)observer.observe(label,{attributes:true,attributeFilter:['hidden']});sync();
}
function scan(){document.querySelectorAll('#studio-editor-fields input[type=color]').forEach(enhance);}
const observer=new MutationObserver(scan);observer.observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();
})();