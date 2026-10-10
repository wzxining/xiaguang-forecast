const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','weather.js'),'utf8');
const now=Date.parse('2026-10-10T10:00:00Z');
function fixture(){return {latitude:22.5,longitude:113.9,hourly:{time:['2026-10-10T06:00','2026-10-10T18:00'],cloud_cover_low:[10,20],cloud_cover_mid:[40,60],cloud_cover_high:[30,70],precipitation_probability:[0,0],visibility:[10000,10000]},daily:{time:['2026-10-10'],sunrise:['2026-10-10T06:00'],sunset:['2026-10-10T18:00']}};}
const point={name:'白鹭坡',latitude:22.5217757,longitude:113.9671077};
const ok=()=>({ok:true,json:async()=>fixture()});
function env(fetch,storage=new Map(),time=now,timer=setTimeout){
 class Clock extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}}
 const context=vm.createContext({module:{exports:{}},URLSearchParams,AbortController,Date:Clock,TypeError,console,
 setTimeout:(fn,ms)=>timer(fn,ms===800?0:ms),clearTimeout,fetch,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
 vm.runInContext(source,context);return {api:context.module.exports,storage};
}
(async()=>{
 let calls=0;
 const recovered=env(async()=>{if(++calls===1)throw new TypeError('Failed to fetch');return ok();});
 const d=await recovered.api.forecastDirect(point);assert.equal(calls,2);assert.equal(d.stale,false);
 assert.equal(d.location.latitude,point.latitude);
 let offlineCalls=0;
 const reloaded=env(async()=>{offlineCalls++;throw new TypeError('offline');},recovered.storage);
 assert.equal((await reloaded.api.forecastDirect(point)).cached,true);assert.equal(offlineCalls,0,'fresh disk cache must survive reload');
 const stale=await reloaded.api.forecastDirect(point,true);assert.equal(stale.stale,true);assert.match(stale.warning,/连接不上/);assert.equal(offlineCalls,1,'usable saved forecast should return without a second network wait');
 let expiredCalls=0;
 const expired=env(async()=>{expiredCalls++;throw new TypeError('offline');},recovered.storage,now+7*3600000);
 await assert.rejects(expired.api.forecastDirect(point),/连接不上/);assert.equal(expiredCalls,2,'old snapshots must be rejected');
 const tomorrow=env(async()=>{throw new TypeError('offline');},recovered.storage,Date.parse('2026-10-11T00:01:00+08:00'));
 await assert.rejects(tomorrow.api.forecastDirect(point),/连接不上/);
 let rateCalls=0;
 const limited=env(async()=>{rateCalls++;return {ok:false,status:429,headers:{get:()=>120}};});
 await assert.rejects(limited.api.forecastDirect(point),/限流/);
 await assert.rejects(limited.api.forecastDirect({...point,latitude:22.6}),/限流/);assert.equal(rateCalls,1,'rate limit must pause other queued calls');
 let timeoutCalls=0;
 const timeout=env((url,{signal})=>{timeoutCalls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));},new Map(),now,(fn,ms)=>setTimeout(fn,ms>=18000?1:ms));
 await assert.rejects(timeout.api.forecastDirect(point),/超时/);assert.equal(timeoutCalls,2);
 let invalidCalls=0;
 const invalid=env(async()=>{invalidCalls++;return {ok:false,status:400};});
 await assert.rejects(invalid.api.forecastDirect(point),/400/);assert.equal(invalidCalls,1,'invalid requests should not retry');
 const started=[];
 const switching=env((url,{signal})=>{
  const lat=Number(new URL(url).searchParams.get('latitude'));started.push(lat);
  if(lat===31)return Promise.resolve(ok());
  return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
 });
 const older=Array.from({length:6},(_,i)=>switching.api.forecastDirect({...point,latitude:22+i/100}).catch(e=>e));
 await new Promise(r=>setImmediate(r));switching.api.setForecastScope([{latitude:31,longitude:point.longitude}]);
 const latest=await switching.api.forecastDirect({...point,latitude:31});assert.equal(latest.location.latitude,31);
 const cancelled=await Promise.all(older);assert.ok(cancelled.every(e=>e.code==='cancelled'));
 assert.equal(started.length,4,'three old active calls cancel, three old queued calls never fetch');
 const brokenStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 const noStorage=vm.createContext({module:{exports:{}},URLSearchParams,AbortController,Date,TypeError,setTimeout,clearTimeout,fetch:async()=>ok(),localStorage:brokenStorage});
 vm.runInContext(source,noStorage);assert.ok((await noStorage.module.exports.forecastDirect(point)).days.length);
 console.log('PASS: retry, persistent cache, stale fallback, expiry/date guards, rate-limit cooldown, timeout, non-retryable errors, city-switch cancellation, blocked storage.');
})().catch(e=>{console.error(e);process.exitCode=1;});
