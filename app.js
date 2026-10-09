
    const presets = [
      {name:'成都',latitude:30.66,longitude:104.07},{name:'北京',latitude:39.90,longitude:116.41},
      {name:'上海',latitude:31.23,longitude:121.47},{name:'杭州',latitude:30.27,longitude:120.15},
      {name:'深圳',latitude:22.54,longitude:114.06},{name:'拉萨',latitude:29.65,longitude:91.14}
    ];
    const input = document.getElementById('cityInput');
    const suggestions = document.getElementById('suggestions');
    const status = document.getElementById('status');
    const days = document.getElementById('days');
    let selected = presets[0];
    let requestSerial = 0;
    let searchTimer;
    let searchSerial = 0;
    let lastRefreshAt = 0;

    function cnTime(value) { return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)); }
    function cnDate(value) { return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'long',day:'numeric',weekday:'short'}).format(new Date(value+'T12:00:00+08:00')); }
    function line(parent, tag, className, value) { const el=document.createElement(tag); if(className) el.className=className; el.textContent=value; parent.appendChild(el); return el; }
    function eventNode(label, item) {
      const outer=document.createElement('div'); outer.className='event';
      const top=line(outer,'div','event-top','');
      const left=line(top,'div','','');
      line(left,'div','event-name',label); line(left,'div','event-time',cnTime(item.time));
      if(new Date(item.time).getTime()<Date.now()) {
        const passed=line(top,'div','score low','—'); line(passed,'small','',' 已过');
        line(outer,'p','reason','这个时段已经过去；所示预报不代表实际观测。');
        return outer;
      }
      const score=line(top,'div','score'+(item.score<40?' low':item.score>=70?' good':''),String(item.score));
      line(score,'small','', ' / 100');
      const meter=line(outer,'div','meter',''); const fill=line(meter,'b','',''); fill.style.width=item.score+'%';
      line(outer,'div','grade',item.grade+' · 观赏指数'); line(outer,'p','reason',item.reason);
      return outer;
    }
    function render(data) {
      document.getElementById('locationTitle').textContent=data.location.name+' · 霞光预报';
      const updated=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(data.updated_at));
      document.getElementById('updatedAt').textContent='获取时间 '+updated+(data.cached?' · 已缓存':'');
      status.textContent=data.stale?'当前数据源暂不可用，显示上次缓存的预报。':'';
      days.replaceChildren();
      data.days.forEach((day,index)=>{
        const card=line(days,'article','day',''); const head=line(card,'h3','',index===0?'今天':index===1?'明天':'后天');
        line(head,'span','date-sub',cnDate(day.date));
        card.appendChild(eventNode('朝霞 · 日出',day.sunrise));
        card.appendChild(eventNode('晚霞 · 日落',day.sunset));
      });
    }
    async function load(city, force=false) {
      selected=city;
      if(!force) window.dispatchEvent(new CustomEvent('citychange',{detail:city}));
      if(!force) { ++searchSerial; clearTimeout(searchTimer); suggestions.replaceChildren(); input.value=city.name; }
      const serial=++requestSerial;
      status.textContent='正在获取 '+city.name+' 的预报…';
      if(!force) { days.replaceChildren(); document.getElementById('locationTitle').textContent=city.name+' · 霞光预报'; document.getElementById('updatedAt').textContent='正在获取最新预报…'; }
      try {
        const data=await forecastDirect(city, force);
        if(serial!==requestSerial) return;
        render(data); lastRefreshAt=Date.now();
      } catch(error) { if(serial===requestSerial) { status.textContent=error.message; lastRefreshAt=Date.now(); if(!days.children.length) document.getElementById('updatedAt').textContent='暂未取得有效预报'; } }
    }
    async function search() {
      clearTimeout(searchTimer);
      const serial=++searchSerial;
      const q=input.value.trim(); suggestions.replaceChildren();
      if(q.length<2) { if(q) status.textContent='请至少输入两个字搜索城市。'; return; }
      try {
        const data=await citiesDirect(q);
        if(serial!==searchSerial || q!==input.value.trim()) return;
        suggestions.replaceChildren();
        if(!data.cities.length) { status.textContent='没有找到该城市，可以试试完整地名。'; return; }
        status.textContent='';
        data.cities.forEach(city=>{
          const button=document.createElement('button'); button.type='button'; button.setAttribute('role','option');
          line(button,'span','',city.name); line(button,'small','',city.admin1 || '中国地区');
          button.addEventListener('click',()=>load(city)); suggestions.appendChild(button);
        });
      } catch(error) { if(serial===searchSerial && q===input.value.trim()) status.textContent=error.message; }
    }
    document.getElementById('searchButton').addEventListener('click',search);
    input.addEventListener('input',()=>{ clearTimeout(searchTimer); if(!input.value.trim()) { suggestions.replaceChildren(); return; } searchTimer=setTimeout(search,350); });
    input.addEventListener('keydown',event=>{ if(event.key==='Enter') { clearTimeout(searchTimer); search(); } if(event.key==='Escape') suggestions.replaceChildren(); });
    document.addEventListener('click',event=>{ if(!event.target.closest('.searchbox')) suggestions.replaceChildren(); });
    presets.forEach(city=>{ const button=document.createElement('button'); button.type='button'; button.textContent=city.name; button.addEventListener('click',()=>load(city)); document.getElementById('quick').appendChild(button); });
    setInterval(()=>{ if(!document.hidden) load(selected,true); },5*60*1000);
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden && Date.now()-lastRefreshAt>=5*60*1000) load(selected,true); });
    load(selected);
  