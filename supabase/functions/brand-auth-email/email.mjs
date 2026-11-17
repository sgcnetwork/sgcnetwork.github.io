const escape = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function brandFor(user, data) {
  if (data.redirect_to) { try { const url=new URL(data.redirect_to);const legacy=(url.hostname==='sgcnetwork.co.za'||url.hostname==='www.sgcnetwork.co.za'||url.hostname==='sgcnetwork.github.io')&&/^\/babm(?:\/|$)/.test(url.pathname);return url.hostname==='babm.sgcnetwork.co.za'||legacy?'babm':'sgc'; } catch {} }
  return user.user_metadata?.brand === 'babm' ? 'babm' : 'sgc';
}
const actions = {
  signup: ['user confirmation','Confirm your email address','Please confirm your email address to finish setting up your account.','Confirm my email'],
  invite: ['You are invited','A space is waiting for you','You have been invited to create an account. Follow the link below to accept your invitation.','Accept invitation'],
  magiclink: ['Your sign-in link','Welcome back','Use this secure link to sign in to your account.','Sign in'],
  email: ['Your sign-in link','Welcome back','Use this secure link to sign in to your account.','Sign in'],
  recovery: ['Reset your password','A fresh start','We received a request to reset your password. Choose a new password using the secure button below.','Reset my password'],
  email_change: ['Confirm your email change','Confirm your email address','Please confirm this email address to complete the requested account email change.','Confirm email change'],
  reauthentication: ['Your verification code','Confirm it is you','Use the verification code below to complete your request. Never share this code.',''],
};
const notices = {
  password_changed_notification: ['Your password was changed','The password for your account was changed. If this was not you, reset your password immediately and contact support.'],
  email_changed_notification: ['Your email address was changed','Your account email address was changed. If this was not you, contact support immediately.'],
  phone_changed_notification: ['Your phone number was changed','The phone number on your account was changed. If this was not you, contact support immediately.'],
  identity_linked_notification: ['A sign-in method was linked','A new sign-in method was linked to your account. If this was not you, contact support immediately.'],
  identity_unlinked_notification: ['A sign-in method was removed','A sign-in method was removed from your account. If this was not you, contact support immediately.'],
  mfa_factor_enrolled_notification: ['A verification method was added','A new multi-factor verification method was added to your account. If this was not you, contact support immediately.'],
  mfa_factor_unenrolled_notification: ['A verification method was removed','A multi-factor verification method was removed from your account. If this was not you, contact support immediately.'],
};
function renderBabmEmail({kind, spec, link, code, notice}) {
  const heading=kind==='recovery'?'Your quiet space<br>is waiting for you.':kind==='signup'?'A beautiful intention.<br>A new beginning.':escape(spec[1]);
  const kicker=kind==='recovery'?'A LITTLE HELP SIGNING IN':kind==='signup'?'WELCOME TO YOUR BABM JOURNEY':'YOUR BABM ACCOUNT';
  const intro=kind==='recovery'?'Let’s get you back to your Qur’an, reflections and sisterhood. Use the secure button below to choose a new password.':kind==='signup'?'A warm welcome to Becoming a Better Muslimah. Confirm your email and begin making a little more room for faith, reflection and connection.':escape(spec[2]);
  const cta=link?`<table role="presentation" cellspacing="0" cellpadding="0" style="margin:25px 0 0;"><tr><td bgcolor="#86536b" style="border-radius:30px;"><a href="${escape(link)}" style="display:inline-block;border:1px solid #86536b;border-radius:30px;padding:16px 29px;font:600 14px Arial,Helvetica,sans-serif;letter-spacing:.2px;color:#ffffff;text-decoration:none;">${escape(spec[3])} &nbsp; →</a></td></tr></table>`:'';
  const otp=kind==='reauthentication'?`<p style="margin:25px 0;font:600 30px Arial,sans-serif;letter-spacing:8px;color:#86536b;">${escape(code)}</p>`:'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(spec[0])} | BABM</title><style>@media only screen and (max-width:480px){.babm-email-outer{padding:20px 12px!important}.babm-email-content{padding:28px 23px!important}.babm-email-heading{font-size:30px!important}.babm-email-brand{padding:27px 18px 23px!important}}</style></head>
<body style="margin:0;padding:0;background:#f5f0f3;color:#514650;font-family:Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(spec[0])} — a secure message from Becoming a Better Muslimah.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0f3;"><tr><td align="center" class="babm-email-outer" style="padding:36px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;"><tr><td align="center" style="padding:0 12px 20px;font-size:10px;letter-spacing:2.5px;color:#9a8291;">FAITH &nbsp; · &nbsp; REFLECTION &nbsp; · &nbsp; SISTERHOOD</td></tr>
<tr><td style="background:#fffdfa;border:1px solid #e7dbe2;border-radius:22px;overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td height="5" bgcolor="#c7a9ba" style="height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" class="babm-email-brand" style="padding:31px 24px 27px;background:#eee4ed;border-bottom:1px solid #e7dbe2;"><p style="margin:0 0 10px;font:normal 39px Georgia,'Times New Roman',serif;letter-spacing:7px;color:#79516d;">BABM</p><p style="margin:0;font:normal 18px Georgia,'Times New Roman',serif;color:#795c70;">Becoming a Better Muslimah</p><p style="margin:13px 0 0;font-size:9px;letter-spacing:2px;color:#9a7b8e;">A HEART TURNING TO ALLAH</p></td></tr>
<tr><td class="babm-email-content" style="padding:34px 36px 30px;"><p style="margin:0 0 15px;font-size:9px;font-weight:600;letter-spacing:2px;color:#a17e92;">${kicker}</p>
<h1 class="babm-email-heading" style="margin:0 0 23px;font:normal 34px/1.25 Georgia,'Times New Roman',serif;letter-spacing:-.5px;color:#684459;">${heading}</h1>
<p style="margin:0 0 12px;font-size:14px;line-height:1.8;color:#705e6c;">Assalamu alaykum, dear sister,</p><p style="margin:0;font-size:14px;line-height:1.9;color:#7f707a;">${intro}</p>${cta}${otp}
${link?`<p style="margin:18px 0 0;font-size:11px;line-height:1.8;color:#a08d99;">Button not opening? <a href="${escape(link)}" style="color:#86536b;text-decoration:underline;">Open your secure link here.</a></p>`:''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:29px;"><tr><td style="padding:17px 19px;background:#f6f0f3;border:1px solid #ebdfe6;border-radius:12px;"><p style="margin:0 0 5px;font-size:10px;font-weight:600;letter-spacing:.5px;color:#8d6e81;">${notice?'KEEPING YOUR SPACE SAFE':'JUST A GENTLE REMINDER'}</p><p style="margin:0;font-size:11px;line-height:1.8;color:#97818f;">${notice?'If this change wasn’t yours, reset your password and contact support immediately.':kind==='recovery'?'If you didn’t request a password reset, you can safely ignore this email. Your password will stay the same.':'If you didn’t request this email, you can safely ignore it.'} Never share your password or verification link.</p></td></tr></table>
<p style="margin:27px 0 0;font:italic 16px/1.6 Georgia,'Times New Roman',serif;color:#99798e;">With gentleness,</p><p style="margin:2px 0 0;font-size:12px;font-weight:600;letter-spacing:.3px;color:#805d74;">The BABM team</p></td></tr>
<tr><td align="center" style="padding:22px 24px;background:#faf6f8;border-top:1px solid #eee5e9;"><p style="margin:0;font:italic 15px/1.6 Georgia,'Times New Roman',serif;color:#a08396;">One small step. A sincere intention.</p><p style="margin:9px 0 0;font-size:9px;letter-spacing:1.5px;color:#b29eaa;">YOUR JOURNEY, AT YOUR PACE.</p></td></tr></table></td></tr>
<tr><td align="center" style="padding:21px 18px 0;font-size:10px;line-height:1.9;color:#aa97a3;">Becoming a Better Muslimah<br>A private account message from BABM. Please do not reply.<br><span style="display:inline-block;margin-top:12px;font-size:10px;letter-spacing:.3px;color:#aa97a3;">Powered by <a href="https://sgcnetwork.co.za/" style="color:#96788b;text-decoration:none;font-weight:600;">SGC Network</a></span></td></tr></table>
</td></tr></table></body></html>`;
}
export function buildEmails(event, baseUrl) {
  const {user,email_data:data}=event;
  if(!user?.email || !data?.email_action_type) throw Error('Invalid email event');
  const brand=brandFor(user,data), babm=brand==='babm', name=babm?'BABM':'SGC Network';
  const kind=data.email_action_type;
  const action=actions[kind];const notice=notices[kind];
  if(!action&&!notice)throw Error('Unsupported account email');
  const spec=action||[notice[0],notice[0],notice[1],''];
  const recipients=kind==='email_change'
    ? (data.token_hash_new ? [{email:user.email,hash:data.token_hash_new,code:data.token},{email:user.new_email,hash:data.token_hash,code:data.token_new}] : [{email:user.new_email,hash:data.token_hash,code:data.token_new||data.token}])
    : [{email:user.email,hash:data.token_hash,code:data.token}];
  return recipients.map(({email,hash,code})=>{
    if(typeof email!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid recipient');
    let redirect=babm?'https://babm.sgcnetwork.co.za/':(data.redirect_to||'https://sgcnetwork.co.za');
    const url=new URL('/auth/v1/verify',baseUrl);
    let link='';
    if(action&&kind!=='reauthentication'){
      if(!hash)throw Error('Missing verification token');
      url.search=new URLSearchParams({token:hash,type:kind==='email'?'magiclink':kind,redirect_to:redirect}).toString();link=url.toString();
    }
    const title=babm?'Becoming a Better Muslimah':'SGC Network';
    const subtitle=babm?'A HEART TURNING TO ALLAH':'LEARN · CONNECT · GROW';
    const note=babm?'Small steps. Sincere intentions.<br>A gentle space for the Muslimah you are becoming.':'A little ambition. A world of possibility.';
    const body=escape(spec[2]);
    const button=link?`<p style="margin:26px 0;"><a href="${escape(link)}" style="display:inline-block;padding:16px 26px;background:#935465;color:#ffffff;border-radius:9px;text-decoration:none;font-weight:bold;font-size:14px;">${escape(spec[3])}</a></p>`:'';
    const otp=kind==='reauthentication'?`<p style="font-size:30px;letter-spacing:7px;font-weight:bold;color:#935465;">${escape(code)}</p>`:'';
    const html=babm?renderBabmEmail({kind,spec,link,code,notice}):`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(name+' · '+spec[0])}</title></head><body style="margin:0;background:#faf4f7;color:#443b40;font-family:Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;">${escape(name+' · '+spec[0])}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:36px 16px;"><table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#fffdfb;border:1px solid #eadce2;border-radius:20px;overflow:hidden;"><tr><td align="center" style="padding:34px 28px;background:#f3e5ed;"><div style="font:40px Georgia,serif;color:#935465;">${babm?'❧':'SGC'}</div><p style="font:26px Georgia,serif;color:#75465d;margin:12px 0;">${title}</p><p style="font-size:10px;letter-spacing:2px;color:#8b687a;margin:0;">${subtitle}</p></td></tr><tr><td style="padding:32px 30px;"><p style="font-size:11px;letter-spacing:1.5px;color:#935465;">YOUR ${escape(name.toUpperCase())} ACCOUNT</p><h1 style="font:normal 30px/1.3 Georgia,serif;color:#543e4c;">${escape(spec[1])}</h1><p style="font-size:15px;line-height:1.8;">${babm?'Assalamu alaykum, dear sister,':'Hello,'}</p><p style="font-size:15px;line-height:1.8;">${body}</p>${button}${otp}<p style="padding:18px;background:#f6f1eb;border-left:3px solid #ccabbc;font-size:13px;line-height:1.8;color:#766471;">${note}</p>${link?`<p style="font-size:12px;line-height:1.8;color:#837a7f;">If the button doesn’t open, copy this link into your browser:</p><p style="font-size:11px;line-height:1.6;word-break:break-all;"><a href="${escape(link)}" style="color:#935465;">${escape(link)}</a></p>`:''}<p style="font-size:12px;line-height:1.8;color:#837a7f;margin-top:24px;">${notice?'Keep your account secure. Never share your password or verification codes.':'If you didn’t request this email, you can safely ignore it. Never share your confirmation link or password.'}</p></td></tr><tr><td align="center" style="padding:21px 24px;border-top:1px solid #eadce2;font-size:11px;line-height:1.8;color:#8b7882;">${title}<br>This is an automated account email. Please do not reply.</td></tr></table></td></tr></table></body></html>`;
    const subject=babm&&kind==='signup'?'BABM user confirmation':`${spec[0]} | ${name}`;
    return {from:`${name} <${babm?'babm':'noreply'}@sgcnetwork.co.za>`,to:[email],subject,html,text:`${title}\n\n${spec[1]}\n\n${spec[2]}\n\n${link||code||''}\n\nIf you did not request this action, keep your account secure and contact support if needed.`};
  });
}
export async function verifyHook(raw, headers, configuredSecret, now=Date.now()) {
  const id=headers.get('webhook-id'),timestamp=headers.get('webhook-timestamp'),signatures=headers.get('webhook-signature');
  if(!configuredSecret||!id||!timestamp||!signatures||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)return false;
  try{
    const secret=configuredSecret.replace(/^v1,whsec_/,'').replace(/^whsec_/,'');
    const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(secret),c=>c.charCodeAt(0)),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    const message=new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
    for(const part of signatures.split(' ')){
      const [version,signature]=part.split(',');if(version!=='v1'||!signature)continue;
      if(await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(signature),c=>c.charCodeAt(0)),message))return true;
    }
  }catch{}
  return false;
}
