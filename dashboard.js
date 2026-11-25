// The dashboard and the city/spot cards share the same coordinate-based forecast cache.
'use strict';
let dashboardData=null, dashboardRequest=0, dayIndex=0, period='sunset', pendingPlanDate=null;
let journal, journalAccount;
const currentPoint=()=>selectedSpot||selected;
const pointName=()=>selectedSpot?selected.name+' · '+selectedSpot.name:selected.name;
const periodName=()=>period==='sunset'?'晚霞':'朝霞';
const byId=id=>document.getElementById(id);
const setText=(id,value)=>{byId(id).textContent=value;};
const dayNames=['今天','明天','后天'];

function viewingWindow(event,kind){
  const shifted=minutes=>cnTime(new Date(Date.parse(event.time)+minutes*60000));
  const dawn=kind==='sunrise';
  return {arrival:shifted(dawn?-30:-20),start:shifted(dawn?-20:-10),end:shifted(dawn?10:20),sun:shifted(0)};
}
function renderFavoriteStar(){
  const shelf=readShelf();
  const saved=selectedSpot?shelf.spots.some(s=>s.id===selectedSpot.id):shelf.cities.some(c=>cityKey(c)===cityKey(selected));
  const star=byId('favorite-place');star.querySelector('use').setAttribute('href','assets/icons.svg#'+(saved?'star-filled':'star-outline'));
  star.setAttribute('aria-pressed',String(saved));
  star.title=star.ariaLabel=(saved?'取消收藏':'收藏')+pointName();
}
function renderDates(){
  const host=byId('forecast-tabs');
  host.replaceChildren();
  dashboardData.days.forEach((day,index)=>{
    const event=day[period], range=viewingWindow(event,period);
    const tab=button(host,'',()=>{
      dayIndex=index;renderDashboard();
      host.children[index].focus({preventScroll:true});
    },'day');
    tab.setAttribute('aria-pressed',String(index===dayIndex));
    const title=line(tab,'span','day-name','');
    line(title,'span','desktop-day',dayNames[index]+' · ');line(title,'span','',cnDate(day.date).split('日')[0]+'日');
    line(tab,'strong','day-level',event.grade);
    line(tab,'span','day-window',range.start+'–'+range.end);
    const bar=line(tab,'div','date-meter','');
    for(let i=0;i<3;i++)line(bar,'i',i<(event.score>=70?3:event.score>=40?2:1)?'on':'','');
    line(tab,'small','day-score','较弱 → 较佳');
    tab.setAttribute('aria-label',title.textContent+'，'+periodName()+'条件'+event.grade+'，'+range.start+' 到 '+range.end+'，指数 '+event.score);
  });
}
function forecastState(state, error=''){
  const loading=state==='loading', ready=state==='ready';
  byId('homePage').classList.toggle('awaiting-forecast',!ready);
  byId('forecast-state').hidden=ready;
  if(ready)return;
  setText('state-place',pointName());
  setText('state-subtitle',loading?'正在获取这个地点的预测数据…':'暂时无法获取这个地点的预测数据。');
  byId('forecast-loading').hidden=!loading;byId('forecast-unavailable').hidden=loading;
  setText('state-error',error);
}
function renderDashboard(){
  forecastState('ready');
  const day=dashboardData.days[dayIndex], e=day[period], dawn=period==='sunrise';
  const w=viewingWindow(e,period), range=w.start+'–'+w.end;
  setText('hero-date', dayNames[dayIndex]+' · '+cnDate(day.date));
  const ended=Date.now()>Date.parse(e.time)+(dawn?10:20)*60000;
  setText('hero-source',(dashboardData.stale?'缓存预报':'气象预报')+' · '+cnTime(dashboardData.updated_at)+' 获取'+(ended?' · 时段已过':''));
  setText('mobile-source',dashboardData.stale?'缓存预报':'气象预报');
  setText('result',periodName()+'条件'+e.grade);
  setText('summary',e.reason);
  setText('window',range);setText('arrival','建议 '+w.arrival+' 前到达');setText('sunset',w.sun);
  document.querySelectorAll('[data-solar-label]').forEach(el=>el.textContent=dawn?'日出时刻':'日落时刻');
  setText('timeline-title','把握'+(dayIndex===0?(dawn?'今早':'今晚'):dayNames[dayIndex]+(dawn?'清晨':'傍晚'))+'的时间');
  setText('marker-arrive',w.arrival);setText('marker-sunset',w.sun);setText('marker-end',w.end);setText('axis-label',range);
  // The axis covers one hour. The outlined period and its markers share this scale.
  document.querySelector('[data-moment=sunset]').style.left=dawn?'66.6667%':'50%';
  byId('timeline-feedback').textContent=dawn?'建议时段取日出前 20 分钟至日出后 10 分钟。':'建议时段取日落前 10 分钟至日落后 20 分钟。';
  const factors=byId('factors');factors.replaceChildren();
  for(const [label,value] of [['中高云量',Math.round((e.cloud_mid+e.cloud_high)/2)],['低云量',e.cloud_low],['降水概率',e.rain_probability]]){
    const row=button(factors,'',()=>showFactors(e),'factor');line(row,'span','',label);
    const track=line(row,'div','track','');line(track,'div','fill','').style.width=value+'%';
    line(row,'strong','',value+'%');
  }
  setText('factor-note','能见度 '+(e.visibility_m==null?'暂无数据':(e.visibility_m/1000).toFixed(1)+' km')+'　·　湿度 '+(e.humidity_pct==null?'—':e.humidity_pct+'%'));
  setText('tip-head',selectedSpot?selectedSpot.name:'找一处'+(dawn?'东':'西')+'侧无遮挡的位置');
  setText('tip-body',selectedSpot?selectedSpot.note||'出发前确认开放时间和现场视野。':'在'+selected.name+'的景点列表中，比较各处的云量、观赏指数和'+(dawn?'日出':'日落')+'时间。');
  byId('retry-hero').hidden=true;
  byId('save').disabled=false;
  document.querySelectorAll('[data-needs-forecast]').forEach(el=>el.hidden=false);
  setText('time-source','北京时间 UTC+8 · '+byId('hero-source').textContent);
  setText('timeline-intro',(dawn?'日出':'日落')+'是一个时刻，建议观赏是一段时间。');
  renderDataViews();renderDates();syncPlanButton();
}
async function loadDashboard(force=false){
  const run=++dashboardRequest;
  setText('hero-city',pointName());renderFavoriteStar();
  if(!force||!dashboardData){
    dashboardData=null;dayIndex=0;renderDataViews();forecastState('loading');
    byId('save').querySelector('span').textContent='保存观赏计划';
    byId('save').setAttribute('aria-pressed','false');
    for(const id of ['hero-date','summary','arrival','sunset'])setText(id,'');
    setText('window','—');setText('hero-source','正在获取预报');setText('result','正在查看'+periodName()+'条件');
    byId('save').disabled=true;byId('retry-hero').hidden=true;
    document.querySelectorAll('[data-needs-forecast]').forEach(el=>el.hidden=true);
  }
  try{
    const data=await forecastDirect(currentPoint(),force);
    if(run!==dashboardRequest)return;
    const target=pendingPlanDate||dashboardData?.days[dayIndex]?.date;
    dashboardData=data;dayIndex=Math.max(0,data.days.findIndex(d=>d.date===target));pendingPlanDate=null;
    renderDashboard();
  }catch(error){
    if(run!==dashboardRequest)return;
    pendingPlanDate=null;byId('retry-hero').hidden=false;
    setText('hero-source',dashboardData?'更新失败 · 显示上次预报':'暂未取得预报');
    if(!dashboardData){forecastState('error',error.message);setText('result',periodName()+'预报暂不可用');}
    setText('summary',error.message);
  }
}
window.addEventListener('citychange',()=>loadDashboard());
window.addEventListener('forecastrefresh',()=>loadDashboard(true));
byId('state-retry').onclick=byId('retry-hero').onclick=()=>loadDashboard(true);
byId('favorite-place').onclick=()=>selectedSpot?favoriteSpot(selectedSpot,selected):favoriteCity(selected);
function choosePeriod(value){
  period=value;byId('periodPicker').value=value;
  if(dashboardData)renderDashboard();
  else {
    setText('result',periodName()+(byId('retry-hero').hidden?'预报加载中':'预报暂不可用'));
    document.querySelectorAll('[data-solar-label]').forEach(el=>el.textContent=value==='sunrise'?'日出时刻':'日落时刻');
  }
}
byId('periodPicker').onchange=e=>choosePeriod(e.target.value);

function plansKey(){return currentShelf().replace('favorites','plans');}
function getPlans(){
  try{const data=JSON.parse(localStorage.getItem(plansKey())||'[]');return Array.isArray(data)?data.filter(p=>p&&safeCity(p.city)&&typeof p.date==='string'&&['sunrise','sunset'].includes(p.period)&&(!p.spot||hasCoordinates(p.spot))):[];}catch{return [];}
}
function storePlans(plans){
  try{localStorage.setItem(plansKey(),JSON.stringify(plans));return true;}
  catch{tell('当前浏览器无法保存观赏计划。');return false;}
}
function planId(){return [currentPoint().latitude,currentPoint().longitude,dashboardData.days[dayIndex].date,period].join('/');}
function syncPlanButton(){
  if(!dashboardData)return;
  const saved=getPlans().some(p=>p.id===planId());
  byId('save').querySelector('span').textContent=saved?'已保存 · 查看计划':'保存观赏计划';
  byId('save').setAttribute('aria-pressed',String(saved));
}
byId('save').onclick=()=>{
  if(!dashboardData)return;
  const plans=getPlans(),id=planId();
  if(plans.some(p=>p.id===id)){location.hash='plans';return;}
  const day=dashboardData.days[dayIndex], range=viewingWindow(day[period],period);
  if(storePlans([...plans,{id,city:selected,spot:selectedSpot,date:day.date,period,start:range.start,end:range.end}])){
    renderPlans();tell('已保存到我的观赏计划');
  }
};
function refreshAccountViews(){
  renderFavoriteStar();renderPlans();
  const key=viewer?.login?.toLowerCase()||'';
  if(key===journalAccount)return;
  journal?.destroy();journalAccount=key;journal=createPhotoJournal(key);
  journal.mount({host:byId('photos-content'),isLoggedIn:()=>!!viewer,onLogin:()=>{location.hash="login";},onToast:tell,getPlace:pointName});
}
function setDrawer(open){
  byId('sidebar').classList.toggle('open',open);byId('drawer-shade').classList.toggle('visible',open);
  byId('menu-button').setAttribute('aria-expanded',String(open));
  if(open)byId('sidebar-close').focus();
}
byId('sidebar').querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
  setDrawer(false);
  if(link.hash==='#home'&&location.hash==='#home')window.scrollTo({top:0,behavior:'instant'});
}));
byId('menu-button').onclick=()=>setDrawer(true);
for(const id of ['drawer-shade','sidebar-close'])byId(id).onclick=()=>{setDrawer(false);byId('menu-button').focus();};
document.addEventListener('keydown',e=>{
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(phoneLayout.matches)openSearch();else input.focus();}
  if(e.key==='Escape'&&byId('sidebar').classList.contains('open'))byId('sidebar-close').click();
});
const phoneLayout=matchMedia('(width < 600px)');
phoneLayout.addEventListener('change',()=>setDrawer(false));
let locationAttempt=0;
function clearLocationState(){
  locationAttempt++;
  byId('locate').disabled=false;byId('location-status').hidden=true;
  document.body.classList.remove('locating-screen');
}
function locationState(title,copy){
  byId('location-status').hidden=false;setText('location-title',title);setText('location-message',copy);
  byId('retry-location').hidden=byId('locate').disabled;document.body.classList.add('locating-screen');
}
function openSearch(){
  if(location.hash!=='#search')location.hash='search';
  else {input.focus();search();}
}
byId('retry-location').onclick=()=>byId('locate').click();
byId('manual-search').onclick=()=>{clearLocationState();openSearch();};
byId('locate').onclick=()=>{
  if(location.hash!=='#location')location.hash='location';
  closeSuggestions();
  const attempt=++locationAttempt;
  const finishError=(title,detail)=>{if(attempt!==locationAttempt)return;byId('locate').disabled=false;locationState(title,detail);};
  if(!navigator.geolocation){finishError('此浏览器无法定位','可以输入城市名称查找观测地点。');return;}
  byId('locate').disabled=true;locationState('正在定位','正在匹配距离你最近的已收录城市。');
  navigator.geolocation.getCurrentPosition(pos=>{
    if(attempt!==locationAttempt)return;
    const {latitude,longitude}=pos.coords;
    const radians=Math.PI/180;
    const dist=c=>Math.sin((c.latitude-latitude)*radians/2)**2+Math.cos(latitude*radians)*Math.cos(c.latitude*radians)*Math.sin((c.longitude-longitude)*radians/2)**2;
    const city=[...presets,...window.CITY_INDEX].reduce((a,b)=>dist(a)<=dist(b)?a:b);
    const km=12742*Math.asin(Math.min(1,Math.sqrt(dist(city))));
    if(km>200){finishError('附近暂无收录城市','请手动输入城市或景点名称。');return;}
    clearLocationState();load(city);tell('最近的已收录城市为'+city.name+'，距市区参考点约 '+Math.round(km)+' 公里。');
  },e=>finishError(e.code===1?'位置权限未开启':'未能取得当前位置','可在浏览器中允许定位，或手动搜索城市和景点。'),{timeout:8000,maximumAge:300000});
};
input.addEventListener('input',clearLocationState);
const footer=byId('phone-footer');
for(const group of document.querySelectorAll('.footer-columns>div')){
  const details=line(footer,'details','','');line(details,'summary','',group.querySelector('h3').textContent);
  group.querySelectorAll('a').forEach(a=>details.appendChild(a.cloneNode(true)));
}
document.querySelectorAll('[data-explain]').forEach(b=>b.onclick=()=>{
  if(!dashboardData)return;
  const event=dashboardData.days[dayIndex][period], w=viewingWindow(event,period);
  const isTime=b.dataset.explain==='time';
  setText('detail-title',isTime?'如何阅读观赏时间轴':'观赏指数怎么算');
  setText('detail-context',pointName()+' · '+cnDate(dashboardData.days[dayIndex].date)+' · '+periodName());
  const copy=isTime
    ? ['建议到达 '+w.arrival+'，给找位置和准备相机留出时间。','建议观赏 '+w.start+'–'+w.end+'，在这段时间留意天空的变化。',(period==='sunset'?'日落':'日出')+'时刻为 '+w.sun+'。'].join('\n')
    : '指数综合低云、中云、高云、降水概率和能见度。'+pointName()+'本次'+periodName()+'指数为 '+event.score+' / 100。'+event.reason+'该指数尚未经实测校准。';
  byId('other-period').hidden=!isTime;setText('other-period',period==='sunset'?'查看朝霞':'查看晚霞');
  setText('detail-copy',copy);byId('forecast-detail').showModal();
});

byId('other-period').onclick=()=>{
  choosePeriod(period==='sunset'?'sunrise':'sunset');
  byId('forecast-detail').close();
};

function showFactors(e){
  byId('other-period').hidden=true;
  setText('detail-title','读数据，也保留不确定性');
  setText('detail-context',pointName()+' · '+cnDate(dashboardData.days[dayIndex].date)+' · '+periodName());
  setText('detail-copy',pointName()+' · '+periodName()+'。中云量 '+e.cloud_mid+'%，高云量 '+e.cloud_high+'%，图中的中高云量取两层平均值。低云量 '+e.cloud_low+'%，降水概率 '+e.rain_probability+'%。各项分别计量。');
  byId('forecast-detail').showModal();
}
