function setupMenu(){
  const btn=document.querySelector('.menu');
  const links=document.querySelector('.nav-links');
  if(!btn||!links) return;

  const isMobile=()=>window.matchMedia('(max-width:800px)').matches;

  function closeMenu(){
    links.classList.remove('open');
    links.style.removeProperty('display');
    btn.setAttribute('aria-expanded','false');
    btn.textContent='☰';
  }

  btn.setAttribute('aria-expanded','false');

  btn.addEventListener('click',()=>{
    const opening=!links.classList.contains('open');
    if(opening){
      links.classList.add('open');
      if(isMobile()) links.style.setProperty('display','flex','important');
      btn.setAttribute('aria-expanded','true');
      btn.textContent='✕';
    }else{
      closeMenu();
    }
  });

  links.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));

  window.addEventListener('resize',()=>{
    if(!isMobile()) closeMenu();
  });
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

document.addEventListener('DOMContentLoaded',()=>{
  setupMenu();
  setupEnquiry();
});
