// Start an isolated Next server for Stage 2 only; fake service endpoints, no mail.
/* eslint-disable @typescript-eslint/no-require-imports -- Node regression runner. */
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const lock=require('../package-lock.json');
for(const name of ['next','react','@supabase/ssr','@supabase/supabase-js','@supabase/auth-js']){
 const installed=JSON.parse(fs.readFileSync(path.join(root,'node_modules',name,'package.json'),'utf8')).version;
 if(installed!==lock.packages['node_modules/'+name].version)throw Error('Run npm ci first: dependency differs from lockfile: '+name);
}
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://isolated-test.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fake_test_only',NEXT_TELEMETRY_DISABLED:'1'};
const run=file=>new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[path.join(__dirname,file)],{cwd:root,env,stdio:'inherit'});
 child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(file+' failed with '+code)));
});
(async()=>{
 // Refuse an occupied port instead of testing an unknown server.
 const net=require('node:net');
 await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(3100,'127.0.0.1',()=>probe.close(resolve))});
 const server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3100'],{cwd:root,env,stdio:['ignore','ignore','inherit']});
 try{
  let started=false,spawnError;
  server.once('error',error=>{spawnError=error});
  const deadline=Date.now()+90000;
  while(Date.now()<deadline){
   if(spawnError)throw spawnError;
   if(server.exitCode!==null)throw Error('Isolated Next server exited');
   try{const response=await fetch('http://127.0.0.1:3100/login',{signal:AbortSignal.timeout(2000)});if(response.ok){started=true;break}}catch{}
   await new Promise(resolve=>setTimeout(resolve,300));
  }
  if(!started)throw Error('Isolated Next server did not become ready');
  for(const file of ['stage2-isolation.cjs'])await run(file);
  console.log('PASS Stage 2 isolated Auth review using locked application dependencies');
 }finally{server.kill('SIGTERM')}
})().catch(error=>{console.error(error.message);process.exitCode=1});
