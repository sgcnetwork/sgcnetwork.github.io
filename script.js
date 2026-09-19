
function setupMenu(){
  const btn=document.querySelector('.menu');
  const links=document.querySelector('.nav-links');
  if(btn) btn.addEventListener('click',()=>links.classList.toggle('open'));
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
