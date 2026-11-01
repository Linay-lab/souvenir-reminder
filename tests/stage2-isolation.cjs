// Real Chromium; synthetic Auth/REST responses only. No live JWTs, mail or cloud data.
/* eslint-disable @typescript-eslint/no-require-imports -- Node regression runner. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const origin='http://127.0.0.1:3100';
const users=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'].map((id,i)=>({id,aud:'authenticated',role:'authenticated',email:`user${i}@example.invalid`,app_metadata:{},user_metadata:{},created_at:'2026-11-01T00:00:00.000Z'}));
// Fake session format for the real SDK, never accepted by a real Supabase service.
const tokens=users.map(u=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:u.id,role:u.role,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.not-a-valid-signature');
const session=i=>({access_token:tokens[i],refresh_token:'synthetic-refresh-'+i,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:users[i]});
const guest={
 'souvenir-items':JSON.stringify([{id:'guest',name:'GUEST-ONLY',quantity:2,forWho:'自己',category:'自用',place:'訪客店',price:20,note:'訪客備註',bought:false}]),
 'souvenir-trip':JSON.stringify({tripName:'GUEST-TRIP',destination:'訪客目的地',startDate:'2026-11-01',endDate:'2026-11-03'}),
 'souvenir-currency':'TWD',
 'unrelated-app-key':'KEEP-ME'
};
const results=[];
(async()=>{
 const bundled=process.env.USE_BUNDLED_CHROMIUM?require('@sparticuz/chromium'):null;
 const launchBrowser=async()=>chromium.launch({headless:true,args:bundled?bundled.args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:bundled?{executablePath:await bundled.executablePath()}: {})});
 let browser;
 try {for(const width of (process.env.STAGE2_WIDTH?[Number(process.env.STAGE2_WIDTH)]:[1440,390])){
  browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width,height:900}});
  let failure='',hold='',holdUser=0,release,entered,authReads=0,writes=0,requests=0;
  let enteredPromise;
  const pause=(stage,index)=>{hold=stage;holdUser=index;enteredPromise=new Promise(r=>{entered=r});};
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===origin)return route.continue();
   assert.equal(url.hostname,'isolated-test.supabase.co','Unexpected external request');
   requests++;
   let index=tokens.indexOf(req.headers().authorization?.replace('Bearer ',''));if(index<0)index=0;
   const stage=url.pathname.endsWith('/user')?'auth':url.pathname==='/rest/v1/trips'?'trips':url.pathname==='/rest/v1/shopping_items'?'items':'';
   if(stage==='auth')authReads++;
   if(url.pathname.startsWith('/rest/')&&req.method()!=='GET')writes++;
   if(stage&&stage===hold&&index===holdUser&&req.method()==='GET'){
    hold='';entered();await new Promise(r=>{release=r});
   }
   if(stage&&failure===stage)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic read failure'})});
   let body={};
   if(url.pathname.endsWith('/token')){index=users.findIndex(u=>u.email===req.postDataJSON().email);assert(index>=0);body=session(index);}
   else if(stage==='auth')body=users[index];
   else if(stage==='trips'){
    assert.equal(url.searchParams.get('owner_id'),'eq.'+users[index].id,'Mixed account trip request');
    body={id:'trip-'+index,owner_id:users[index].id,name:'TRIP-'+index,currency:'TWD'};
   }else if(stage==='items'){
    assert.equal(url.searchParams.get('trip_id'),'eq.trip-'+index,'Mixed account item request');
    body=[{id:'item-'+index,name:'PRIVATE-ITEM-'+index,quantity:1,recipient:'自己',category:'自用',bought:false}];
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
  });
  const first=await context.newPage(),second=await context.newPage();
  const storage=async()=>assert.deepEqual(await first.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(guest)),guest);
  const absent=async p=>assert.equal(await p.getByText('PRIVATE-ITEM-0',{exact:true}).count(),0);
  const login=async(p,i,wait=true)=>{await p.goto(origin+'/login');await p.locator('input[type=email]').fill(users[i].email);await p.locator('input[type=password]').fill('synthetic-test-password');await p.getByRole('button',{name:'登入旅購',exact:true}).click();if(wait)await p.getByRole('heading',{name:'PRIVATE-ITEM-'+i,exact:true}).waitFor();};
  const check=async(id,fn)=>{if(process.env.STAGE2_ONLY&&!process.env.STAGE2_ONLY.split(',').includes(id))return;if(process.env.STAGE2_RESUME==='desktop-T04'&&width===1440&&['T06','T01','T02','T03'].includes(id))return;await fn();results.push({test:id,width,status:'PASS',method:'Chromium + real SDK, mocked Auth/REST'});console.log('PASS '+id+' '+width+'px');};
  await first.goto(origin+'/login');await first.evaluate(values=>{for(const [k,v] of Object.entries(values))localStorage.setItem(k,v)},guest);
  await check('T06',async()=>{await first.goto(origin);await first.getByRole('heading',{name:'GUEST-ONLY',exact:true}).waitFor();await first.reload();await first.getByRole('heading',{name:'GUEST-ONLY',exact:true}).waitFor();await storage();});
  await check('T01',async()=>{await login(first,0);await storage();await first.getByRole('button',{name:'登出',exact:true}).click();await first.waitForURL(origin+'/login');await absent(first);await storage();await first.goto(origin);await first.getByRole('heading',{name:'GUEST-ONLY',exact:true}).waitFor();await storage();});
  await check('T02',async()=>{await login(first,1);await absent(first);await storage();});
  await check('T03',async()=>{await login(second,0);await first.getByRole('heading',{name:'PRIVATE-ITEM-0',exact:true}).waitFor();await login(second,1);await first.getByRole('heading',{name:'PRIVATE-ITEM-1',exact:true}).waitFor();await absent(first);await second.getByRole('button',{name:'登出',exact:true}).click();await first.waitForURL(origin+'/login');await second.waitForURL(origin+'/login');await storage();});
  if(process.env.STAGE2_RESUME==='desktop-T04'&&width===1440)await login(first,1);
  await check('T04',async()=>{await login(first,1);await first.getByRole('button',{name:'＋ 新增商品',exact:true}).click();await first.getByPlaceholder('例如：雪鹽金楚糕').fill('UNSAVED-DRAFT');await login(second,1);assert.equal(await first.getByPlaceholder('例如：雪鹽金楚糕').inputValue(),'UNSAVED-DRAFT');await second.evaluate(value=>{const c=new BroadcastChannel('sb-isolated-test-auth-token');c.postMessage({event:'TOKEN_REFRESHED',session:value});c.close();},session(1));await first.waitForTimeout(200);assert.equal(await first.getByPlaceholder('例如：雪鹽金楚糕').inputValue(),'UNSAVED-DRAFT');await first.getByRole('button',{name:'×',exact:true}).click();const before=requests;await first.waitForTimeout(300);assert(requests-before<5,'Repeated reload loop');});
  await check('T05',async()=>{const beforeWrites=writes;for(const stage of ['trips','items','auth']){failure=stage;await first.reload();await first.locator('p[role=alert]').waitFor();assert.equal(await first.getByRole('heading',{name:'PRIVATE-ITEM-1',exact:true}).count(),0);await storage();failure='';const before=authReads;await first.getByRole('button',{name:'重新載入',exact:true}).click();await first.getByRole('heading',{name:'PRIVATE-ITEM-1',exact:true}).waitFor();assert(authReads>before,'Retry did not verify user');}assert.equal(writes,beforeWrites,'Read failures caused cloud writes');});
  await check('T07',async()=>{await first.goto(origin);for(const stage of ['trips','items']){await login(second,0);await first.getByRole('heading',{name:'PRIVATE-ITEM-0',exact:true}).waitFor();pause(stage,0);await first.reload({waitUntil:'domcontentloaded'});await enteredPromise;await login(second,1);await first.getByRole('heading',{name:'PRIVATE-ITEM-1',exact:true}).waitFor();release();await first.waitForTimeout(200);await absent(first);await storage();}
   await login(second,0);await first.getByRole('heading',{name:'PRIVATE-ITEM-0',exact:true}).waitFor();pause('auth',0);await first.reload({waitUntil:'domcontentloaded'});await enteredPromise;await absent(first);await storage();await login(second,1);release();await first.getByRole('heading',{name:'PRIVATE-ITEM-1',exact:true}).waitFor();await absent(first);await storage();
  });
  await context.close();await browser.close();
 }}finally{await browser?.close();}
 console.log(JSON.stringify({scope:'Stage 2 synthetic service acceptance',results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
