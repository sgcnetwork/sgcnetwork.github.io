(function(root){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
function create({slug,products=[],storage,preview=false}){
 const key='sgc-store-cart:'+slug,historyKey='sgc-store-orders:'+slug;let lines=[],pending=null,history=[];
 try{const saved=JSON.parse(storage?.getItem(key)||'null');if(Array.isArray(saved?.lines))lines=saved.lines.slice(0,50);pending=saved?.pending||null;const orders=JSON.parse(storage?.getItem(historyKey)||'[]');if(Array.isArray(orders))history=orders.slice(0,30);}catch{}
 const save=()=>{try{storage?.setItem(key,JSON.stringify({lines,pending}));storage?.setItem(historyKey,JSON.stringify(history));}catch{}};
 const lineKey=(id,index)=>id+':'+(index??-1);
 function resolve(line){const item=products.find(p=>p.id===line.productId&&p.active!==false);if(!item)return {...line,available:false,error:'This product is no longer available'};const hasVariants=!!item.variants?.length;let variantIndex=line.variantIndex;if(hasVariants&&line.variantLabel){variantIndex=item.variants.findIndex(v=>line.variantAttributes&&Object.keys(line.variantAttributes).length?JSON.stringify(v.attributes)===JSON.stringify(line.variantAttributes):v.label===line.variantLabel);}const variant=hasVariants?item.variants[variantIndex]:null;if(hasVariants&&!variant)return {...line,item,available:false,error:'Choose a current product option'};
  const raw=variant?.price!==''&&variant?.price!=null?variant.price:item.onSale&&item.salePrice!=null?item.salePrice:item.price;const price=raw==null||raw===''?NaN:Number(raw),quantity=Number(line.quantity),stock=Number(variant?.stock??item.stock??0);
  const available=Number.isFinite(price)&&price>=0&&Number.isInteger(quantity)&&quantity>0&&quantity<=999&&(!item.trackStock||quantity<=stock);
  return {...line,variantIndex,item,variant,price,cents:Math.round(price*100),available,error:available?'':item.trackStock&&quantity>stock?'Not enough stock for this quantity':'Contact the store to confirm availability'};
 }
 function editable(){if(pending)throw Error('Retry your pending checkout before changing the cart.');}
 function add(item,variant,quantity){editable();const variantIndex=item.variants?.length?item.variants.indexOf(variant):null;if(item.variants?.length&&variantIndex<0)throw Error('Choose a product option first.');const k=lineKey(item.id,variantIndex),old=lines.find(l=>lineKey(l.productId,resolve(l).variantIndex)===k);const line={productId:item.id,variantIndex,quantity:Number(quantity)+(old?.quantity||0),...(variant?{variantLabel:variant.label||'',variantAttributes:variant.attributes||null}:{})};const checked=resolve(line);if(!checked.available)throw Error(checked.error);if(!old&&lines.length>=50)throw Error('Your cart can contain up to 50 product options.');if(old)Object.assign(old,line);else lines.push(line);save();}
 function update(index,quantity){editable();const line={...lines[index],quantity:Number(quantity)};const checked=resolve(line);if(!checked.available)throw Error(checked.error);lines[index]=line;save();}
 function remove(index){editable();lines.splice(index,1);save();}
 function view(){const entries=lines.map(resolve);return {lines:entries,total:entries.reduce((n,l)=>n+(l.available?l.cents*l.quantity:0),0)/100,valid:entries.length>0&&entries.every(l=>l.available),pending:!!pending};}
 async function place(customer,send){const state=view();if(!pending&&!state.valid)throw Error('Review the unavailable products in your cart.');if(preview)return {preview:true,total:state.total};
  if(!pending){pending={key:root.crypto.randomUUID(),items:state.lines.map(line=>({productId:line.productId,variantIndex:line.variantIndex??null,quantity:line.quantity,...(line.variant?{variantLabel:line.variant.label||'',variantAttributes:line.variant.attributes||null}:{})}))};save();}
  try{const result=await send({action:'checkout',slug,key:pending.key,items:pending.items,customer});const order=result.order;if(!order?.id)throw Error('Order confirmation was not received. Retry to check its status.');history.unshift({key:pending.key,orderNumber:order.orderNumber,id:order.id,total:order.total,status:order.status,paymentStatus:order.paymentStatus});history=history.slice(0,30);lines=[];pending=null;save();return order;}catch(error){if(error.definitive){pending=null;save();}throw error;}
 }
 return {add,update,remove,view,place,history:()=>clone(history),setProducts(next){products=next;},pending:()=>pending?clone(pending):null};
}
const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.SgcCart=api;
})(typeof window==='object'?window:globalThis);
