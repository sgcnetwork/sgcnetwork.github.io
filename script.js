function setupMenu(){
 const btn=document.querySelector('.menu'), links=document.querySelector('.nav-links');
 if(!btn||!links)return;
 const close=()=>{links.classList.remove('open');links.removeAttribute('style');links.querySelectorAll('a').forEach(a=>a.removeAttribute('style'));btn.textContent='☰';};
 btn.addEventListener('click',()=>{
  if(links.classList.contains('open')){close();return;}
  links.classList.add('open');
  const s=links.style;
  s.setProperty('display','flex','important');s.setProperty('flex-direction','column','important');
  s.setProperty('align-items','stretch','important');s.setProperty('gap','0','important');
  s.setProperty('position','absolute','important');s.setProperty('top','76px','important');
  s.setProperty('left','0','important');s.setProperty('right','0','important');
  s.setProperty('width','100%','important');s.setProperty('margin','0','important');
  s.setProperty('padding','10px 22px 18px','important');s.setProperty('background','#fbf4eb','important');
  s.setProperty('z-index','99999','important');
  links.querySelectorAll('a').forEach(a=>{a.style.setProperty('display','block','important');a.style.setProperty('width','100%','important');a.style.setProperty('padding','13px 0','important');a.style.setProperty('margin','0','important');a.style.setProperty('text-align','left','important');});
  btn.textContent='✕';
 });
 links.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
}
function setupEnquiry(){const form=document.querySelector('#enquiryForm'),success=document.querySelector('#success');if(!form)return;form.addEventListener('submit',e=>{e.preventDefault();const data=new FormData(form),name=data.get('name')||'there';success.textContent=`Thank you, ${name}. Your enquiry has been captured on this page. SGC Network will be in touch using the details you provided.`;success.style.display='block';form.reset();});}
document.addEventListener('DOMContentLoaded',()=>{setupMenu();setupEnquiry();});