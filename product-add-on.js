/* SGC product add-on */
document.addEventListener('DOMContentLoaded',()=>{
 const select=document.querySelector('#nicheKit'), preview=document.querySelector('#kitPreview'), button=document.querySelector('#selectedKitButton');
 if(select){
  select.addEventListener('change',()=>{
   const o=select.options[select.selectedIndex];
   if(!o.value){preview?.classList.remove('show');return;}
   preview?.classList.add('show');
   const t=preview?.querySelector('[data-selected-kit]'), p=preview?.querySelector('[data-selected-price]');
   if(t)t.textContent=o.textContent;if(p)p.textContent=o.dataset.price||'R499 once-off';
   if(button)button.href='enquiry.html?interest='+encodeURIComponent(o.value);
  });
 }
});
