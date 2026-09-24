function setupMenu(){
  const btn=document.querySelector('.menu');
  const links=document.querySelector('.nav-links');
  if(!btn||!links) return;
  btn.setAttribute('aria-expanded','false');
  btn.addEventListener('click',()=>{
    const open=links.classList.toggle('open');
    btn.setAttribute('aria-expanded',String(open));
    btn.textContent=open?'✕':'☰';
  });
  links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    links.classList.remove('open');btn.setAttribute('aria-expanded','false');btn.textContent='☰';
  }));
}
function setupEnquiry(){
  const form=document.querySelector('#enquiryForm');
  const success=document.querySelector('#success');
  if(!form) return;
  form.addEventListener('submit',function(e){
    e.preventDefault();
    const data=new FormData(form);
    const name=data.get('name') || 'there';
    success.textContent=`Thank you, ${name}. Your enquiry has been captured on this page. SGC Network will be in touch using the details you provided.`;
    success.style.display='block';
    form.reset();
  });
}
document.addEventListener('DOMContentLoaded',()=>{setupMenu();setupEnquiry();});
