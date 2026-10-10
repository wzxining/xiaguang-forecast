/* Accounts are accepted only from the live, origin-checked Giscus iframe.
   Favorites are local browser data, not an authorization system. */
'use strict';
const $=id=>document.getElementById(id);
let viewer=null, activeTerm='霞光观测站留言大厅', placeSerial=0, visiblePlaces=[], toastTimer, mapRequest;
const REPO='wzxining/xiaguang-forecast';
const ANCHOR_URL='https://github.com/'+REPO+'/discussions/1';
const currentShelf=()=> 'xiaguang:favorites:v1:'+(viewer?viewer.login.toLowerCase():'guest');
function tell(message){$('toast').textContent=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').textContent='',4500);}
function safeCity(c){return c&&typeof c.name==='string'&&c.name.length<80&&Number.isFinite(+c.latitude)&&Number.isFinite(+c.longitude)&&+c.latitude>=3&&+c.latitude<=54&&+c.longitude>=73&&+c.longitude<=135;}
function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}}
function readShelf(){try{const s=JSON.parse(localStorage.getItem(currentShelf())||'{}');return {cities:(Array.isArray(s.cities)?s.cities:[]).filter(safeCity),spots:(Array.isArray(s.spots)?s.spots:[]).filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&safeCity(x.location))};}catch{return {cities:[],spots:[]};}}
function writeShelf(s){try{localStorage.setItem(currentShelf(),JSON.stringify(s));return true;}catch{tell('浏览器无法保存收藏，请检查存储权限或空间。');return false;}}
const cityKey=c=>c.name.replace(/市$/,'')+':'+Number(c.latitude).toFixed(1)+':'+Number(c.longitude).toFixed(1);
function favoriteCity(c){const s=readShelf(),key=cityKey(c),i=s.cities.findIndex(x=>cityKey(x)===key);if(i<0)s.cities.push(c);else s.cities.splice(i,1);if(writeShelf(s)){tell(i<0?'城市已收藏':'已取消城市收藏');renderFavorites();renderCityButton();}}
function favoriteSpot(spot,city){const s=readShelf(),i=s.spots.findIndex(x=>x.id===spot.id);if(i<0)s.spots.push({...spot,location:city});else s.spots.splice(i,1);if(writeShelf(s)){tell(i<0?'景点已收藏':'已取消景点收藏');renderFavorites();renderPlaces(visiblePlaces,selected);}}
function renderCityButton(){const saved=readShelf().cities.some(c=>cityKey(c)===cityKey(selected));$('saveCity').textContent=(saved?'★ 已收藏':'☆ 收藏')+'城市';$('saveCity').setAttribute('aria-pressed',String(saved));}
function button(parent,text,action,cls='soft small'){const b=line(parent,'button',cls,text);b.type='button';b.onclick=action;return b;}
function external(parent,text,url,cls=''){const a=line(parent,'a',cls,text);a.href=safeURL(url);a.target='_blank';a.rel='noopener';return a;}
function placeCard(parent,spot,city,preview=false){
 spot=resolveSpot(spot);
 const c=line(parent,'article','place','');c.dataset.spotId=spot.id;
 c.classList.toggle('selected-place',selectedSpot?.id===spot.id);
 line(c,'span','tag',spot.kind||'地图候选');line(c,'h3','',spot.name);line(c,'p','',spot.note||'尚未核实日落方向、遮挡与开放情况。');
 line(c,'p','coordinate',coordinatesText(spot));
 if(preview){const summary=line(c,'div','spot-summary','');summary.setAttribute('aria-live','polite');summary.dataset.spotId=spot.id;fillSpotForecast(summary,spot);}
 const view=button(c,selectedSpot?.id===spot.id?'正在查看 · 三天详情':'查看此景点三天预报',()=>selectSpot(spot,city),'soft forecast-link');
 view.dataset.selectSpot=spot.id;view.disabled=!hasCoordinates(spot);if(view.disabled)view.textContent='坐标待核实 · 暂不能预报';
 const actions=line(c,'div','actions','');const saved=readShelf().spots.some(x=>x.id===spot.id);const b=button(actions,saved?'★ 已收藏':'☆ 收藏景点',()=>favoriteSpot(spot,city));b.setAttribute('aria-pressed',String(saved));external(actions,'地图 ↗',spot.map||mapLink(city.name+' '+spot.name));
 if(spot.source)external(c,spot.verified?'查看观赏资料 ↗':'查看 OpenStreetMap 记录 ↗',spot.source,'place-source');
 if(spot.coordinateSource&&spot.coordinateSource!==spot.source)external(c,'查看坐标参考位置 ↗',spot.coordinateSource,'place-source');
 return c;
}
async function fillSpotForecast(container,spot,force=false){
 const run=String(Number(container.dataset.run||0)+1);container.dataset.run=run;
 if(!hasCoordinates(spot)){container.textContent='坐标待核实，暂不提供该景点预报。';return;}
 if(!force||!container.children.length)container.textContent='正在查询景点天气，连接不稳时会自动重试…';
 try{
  const data=await forecastDirect(spot,force);
  if(container.dataset.run!==run||!container.isConnected)return;
  container.replaceChildren();
  const row=line(container,'div','spot-events','');
  for(const [key,label] of [['sunrise','朝霞'],['sunset','晚霞']]){
   const day=data.days.find(d=>new Date(d[key].time).getTime()>Date.now());
   const cell=line(row,'div','spot-event','');line(cell,'span','',label);
   if(day){const item=day[key];line(cell,'strong','',item.score+' 分');line(cell,'small','',day.date.slice(5)+' '+cnTime(item.time));line(cell,'small','',item.grade);}
   else line(cell,'small','','暂无未来时段');
  }
  line(container,'small','spot-updated',(data.stale?'暂用该景点上次缓存 · ':'')+'获取于 '+cnTime(data.updated_at));
 }catch(error){if(container.dataset.run===run&&container.isConnected){container.replaceChildren();line(container,'p','',error.message);button(container,'重试此景点',()=>fillSpotForecast(container,spot,true));}}
}
function mapLink(name){return 'https://www.amap.com/search?query='+encodeURIComponent(name);}
function renderPlaces(items,city){$('places').replaceChildren();items.forEach(s=>placeCard($('places'),s,city,true));if(!items.length)line($('places'),'div','empty','这个城市的景点名录仍在补充，可尝试查找附近地图候选点。');}
function showPlaces(city){++placeSerial;mapRequest?.abort();visiblePlaces=spotsForCity(city);if(selectedSpot&&!visiblePlaces.some(s=>s.id===selectedSpot.id))visiblePlaces=[selectedSpot,...visiblePlaces];$('placesTitle').textContent=city.name+' · 各景点霞光预报';$('mapCity').href=mapLink(city.name+' 观景台 公园');$('morePlaces').disabled=false;$('morePlaces').textContent='查找附近更多候选点';renderPlaces(visiblePlaces,city);renderCityButton();$('placesNote').textContent=visiblePlaces.length?'本站已收录 '+visiblePlaces.length+' 处地点。下方分别按景点坐标显示下一次朝霞和晚霞预报；点击可查看三天详情。':'暂未收录该城市的景点，可手动查找附近地点。';}
window.addEventListener('spotchange',()=>{document.querySelectorAll('.place[data-spot-id]').forEach(c=>{const active=c.dataset.spotId===selectedSpot?.id;c.classList.toggle('selected-place',active);const b=c.querySelector('[data-select-spot]');if(b)b.textContent=active?'正在查看 · 三天详情':'查看此景点三天预报';});});
window.addEventListener('forecastrefresh',()=>{document.querySelectorAll('#places .spot-summary').forEach(c=>{const spot=visiblePlaces.find(s=>s.id===c.dataset.spotId);if(spot)fillSpotForecast(c,spot,true);});});
async function loadNearby(city,serial=placeSerial){$('morePlaces').disabled=true;$('morePlaces').textContent='正在查找…';const key='xiaguang:nearby:v1:'+city.latitude+','+city.longitude;let data;
 try{try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&Date.now()-saved.time<86400000)data=saved.data;}catch{}
 if(!data){const q=`[out:json][timeout:10];(nwr(around:20000,${Number(city.latitude)},${Number(city.longitude)})[tourism=viewpoint][name];nwr(around:12000,${Number(city.latitude)},${Number(city.longitude)})[leisure=park][name];);out center tags 60;`;for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']){if(serial!==placeSerial)return;const controller=new AbortController();mapRequest=controller;const timer=setTimeout(()=>controller.abort(),12000);try{const r=await fetch(endpoint+'?data='+encodeURIComponent(q),{signal:controller.signal});if(!r.ok)throw Error('unavailable');data=await r.json();if(!Array.isArray(data.elements))throw Error('invalid');break;}catch{data=null;}finally{clearTimeout(timer);}}if(!data)throw Error('unavailable');try{localStorage.setItem(key,JSON.stringify({time:Date.now(),data}));}catch{}}
 if(serial!==placeSerial)return;
 const names=new Set(visiblePlaces.map(s=>s.name));const candidates=(data.elements||[]).filter(e=>e.tags?.name&&e.tags.access!=='private'&&e.tags.access!=='no').sort((a,b)=>Number(b.tags.tourism==='viewpoint')-Number(a.tags.tourism==='viewpoint')).filter(e=>{const n=e.tags['name:zh']||e.tags.name;if(names.has(n))return false;names.add(n);return true;}).map(e=>({latitude:e.lat??e.center?.lat,longitude:e.lon??e.center?.lon,coordinateLabel:e.type==='node'?'地图标注点':'景区地图范围中心',id:'osm:'+e.type+':'+e.id,name:e.tags['name:zh']||e.tags.name,kind:'地图候选 · '+(e.tags.tourism==='viewpoint'?'观景台':'公园'),note:'市中心附近的地图标注点，可能跨行政边界；尚未核实日落视野和开放情况。',source:'https://www.openstreetmap.org/'+e.type+'/'+e.id,verified:false}));visiblePlaces=[...visiblePlaces,...candidates];renderPlaces(visiblePlaces,city);if(!selectedSpot){const first=visiblePlaces.find(hasCoordinates);if(first)selectSpot(first,city,false);}$('placesNote').textContent=candidates.length?'已显示 '+visiblePlaces.length+' 处地点（地图接口最多返回 60 项附近记录）；候选点不代表已验证的朝霞或晚霞机位，也不代表全市完整名录。':'暂未找到更多有名称的候选点，可在地图中继续查找。';
 }catch{if(serial===placeSerial){$('placesNote').textContent=visiblePlaces.length?'已显示有资料来源的地点；附近地图服务暂不可用。':'这个城市的人工景点资料尚未收录，附近地图服务暂不可用。可打开地图查找，或留言补充你知道的观景点。';}}
 finally{if(serial===placeSerial){$('morePlaces').disabled=false;$('morePlaces').textContent='查找附近更多候选点';}}
}
function renderFavorites(){const s=readShelf();$('savedCities').replaceChildren();$('savedSpots').replaceChildren();$('cityCount').textContent=s.cities.length+' 个';$('spotCount').textContent=s.spots.length+' 处';if(!s.cities.length)line($('savedCities'),'div','empty','还没有收藏城市。在预报标题下点击“收藏城市”。');s.cities.forEach(c=>{const card=line($('savedCities'),'article','place','');line(card,'h3','',c.name);const a=line(card,'div','actions','');button(a,'查看预报',()=>{location.hash='home';load(c);});button(a,'取消收藏',()=>favoriteCity(c));});if(!s.spots.length)line($('savedSpots'),'div','empty','遇见喜欢的机位，就把它收藏在这里。');s.spots.forEach(s=>{placeCard($('savedSpots'),s,s.location);});}
function route(){const me=location.hash==='#me';$('homePage').hidden=me;$('mePage').hidden=!me;$('homeNav').toggleAttribute('aria-current',!me);$('meNav').toggleAttribute('aria-current',me);if(me)$('meNav').setAttribute('aria-current','page');else $('homeNav').setAttribute('aria-current','page');$('feedbackTitle').textContent=me?'我的留言记录':'留言与反馈';renderFavorites();}
function goComments(){$('feedback').scrollIntoView({behavior:'smooth'});}
$('saveCity').onclick=()=>favoriteCity(selected);$('morePlaces').onclick=()=>loadNearby(selected);$('loginNav').onclick=goComments;$('profileLogin').onclick=goComments;
window.addEventListener('hashchange',route);window.addEventListener('citychange',e=>showPlaces(e.detail));window.addEventListener('storage',()=>{renderFavorites();renderCityButton();renderPlaces(visiblePlaces,selected);});
$('exportFavorites').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,...readShelf()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='霞光收藏.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('importFavorites').onchange=async event=>{const f=event.target.files[0];try{if(!f)return;if(f.size>500000)throw Error('文件太大');const s=JSON.parse(await f.text());if(s.version!==1||!Array.isArray(s.cities)||!Array.isArray(s.spots)||s.cities.length+s.spots.length>1000||!s.cities.every(safeCity)||!s.spots.every(x=>typeof x.id==='string'&&typeof x.name==='string'&&safeCity(x.location)))throw Error('格式不符');const current=readShelf();const merge=(a,b,key)=>Array.from(new Map([...a,...b].map(x=>[key(x),x])).values());if(writeShelf({cities:merge(current.cities,s.cities,cityKey),spots:merge(current.spots,s.spots,x=>x.id)})){renderFavorites();renderCityButton();renderPlaces(visiblePlaces,selected);tell('收藏已合并导入');}}catch{tell('无法导入，请选择本站导出的收藏 JSON 文件。');}finally{event.target.value='';}};
function syncAccount(){const logged=!!viewer;$('loginNav').textContent=logged?'@'+viewer.login:'GitHub 登录';$('accountName').textContent=logged?'@'+viewer.login:'访客收藏夹';$('accountNote').textContent=logged?'已通过 GitHub 登录。下方显示你的专属公开留言帖及站长回复。':'可先收藏城市和景点。使用下方留言区的 GitHub 登录后，可查看自己的留言。';$('feedbackNote').textContent=logged?'你在本网站的留言集中在下方，站长可在仓库中查看和回复。此留言帖公开可见；退出登录请使用留言框账号旁的退出按钮。':'使用下方“使用 GitHub 登录”后留言。登录后会打开你的专属公开留言帖。';renderFavorites();renderCityButton();renderPlaces(visiblePlaces,selected);}
function sendConfig(term){activeTerm=term;const f=document.querySelector('iframe.giscus-frame');if(f)f.contentWindow.postMessage({giscus:{setConfig:{term,strict:true,number:term==='霞光观测站留言大厅'?1:0,description:viewer?'@'+viewer.login+' 在霞光观测站的公开反馈与观霞记录':'霞光观测站留言大厅'}}},'https://giscus.app');}
window.addEventListener('message',event=>{const f=document.querySelector('iframe.giscus-frame');if(event.origin!=='https://giscus.app'||!f||event.source!==f.contentWindow||!event.data||typeof event.data.giscus!=='object')return;const m=event.data.giscus;
 if(m.signOut){viewer=null;$('myDiscussion').hidden=true;syncAccount();sendConfig('霞光观测站留言大厅');return;}
 if(m.error){$('commentStatus').textContent=/Discussion not found/i.test(m.error)?'发表第一条留言后，这里会建立你的留言记录。':'留言服务暂时未就绪，可稍后重试或打开仓库留言区。';if(/credentials|session|unauthorized/i.test(m.error)){viewer=null;syncAccount();}return;}
 if(m.discussion){$('commentStatus').textContent='留言已连接 GitHub Discussions。';const v=m.viewer;if(v&&/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(v.login)){if(viewer?.login!==v.login){viewer={login:v.login};$('myDiscussion').hidden=true;syncAccount();sendConfig('霞光观测站 · @'+viewer.login+' 的留言');return;}if(m.discussion.url!==ANCHOR_URL&&m.discussion.url?.startsWith('https://github.com/'+REPO+'/discussions/')){$('myDiscussion').href=m.discussion.url;$('myDiscussion').hidden=false;}}else if(viewer){viewer=null;$('myDiscussion').hidden=true;syncAccount();sendConfig('霞光观测站留言大厅');}}
});
const widget=document.createElement('script');widget.src='https://giscus.app/client.js';widget.async=true;widget.crossOrigin='anonymous';const options={repo:REPO,'repo-id':'R_kgDOU-TfKg',category:'Announcements','category-id':'DIC_kwDOU-TfKs4DHT2x',mapping:'number',term:'1',strict:'1','reactions-enabled':'0','emit-metadata':'1','input-position':'top',theme:'transparent_dark',lang:'zh-CN'};Object.entries(options).forEach(([k,v])=>widget.setAttribute('data-'+k,v));widget.onerror=()=>$('commentStatus').textContent='留言服务连接失败，可打开仓库留言区继续反馈。';document.querySelector('.giscus').appendChild(widget);
setTimeout(()=>{if($('commentStatus').textContent==='正在连接留言服务…') $('commentStatus').textContent='留言连接较慢，可点击下方重试，或打开仓库留言区。';},20000);
$('retryComments').onclick=()=>{const f=document.querySelector('iframe.giscus-frame');if(f){f.src=f.src;$('commentStatus').textContent='正在重新连接留言服务…';}else location.reload();};
route();load(selected);syncAccount();
