const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'..','dashboard.html'),'utf8');
const settle=()=>new Promise(r=>setImmediate(r));
test('Non-demo portfolio hides locked modules and keeps scores in Quiz Results',async()=>{
 const dom=new JSDOM(html,{url:'https://sgcnetwork.co.za/dashboard.html',runScripts:'outside-only'}),w=dom.window;
 const records={sgc_console_modules:[{module_no:1,title:'Unlocked'},{module_no:2,title:'Locked'}],sgc_extra_lessons:[{id:'one',module_no:1,title:'First lesson',position:1},{id:'two',module_no:2,title:'Hidden lesson',position:1}],sgc_extra_responses:[]};
 w.sgcSupabase={auth:{getUser:async()=>({data:{user:{id:'student'}}}),onAuthStateChange:()=>{}},from(table){const q={select:()=>q,eq:()=>q,order:()=>q,then:fn=>Promise.resolve({data:records[table],error:null}).then(fn)};return q},rpc:async name=>({data:name==='sgc_extra_is_demo'?false:name==='sgc_academy_locked_modules'?[2]:[{lesson_id:'one',score:1,maximum:2,questions:[]}],error:null})};
 w.eval([...w.document.scripts].find(s=>s.textContent.includes('async function loadPortfolio')).textContent);await settle();
 assert.match(w.document.getElementById('learning-modules').textContent,/First lesson/);assert.doesNotMatch(w.document.getElementById('learning-modules').textContent,/Hidden lesson|1 \/ 2/);assert.match(w.document.getElementById('quiz-review-list').textContent,/1 \/ 2/);w.close();
});
test('First incoming private message triggers an alert after an empty inbox baseline',async()=>{
 const dom=new JSDOM(html,{url:'https://sgcnetwork.co.za/dashboard.html',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;let messages=[],poll;
 w.setInterval=fn=>{poll=fn;return 1};w.sgcSupabase={auth:{getUser:async()=>({data:{user:{id:'student'}}})},from(){const q={select:()=>q,eq:()=>q,order:()=>q,limit:async()=>({data:messages,error:null})};return q}};
 w.eval(w.document.getElementById('sgc-private-chat-alerts').textContent);await settle();assert.equal(w.document.querySelector('.sgc-chat-alert').hidden,true);
 messages=[{id:'new',created_at:'2026-10-15T10:00:00Z'}];await poll();assert.equal(w.document.querySelector('.sgc-chat-alert').hidden,false);w.close();
});
