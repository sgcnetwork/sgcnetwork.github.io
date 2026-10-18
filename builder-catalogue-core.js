(function(root){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const slug=value=>String(value||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50);
  function money(value){if(value===''||value==null)return null;const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('Prices must be valid positive amounts or blank.');return Math.round(n*100)/100;}
  function quantity(value){const n=Number(value||0);if(!Number.isInteger(n)||n<0)throw Error('Stock must be a whole number of zero or more.');return n;}
  function combinations(options,previous=[]){
    if(!options.length)return [];
    const names=new Set();
    for(const o of options){o.name=String(o.name||'').trim();o.values=[...new Set(o.values.map(x=>String(x).trim()).filter(Boolean))];if(!o.name||!o.values.length)throw Error('Every option needs a name and at least one choice.');if(names.has(o.name.toLowerCase()))throw Error('Option names must be unique.');names.add(o.name.toLowerCase());}
    if(options.reduce((n,o)=>n*o.values.length,1)>100)throw Error('Use at most 100 variant combinations per product.');
    return options.reduce((rows,o)=>rows.flatMap(row=>o.values.map(v=>({...row,[o.name]:v}))),[{}]).map(attributes=>{const key=JSON.stringify(Object.entries(attributes).sort());const old=previous.find(v=>JSON.stringify(Object.entries(v.attributes||{}).sort())===key);return {...(old||{}),attributes,label:Object.values(attributes).join(' / '),price:old?.price??null,sku:old?.sku||'',stock:old?.stock??0,image:old?.image||''};});
  }
  function validate(item,isProduct=true){
    const value=copy(item);value.name=String(value.name||'').trim();if(!value.name)throw Error('Enter a name first.');
    value.price=money(item.price);value.salePrice=money(item.salePrice);
    if(value.onSale&&(value.price===null||value.salePrice===null||value.salePrice>=value.price))throw Error('Sale price must be lower than the normal price.');
    value.stock=quantity(value.stock);value.weightKg=value.weightKg===''||value.weightKg==null?null:Number(value.weightKg);if(value.weightKg!==null&&(!Number.isFinite(value.weightKg)||value.weightKg<0))throw Error('Enter a valid shipping weight.');
    value.seoSlug=slug(value.seoSlug||value.name);if(!value.seoSlug)throw Error('Enter a page URL using letters or numbers.');
    value.images=(value.images||[]).filter(u=>{try{return new URL(u).protocol==='https:';}catch{return false;}});
    value.categories=[...new Set((value.categories||[]).map(x=>String(x).trim()).filter(Boolean))];
    value.variants=(value.variants||[]).map(v=>({...v,price:money(v.price),stock:quantity(v.stock),description:String(v.description||''),image:value.images.includes(v.image)?v.image:'',images:(v.images||[]).filter(u=>value.images.includes(u))}));
    const expected=value.options?.length?combinations(copy(value.options),value.variants):[];
    if(expected.length&&(expected.length!==value.variants.length||expected.some(v=>!value.variants.some(row=>JSON.stringify(Object.entries(row.attributes||{}).sort())===JSON.stringify(Object.entries(v.attributes||{}).sort())))))throw Error('Generate combinations again after changing your options.');
    if(value.actionUrl){try{if(new URL(value.actionUrl).protocol!=='https:')throw Error();}catch{throw Error('Use a valid HTTPS booking or contact link.');}}
    if(!isProduct){value.onSale=false;value.variants=[];value.options=[];}
    return value;
  }
  function effectivePrice(item,variant){return variant?.price!=null&&variant.price!==''?money(variant.price):(item.onSale&&item.salePrice!=null?money(item.salePrice):money(item.price));}
  const api={copy,slug,money,quantity,combinations,validate,effectivePrice};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SgcCatalogue=api;
})(typeof window!=='undefined'?window:globalThis);
