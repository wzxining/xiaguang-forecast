const presets = [
 {name:'成都',latitude:30.66,longitude:104.07},{name:'北京',latitude:39.90,longitude:116.41},
 {name:'上海',latitude:31.23,longitude:121.47},{name:'杭州',latitude:30.27,longitude:120.15},
 {name:'深圳',latitude:22.54,longitude:114.06},{name:'重庆',latitude:29.56,longitude:106.55},
 {name:'厦门',latitude:24.48,longitude:118.09},{name:'武汉',latitude:30.59,longitude:114.31}
];
const input=document.getElementById('cityInput'), suggestions=document.getElementById('suggestions');
const status=document.getElementById('status'), days=document.getElementById('days');
let selected=presets[0], selectedSpot=null, requestSerial=0, searchTimer, searchSerial=0, lastRefreshAt=0, activeOption=-1;
const cityName=name=>name.replace(/市$/,'').replace('大理白族自治州','大理').replace('喀什地区','喀什');
const spotsForCity=city=>window.VIEWING_SPOTS.filter(s=>s.city===cityName(city.name));
const resolveSpot=spot=>window.VIEWING_SPOTS.find(s=>s.id===spot.id)||spot;
const hasCoordinates=spot=>spot && Number.isFinite(spot.latitude)&&Number.isFinite(spot.longitude)&&spot.latitude>=3&&spot.latitude<=54&&spot.longitude>=73&&spot.longitude<=135;
function coordinatesText(spot){return hasCoordinates(spot)?spot.latitude.toFixed(5)+'°N, '+spot.longitude.toFixed(5)+'°E · '+(spot.coordinateLabel||'地图参考点'): '坐标待核实';}
    function cnTime(value) { return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)); }
    function cnDate(value) { return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'short'}).format(new Date(value+'T12:00:00+08:00')); }
    function line(parent, tag, className, value) { const el=document.createElement(tag); if(className) el.className=className; el.textContent=value; parent.appendChild(el); return el; }
function eventNode(label, item, key) {
  const outer=document.createElement('div');outer.className='event '+(key==='sunrise'?'dawn':'dusk');
  const passed=new Date(item.time).getTime()<Date.now();outer.classList.toggle('past-event',passed);
  const top=line(outer,'div','event-top',''), left=line(top,'div','','');
  line(left,'div','event-name',label);line(left,'div','event-time',cnTime(item.time));
  const score=line(top,'div','score',String(item.score));line(score,'small','',' / 100');
  const meter=line(outer,'div','meter','');meter.setAttribute('role','meter');meter.setAttribute('aria-label',label+'观赏指数');
  meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');meter.setAttribute('aria-valuenow',String(item.score));
  line(meter,'b','','').style.width=item.score+'%';
  line(outer,'div','grade',item.grade+(passed?' · 已过时段的预报值':' · 观赏指数'));
  line(outer,'p','reason',item.reason);
  return outer;
}
function renderForecastDays(parent,data,compact=false){
  parent.replaceChildren();
  data.days.forEach((day,index)=>{
    const card=line(parent,'article','day'+(compact?' compact-day':''),''),head=line(card,compact?'h4':'h3','',index===0?'今天':index===1?'明天':'后天');
    line(head,'span','date-sub',cnDate(day.date));
    const events=line(card,'div','day-events','');
    events.appendChild(eventNode('朝霞 · 日出',day.sunrise,'sunrise'));events.appendChild(eventNode('晚霞 · 日落',day.sunset,'sunset'));
    const details=line(card,'details','weather-details','');line(details,'summary','','查看云量与能见度');
    for(const [key,label] of [['sunrise','朝霞'],['sunset','晚霞']]){const e=day[key];line(details,'p','',label+'：低云 '+e.cloud_low+'% · 中云 '+e.cloud_mid+'% · 高云 '+e.cloud_high+'% · 降水可能 '+e.rain_probability+'% · 能见度 '+(e.visibility_m===null?'暂无':(e.visibility_m/1000).toFixed(1)+' km'));}
  });
}
function render(data) {
  document.getElementById('locationTitle').textContent=selected.name+' · 城市整体参考';
  const updated=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(data.updated_at));
  document.getElementById('updatedAt').textContent='获取时间 '+updated+(data.cached?' · 已缓存':'')+' · 每 5 分钟更新';
  document.getElementById('pointMeta').textContent='按市区参考坐标查询（'+selected.latitude.toFixed(3)+'°N, '+selected.longitude.toFixed(3)+'°E），作为城市概况；各景点以上方独立预报为准。';
  document.getElementById('gridMeta').textContent='已过时段保留的是预报值，不代表实际观测结果。';
  status.textContent=data.stale?'最新查询未成功，暂用该城市上次保存的预报。'+(data.warning||''):'';
  renderForecastDays(days,data);
}
async function fetchSelected(force=false) {
  const city=selected,serial=++requestSerial;
  status.textContent='正在获取 '+city.name+' 的市区参考预报…';
  if(force)document.getElementById('updatedAt').textContent=days.children.length?'正在更新，暂保留上次预报…':'正在重试气象查询…';
  if(!force){days.replaceChildren();document.getElementById('locationTitle').textContent=city.name+' · 城市整体参考';document.getElementById('updatedAt').textContent='正在获取城市预报…';document.getElementById('pointMeta').textContent='';document.getElementById('gridMeta').textContent='';}
  try{const data=await forecastDirect(city,force);if(serial!==requestSerial)return;render(data);}
  catch(error){if(serial===requestSerial){status.textContent=error.message;if(!days.children.length)document.getElementById('updatedAt').textContent='暂未取得有效预报';}}
  finally{if(serial===requestSerial)lastRefreshAt=Date.now();}
}
function closeSuggestions(){++searchSerial;clearTimeout(searchTimer);suggestions.replaceChildren();activeOption=-1;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}
function load(city, force=false, preferredSpot=null) {
  if(force){refreshForecasts();return;}
  selected=city; selectedSpot=preferredSpot?resolveSpot(preferredSpot):spotsForCity(city).find(hasCoordinates)||null;
  closeSuggestions();input.value='';input.placeholder='搜索城市或景点 · 当前'+city.name;
  setForecastScope([city,...spotsForCity(city),selectedSpot].filter(hasCoordinates));
  window.dispatchEvent(new CustomEvent('citychange',{detail:city}));
  fetchSelected();
}
function selectSpot(spot,city=selected,scroll=true){
  spot=resolveSpot(spot);load(city,false,spot);location.hash='home';
  if(scroll){const card=[...document.querySelectorAll('#places .place')].find(c=>c.dataset.spotId===spot.id);(card||document.getElementById('placesSection')).scrollIntoView({behavior:'smooth',block:'start'});}
}
function refreshForecasts(){fetchSelected(true);window.dispatchEvent(new CustomEvent('forecastrefresh'));}
function searchHeading(text){line(suggestions,'div','search-heading',text).setAttribute('role','presentation');}
function searchOption(title,note,action,kind=''){
  const b=document.createElement('button');b.type='button';b.id='search-option-'+suggestions.querySelectorAll('[role=option]').length;b.setAttribute('role','option');b.setAttribute('aria-selected','false');b.className=kind;
  const label=line(b,'span','','');line(label,'strong','',title);line(label,'small','',note);line(b,'span','option-arrow','↗');
  b.addEventListener('click',action);suggestions.appendChild(b);input.setAttribute('aria-expanded','true');
}
function recommended(){closeSuggestions();searchHeading('推荐城市 · 选择后查看全部已收录景点');presets.forEach(city=>searchOption(city.name,spotsForCity(city).length+' 处已收录景点',()=>load(city)));}
function showSearchResults(cities,query){
  suggestions.replaceChildren();activeOption=-1;input.removeAttribute('aria-activedescendant');
  const named=cityName(query), exact=cities.find(c=>cityName(c.name)===named);
  const matches=exact?[exact]:cities;
  let count=0;
  matches.forEach(city=>{
    const spots=spotsForCity(city);
    searchOption(city.name,spots.length?'查看本站已收录的全部 '+spots.length+' 处景点':'景点资料待补充 · 可查找附近候选点',()=>load(city),'city-option');
    spots.forEach(spot=>{count++;searchOption(spot.name,city.name+' · '+spot.kind+' · '+(hasCoordinates(spot)?'景点独立预报':'坐标待核实'),()=>selectSpot(spot,city),'spot-option');});
  });
  if(!cities.length){
    const spots=window.VIEWING_SPOTS.filter(s=>s.name.includes(query));
    spots.forEach(spot=>{const city=[...presets,...window.CITY_INDEX].find(c=>cityName(c.name)===spot.city);if(city){count++;searchOption(spot.name,spot.city+' · '+spot.kind,()=>selectSpot(spot,city),'spot-option');}});
  }
  if(!suggestions.querySelector('[role=option]'))searchHeading('尚未找到已收录城市或景点，试试完整城市名。');
  else searchHeading(count?'已列出匹配城市的全部已收录景点；名录仍在补充。':'选择城市后可继续查找附近地点。');
  input.setAttribute('aria-expanded','true');
}
async function search(){
  clearTimeout(searchTimer);const q=input.value.trim();if(!q){recommended();return;}
  const serial=++searchSerial;
  if(q.length>60){suggestions.replaceChildren();searchHeading('请输入 60 个字以内的城市或景点名称。');return;}
  const term=cityName(q),seen=new Set();
  const local=[...presets,...window.CITY_INDEX].filter(c=>{const name=cityName(c.name);if(seen.has(name))return false;seen.add(name);return name.includes(term);});
  if(local.length||window.VIEWING_SPOTS.some(s=>s.name.includes(q))||q.length<2){showSearchResults(local,q);return;}
  suggestions.replaceChildren();searchHeading('正在搜索城市…');input.setAttribute('aria-expanded','true');
  try{const data=await citiesDirect(q);if(serial===searchSerial&&input.value.trim()===q)showSearchResults(data.cities,q);}
  catch(error){if(serial===searchSerial){suggestions.replaceChildren();searchHeading(error.message);}}
}
input.addEventListener('focus',()=>{if(input.value.trim())search();else recommended();});
input.addEventListener('click',()=>{if(!suggestions.children.length){if(input.value.trim())search();else recommended();}});
input.addEventListener('input',()=>{++searchSerial;clearTimeout(searchTimer);suggestions.replaceChildren();activeOption=-1;input.removeAttribute('aria-activedescendant');if(!input.value.trim())recommended();else searchTimer=setTimeout(search,180);});
input.addEventListener('keydown',event=>{
  const options=[...suggestions.querySelectorAll('[role=option]')];
  if(event.key==='Escape'){closeSuggestions();return;}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    event.preventDefault();if(!options.length){search();return;}
    activeOption=(activeOption+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
    options.forEach((b,i)=>b.setAttribute('aria-selected',String(i===activeOption)));
    input.setAttribute('aria-activedescendant',options[activeOption].id);options[activeOption].scrollIntoView({block:'nearest'});
  }else if(event.key==='Enter'){event.preventDefault();if(activeOption>=0&&options[activeOption])options[activeOption].click();else search();}
});
document.getElementById('searchButton').addEventListener('click',search);
document.addEventListener('click',event=>{if(!event.target.closest('.searchbox'))closeSuggestions();});
suggestions.addEventListener('focusout',event=>{if(event.relatedTarget&&!event.relatedTarget.closest('.searchbox'))closeSuggestions();});
presets.slice(0,6).forEach(city=>{const b=line(document.getElementById('quick'),'button','',city.name);b.type='button';b.onclick=()=>load(city);});
setInterval(()=>{if(!document.hidden)refreshForecasts();},5*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefreshAt>=5*60*1000)refreshForecasts();});
document.getElementById('refreshForecasts').onclick=refreshForecasts;
