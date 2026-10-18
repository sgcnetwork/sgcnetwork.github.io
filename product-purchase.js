(function(root){
'use strict';
function controls(host,item,config={}){
 const doc=host.ownerDocument,make=(tag,text,parent,cls)=>{const e=doc.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
 const box=make('div',null,host,'sgc-purchase-controls');let selected=null;
 const label=make('label','Quantity',box,'sgc-product-quantity');const quantity=make('input',null,label);quantity.type='number';quantity.min='1';quantity.step='1';quantity.value='1';quantity.setAttribute('aria-label','Quantity');
 const buy=make('button','Buy now',box,'sgc-buy-now');buy.type='button';
 const status=make('p',null,box,'sgc-purchase-status');status.setAttribute('role','status');
 function price(){const value=selected?.price!==''&&selected?.price!=null?selected.price:item.onSale&&item.salePrice!=null?item.salePrice:item.price;return value==null||value===''?null:Number(value);}
 function stock(){return Number(selected?.stock??item.stock??0);}
 function update(variant){selected=variant||null;const out=item.trackStock&&(!item.variants?.length||selected)&&stock()<1;buy.disabled=!!out;buy.textContent=out?'Sold out':price()==null?'Enquire':'Buy now';if(item.trackStock&&(!item.variants?.length||selected))quantity.max=String(stock());else quantity.removeAttribute('max');status.textContent='';}
 buy.onclick=()=>{
  status.textContent='';if(item.variants?.length&&!selected){status.textContent='Choose a product option first.';return;}
  const count=Number(quantity.value);if(!Number.isSafeInteger(count)||count<1){status.textContent='Enter a quantity of at least 1.';return;}
  if(item.trackStock&&count>stock()){status.textContent='Only '+stock()+' available for this option.';return;}
  const unit=price();if(unit!==null&&(!Number.isFinite(unit)||unit<0)){status.textContent='Please contact the store to confirm this price.';return;}
  const dialog=make('dialog',null,doc.body,'sgc-order-review');const heading=make('h2','Review your order',dialog);heading.id='sgc-order-review-title';dialog.setAttribute('aria-labelledby',heading.id);
  const row=make('div',null,dialog,'sgc-order-product');const url=root.SgcProductMedia?.variantImages(item,selected)?.[0];if(url){const img=make('img',null,row);img.src=url;img.alt=item.name;}
  const info=make('div',null,row);make('strong',item.name,info);if(selected)make('p',selected.label||Object.values(selected.attributes||{}).join(' / '),info);make('p','Quantity: '+count,info);
  const amount=unit===null?'Price to be confirmed':'R '+(unit*count).toFixed(2);make('p','Total: '+amount,dialog,'sgc-order-total');
  const extra=config.details?.value?.trim()||'';if(extra)make('p',extra,dialog);
  const message=['Hi, I would like to order:',item.name,selected?'Option: '+(selected.label||Object.values(selected.attributes||{}).join(' / ')):'','Quantity: '+count,'Total: '+amount,extra,'Please confirm availability, delivery and payment details.'].filter(Boolean).join('\n');
  const actions=make('div',null,dialog,'sgc-order-actions');
  if(config.preview){make('p','Preview only — no order or payment will be sent.',dialog,'muted');}
  else{
   const p=config.preferences||{};let available=false;
   const addLink=(text,href)=>{const a=make('a',text,actions,'sgc-buy-now');a.href=href;a.target='_blank';a.rel='noopener noreferrer';available=true;};
   try{const u=new URL(p.whatsapp);if(u.protocol==='https:'&&['wa.me','api.whatsapp.com','web.whatsapp.com','www.whatsapp.com'].includes(u.hostname)){u.searchParams.set('text',message);addLink('Send order on WhatsApp',u.href);}}catch{}
   if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email||''))addLink('Send order by email','mailto:'+p.email+'?subject='+encodeURIComponent('Order: '+item.name)+'&body='+encodeURIComponent(message));
   make('p',available?'Send your order to the store to confirm delivery and arrange payment. Nothing is charged here.':'This store has not added an order email or WhatsApp contact yet. Please contact the business to order.',dialog,'muted');
  }
  const close=make('button',config.preview?'Close preview':'Continue shopping',actions,'sgc-order-close');close.type='button';const dismiss=()=>{dialog.close();dialog.remove();};close.onclick=dismiss;dialog.oncancel=e=>{e.preventDefault();dismiss();};dialog.showModal();
 };
 update(null);return {update,quantity,button:buy};
}
root.SgcProductPurchase={controls};
})(window);
