// Page structure follows the Figma frames. All place names and weather values come from the active forecast.
'use strict';
const pageTitles={home:'主页',places:'观测地点',favorites:'收藏地点',plans:'我的观赏计划',photos:'分享图片',contact:'联系我们',history:'仓库留言',login:'登录 / 注册',search:'搜索地点',location:'当前位置',score:'评分说明',advice:'观赏建议',privacy:'隐私说明',terms:'使用说明',sitemap:'网站地图'};
const anchors={me:'favorites',placesSection:'places',forecastSection:'places','score-notes':'score','days-title':'home','timeline-title':'home'};
function designIcon(name){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','icon design-icon');svg.setAttribute('aria-hidden','true');
  const use=document.createElementNS(svg.namespaceURI,'use');
  use.setAttribute('href','assets/icons.svg#'+name);svg.append(use);return svg;
}
function frameLink(host,label,page,style='btn secondary'){
  const a=line(host,'a',style,label);a.href='#'+page;return a;
}
function frameHeader(host,title,desc){
  const head=line(host,'div','page-heading',''),col=line(head,'div','','');
  line(col,'h1','',title);line(col,'p','',desc);
  frameLink(head,'返回主页','home','back-link').prepend(designIcon('back'));
}
function frameBadge(host,icon){line(host,'span','frame-icon','').append(designIcon(icon));}
function stateCard(host,icon,title,desc){
  const card=line(host,'div','frame-card state-card','');
  frameBadge(card,icon);line(card,'h2','',title);line(card,'p','',desc);return card;
}
function renderFavorites(){
  const shelf=readShelf(),count=shelf.cities.length+shelf.spots.length,host=byId('favorites-content');
  host.replaceChildren();
  if(!count){
    const guest=!viewer;
    frameHeader(host,guest?'把熟悉的风景，留在这里':'收藏地点',guest?'收藏常去的观测地点，下一次更快找到今晚的天空。':'为下一次出发，留住一个好位置。');
    if(guest){
      const heading=host.querySelector('h1');
      heading.replaceChildren();line(heading,'span','desktop-favorites-title','把熟悉的风景，留在这里');line(heading,'span','mobile-favorites-title','收藏地点');
    }
    const split=line(host,'div','frame-split','');
    const card=stateCard(split,guest?'lock':'star-outline',guest?'登录后查看收藏地点':'还没有收藏地点',guest?'登录后可保存并快速查看常用地点。':'先搜索一个地点，再把它加入收藏。');
    frameLink(card,guest?'登录 / 注册':'去搜索地点',guest?'login':'search','btn primary');
    const note=line(split,'aside','frame-note','');frameBadge(note,'star');line(note,'h2','','常用地点，一次收藏');line(note,'p','','收藏让你快速找到地点。观赏计划保存具体的日期与时段。');
    return;
  }
  frameHeader(host,'收藏地点','你的常用观测地点 · '+count+' 个地点');
  const list=line(host,'div','frame-card saved-list','');
  const row=(city,spot)=>{
    const item=line(list,'article','saved-row','');frameBadge(item,'pin');
    const body=line(item,'div','','');line(body,'h2','',spot?spot.name:city.name);line(body,'p','',spot?city.name+' · '+spot.kind:'城市 · 市区参考点');
    const tools=line(item,'div','actions','');
    button(tools,'查看预测',()=>{location.hash='home';load(city,false,spot);},'btn secondary');
    button(tools,'取消收藏',()=>spot?favoriteSpot(spot,city):favoriteCity(city),'quiet');
  };
  shelf.cities.forEach(c=>row(c,null));shelf.spots.forEach(s=>row(s.location,s));
  frameLink(host,'搜索更多地点','search');
}
function renderPlans(){
  const host=byId('plans-content'),plans=getPlans();host.replaceChildren();
  setText('plan-count',plans.length?'('+plans.length+')':'');syncPlanButton();
  if(!plans.length){
    const card=stateCard(host,'clock','还没有观赏计划','在预测页选择日期，再保存观赏计划。');
    frameLink(card,'查看今日预测','home','btn primary');return;
  }
  const table=line(host,'div','frame-card plan-table','');
  const head=line(table,'div','plan-row plan-head','');
  ['地点','日期','建议观赏时段',''].forEach(l=>line(head,'span','',l));
  for(const p of plans){
    const row=line(table,'article','plan-row',''),title=line(row,'div','plan-place','');
    line(title,'h2','',p.spot?p.city.name+' · '+p.spot.name:p.city.name);
    const date=line(row,'time','',p.date);date.dateTime=p.date;
    const times=line(row,'div','plan-times','');line(times,'strong','',p.start+'–'+p.end);line(times,'small','',p.period==='sunrise'?'朝霞':'晚霞');
    const actions=line(row,'div','actions','');
    button(actions,'查看',()=>{pendingPlanDate=p.date;choosePeriod(p.period);location.hash='home';load(p.city,false,p.spot);},'btn secondary');
    button(actions,'移除',()=>{
      const key=plansKey();
      if(!storePlans(getPlans().filter(x=>x.id!==p.id)))return;
      renderPlans();tell('已移除观赏计划');
      button(byId('toast'),'撤销',()=>{if(key!==plansKey())return;const list=getPlans();if(!list.some(x=>x.id===p.id)&&storePlans([...list,p])){renderPlans();tell('已恢复观赏计划');}},'quiet');
    },'quiet');
  }
}
function renderDataViews(){
  const day=dashboardData?.days[dayIndex],e=day?.[period];
  setText('live-score',e?.score??'—');
  setText('score-place',e?pointName()+' · '+cnDate(day.date)+' · '+periodName()+'条件'+e.grade:'正在等待所选地点的预报。');
  setText('advice-place',selectedSpot?selectedSpot.name:'找一处'+(period==='sunrise'?'东':'西')+'侧无遮挡的位置');
  setText('advice-copy',selectedSpot?.note||'优先选择可公开到达、视野开阔的位置。出发前结合现场天气与交通情况，再决定是否前往。');
}
const searchBox=byId('cityInput').closest('.searchbox');
const geoBox=byId('location-status');
function route(){
  const hash=location.hash.slice(1), page=anchors[hash]||(Object.hasOwn(pageTitles,hash)?hash:'home');
  const previous=document.body.dataset.page;
  document.body.dataset.page=page;
  document.body.classList.toggle('search-screen',page==='search');
  if(previous==='location'&&page!=='location')clearLocationState();
  document.querySelectorAll('[data-page].subpage,#homePage').forEach(s=>s.hidden=s.dataset.page!==page);
  const nav={history:'contact',login:'favorites',places:'home',search:'home',location:'home',score:'home',advice:'home'}[page]||page;
  document.querySelectorAll('[data-route]').forEach(a=>{if(a.dataset.route===nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  setText('crumb',pageTitles[page]);document.title=pageTitles[page]+' · 霞时';
  if(page==='search'){
    byId('search-slot').append(searchBox);input.focus({preventScroll:true});search();
  }else if(searchBox.parentElement===byId('search-slot')){
    byId('toolbar-search-anchor').after(searchBox);closeSuggestions();
  }
  if(page==='location'){
    byId('location-panel').append(geoBox);
    if(geoBox.hidden)locationState('使用当前位置','点击重新定位匹配最近的已收录城市。');
  }
  if(page==='favorites')renderFavorites();
  if(page==='plans')renderPlans();
  if(page==='score'||page==='advice')renderDataViews();
  if(page==='history')byId('publish-draft').hidden=!byId('publish-copy').value;
  if(page==='login')configureLogin(previous);
  setDrawer(false);
  if(['days-title','timeline-title','forecastSection'].includes(hash)){
    requestAnimationFrame(()=>byId(hash)?.scrollIntoView({block:'start'}));
  }else window.scrollTo({top:0,behavior:'instant'});
}
function goComments(){location.hash='history';}
function sessionRead(key){try{return sessionStorage.getItem('xiashi:'+key)||'';}catch{return '';}}
function sessionWrite(key,val){try{if(val)sessionStorage.setItem('xiashi:'+key,val);else sessionStorage.removeItem('xiashi:'+key);}catch{}}
function configureLogin(previous){
  if(previous&&previous!=='login')sessionWrite('login-return',previous);
  byId('github-login').href='https://giscus.app/api/oauth/authorize?redirect_uri='+encodeURIComponent(location.origin+location.pathname);
}
byId('github-login').addEventListener('click',()=>sessionWrite('login-pending','1'));
function returnFromLogin(){
  if(!viewer||!sessionRead('login-pending'))return;
  const page=sessionRead('login-return');
  sessionWrite('login-pending','');location.hash=Object.hasOwn(pageTitles,page)&&page!=='login'?page:'favorites';
}
const messageBody=byId('message-body'),messageEmail=byId('message-email');
function readMessageDraft(){
  messageBody.value=sessionRead('message').slice(0,500);messageEmail.value=sessionRead('email');updateMessageCount();
}
function updateMessageCount(){setText('message-length',messageBody.value.length+' / 500');}
messageBody.oninput=()=>{sessionWrite('message',messageBody.value);updateMessageCount();byId('message-error').hidden=true;};
messageEmail.oninput=()=>sessionWrite('email',messageEmail.value);
readMessageDraft();
byId('publish-copy').value=sessionRead('pending-feedback');
if(byId('publish-copy').value)setText('publish-hint','请将草稿粘贴到下方留言框后确认发布。');
byId('dismiss-draft').onclick=()=>{
  sessionWrite('pending-feedback','');byId('publish-copy').value='';byId('publish-draft').hidden=true;
};
// A receipt needs a new comment on the authenticated user's own thread.
let threadSnapshot=null;
function observeFeedback(thread){
  if(!viewer||!thread?.url?.startsWith('https://github.com/'+REPO+'/discussions/')||thread.url===ANCHOR_URL||
     !Number.isInteger(thread.totalCommentCount))return;
  const previous=threadSnapshot;
  threadSnapshot={owner:viewer.login,url:thread.url,count:thread.totalCommentCount};
  if(!sessionRead('pending-feedback')||location.hash!=='#history'||previous?.owner!==viewer.login||
     previous.url!==thread.url||thread.totalCommentCount<=previous.count)return;
  byId('receipt-thread').href=thread.url;byId('message-receipt').hidden=false;
  byId('message-form').parentElement.hidden=true;byId('dismiss-draft').click();
  location.hash='contact';
}
byId('new-message').onclick=()=>{
  byId('message-receipt').hidden=true;byId('message-form').parentElement.hidden=false;messageBody.focus();
};
async function copyDraft(){
  try{await navigator.clipboard.writeText(byId('publish-copy').value);setText('publish-hint','留言已复制，在下方留言框粘贴后确认发布。');}
  catch{byId('publish-copy').select();setText('publish-hint','请复制草稿，粘贴到下方留言框后确认发布。');}
}
byId('message-form').onsubmit=e=>{
  e.preventDefault();
  if(!messageBody.value.trim()||!messageEmail.validity.valid){
    const empty=!messageBody.value.trim();
    byId('message-error').hidden=false;setText('message-error',empty?'请先填写留言。':'请填写有效的邮箱地址，或留空。');
    (empty?messageBody:messageEmail).focus();return;
  }
  byId('publish-copy').value=messageBody.value.trim()+(messageEmail.value?'\n\n联系邮箱：'+messageEmail.value:'');
  sessionWrite('pending-feedback',byId('publish-copy').value);byId('publish-draft').hidden=false;
  location.hash='history';copyDraft();
};
byId('copy-message').onclick=copyDraft;
const siteMap=byId('site-map');
for(const [title,keys] of [['晚霞预测',['home','days-title','score','advice']],['地点与计划',['search','location','favorites','plans']],['账户与支持',['login','photos','contact','history','privacy','terms']]]){
  const card=line(siteMap,'section','frame-card','');line(card,'h2','',title);
  keys.forEach(key=>frameLink(card,pageTitles[key]||'未来三天',key,'map-link'));
}
document.querySelectorAll('[data-locate]').forEach(b=>b.onclick=e=>{e.preventDefault();byId('locate').click();});
