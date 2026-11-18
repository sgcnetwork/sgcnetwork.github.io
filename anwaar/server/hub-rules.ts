export function canSee(x:any,ctx:{userId:string,admin:boolean,owner:boolean,student:any}){if(ctx.admin)return !['staff','audit'].includes(x.kind)||ctx.owner;if(['admissions','messages','submissions'].includes(x.kind)&&x.userId===ctx.userId)return true;const s=ctx.student;if(!s)return x.kind==='school';if(x.id===s.id||x.studentId===s.id)return true;if(x.kind==='school')return true;if(!['classes','resources','announcements','groups','curriculum','assignments'].includes(x.kind))return false;if(x.studentId&&x.studentId!==s.id)return false;if(x.groupId&&x.groupId!==s.groupId)return false;if(x.kind==='groups'&&x.id!==s.groupId&&x.title!==s.group)return false;return true;}
export function validateRecord(kind:string,d:any,all:any[],id?:string){
const student=all.some(x=>x.kind==='students'&&x.id===d.studentId&&!x.archived);
if(['students','admissions','staff'].includes(kind)&&(!d.name||!/^\S+@\S+\.\S+$/.test(d.email||'')))return 'Enter a name and valid email.';
if(kind==='students'&&all.some(x=>x.kind==='students'&&x.id!==id&&x.email?.toLowerCase()===d.email.toLowerCase()))return 'This student email is already enrolled.';
if(kind==='students'&&d.progress!==undefined&&(!Number.isFinite(Number(d.progress))||Number(d.progress)<0||Number(d.progress)>100))return 'Progress must be between 0 and 100.';
if(['invoices','attendance','assessments','messages','submissions'].includes(kind)&&!student)return 'Select a valid enrolled student.';
if(kind==='invoices'&&(!Number.isFinite(Number(d.amount))||Number(d.amount)<=0||!Number.isFinite(Number(d.paid||0))||Number(d.paid||0)<0||Number(d.paid||0)>Number(d.amount)))return 'Enter a valid invoice amount and payment balance.';
if(kind==='receipts'&&(!Number.isFinite(Number(d.amount))||Number(d.amount)<=0||!d.date||!d.method))return 'Enter a positive payment amount, date and payment method.';
if(kind==='classes'&&(!d.title||!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')||!/^\d{2}:\d{2}$/.test(d.time||'')||!/^\d{2}:\d{2}$/.test(d.end||'')||d.end<=d.time))return 'Enter a lesson title, date and an end time after the start.';
if(['assessments'].includes(kind)&&(Number(d.maxScore)<=0||!Number.isFinite(Number(d.maxScore))||!Number.isFinite(Number(d.score))||Number(d.score)<0||Number(d.score)>Number(d.maxScore)))return 'Assessment marks must be between zero and the maximum score.';
if(kind==='groups'&&(!Number.isInteger(Number(d.capacity))||Number(d.capacity)<1))return 'Class capacity must be a positive whole number.';
if(['resources','announcements','groups','curriculum','assignments','assessments','messages'].includes(kind)&&!d.title)return 'A title is required.';
if(kind==='submissions'&&!d.answer)return 'Add your assignment response.';
if(kind==='students'&&d.groupId){const g=all.find(x=>x.id===d.groupId&&x.kind==='groups');if(!g)return 'Select an existing class group.';if(all.filter(x=>x.kind==='students'&&x.groupId===d.groupId&&x.status==='Active'&&x.id!==id).length>=Number(g.capacity)&&d.status==='Active')return 'This class group is full.';}
if(d.url){try{if(new URL(d.url).protocol!=='https:')return 'Resource links must use HTTPS.';}catch{return 'Enter a valid HTTPS link.';}}
return null;
}

