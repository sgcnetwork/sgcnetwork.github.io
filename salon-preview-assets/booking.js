const form=document.querySelector('form');
const date=form.elements.day;
const service=form.elements.service;
const result=document.querySelector('.result');
const today=new Date();
date.min=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
document.querySelectorAll('.card').forEach((card)=>card.addEventListener('click',()=>{service.value=card.dataset.service;result.textContent='';}));
form.addEventListener('input',()=>{result.textContent='';});
form.addEventListener('submit',(event)=>{
 event.preventDefault();
 const day=new Intl.DateTimeFormat('en-ZA',{dateStyle:'long'}).format(new Date(date.value+'T12:00:00'));
 result.textContent='Preview request for '+service.value+' on '+day+'. This was a demo. No appointment was sent.';
});