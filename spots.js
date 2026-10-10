// Short original summaries of publicly documented viewing places; sources checked 2026-10-09.
// Labels describe reported viewing times, not a guarantee of access or weather.
window.VIEWING_SPOTS = (() => {
 const rows=[];
 const add=(city,source,items)=>items.forEach(([name,kind,note])=>rows.push({id:city+':'+name,city,name,kind,note,source,verified:true}));
 add('北京','https://english.beijing.gov.cn/latest/news/202405/t20240520_3688899.html',[
 ['颐和园东堤','晚霞','沿昆明湖东侧寻找湖面与西山同框的视角。'],['玉渊潭公园中堤桥','晚霞','湖面倒影与城市天际线适合日落取景。'],['南海子公园鹿鸣湖南岸','晚霞','开阔湖面可作为晚霞前景，留意闭园时间。']]);
 add('成都','https://m.thepaper.cn/newsDetail_forward_33318167',[
 ['兴隆湖白泽台','晚霞','湖岸观景点，适合观察夕照与水面。']]);
 add('成都','https://sc.cri.cn/2022-01-18/d1bf46fc-3780-2275-3908-1c4b59a9771f.html',[
 ['青龙湖观景台','朝霞','观景台可远眺湖区；资料记录的是日出视野。']]);
 add('杭州','https://jrsh.hangzhou.com.cn/city/content/2023-07/18/content_8581701.htm',[
 ['西湖集贤亭','晚霞','亭子、水面和晚霞可构成剪影。'],['长桥公园','晚霞','沿西湖岸边寻找雷峰塔方向的夕照构图。']]);
 add('上海','https://www.shanghai.gov.cn/nw17239/20260924/a671329887d6475bb5478623891124ce.html',[
 ['外滩观景平台','朝霞','面向黄浦江对岸观察晨光，资料推荐的是朝霞。']]);
 add('深圳','https://www.sz.gov.cn/szzt2010/gysz/csgy/content/post_10826612.html',[
 ['深圳湾公园白鹭坡海岸','晚霞','滨海步道与海湾水面形成开阔的观景空间。']]);
 add('深圳','https://www.szns.gov.cn/mlns/stns/ts/gy/content/post_12590867.html',[
 ['小南山公园','晚霞','从开放的山上观景区域观察港湾与夕照。']]);
 add('广州','https://www.gz.gov.cn/zlgz/wlzx/tpxw/content/post_7350247.html',[
 ['海心桥西侧','晚霞','从桥西侧看珠江夕照，先确认预约与通行要求。']]);
 add('广州','https://www.yuexiu.gov.cn/zjyx/yxgk/sjyx/content/post_11024881.html',[
 ['沿江西路江岸','晚霞','以江面和沿江建筑作为夕照前景。']]);
 add('武汉','https://hbj.wuhan.gov.cn/hjsj/ztzl/mryt/2025mryt/202507/t20250730_2626651.html',[
 ['东湖凌波门栈桥','朝霞','面向湖面的日出观赏点，留意水位与栈桥通行情况。']]);
 add('武汉','https://www.wuhan.gov.cn/sy/whyw/202505/t20250516_2582345.shtml',[
 ['汉阳门码头江岸','晚霞','武昌江岸可看长江与大桥方向的晚霞。'],['青山江滩','晚霞','沿江寻找开放平台，保留天空与江面的构图。']]);
 add('三亚','https://lwj.sanya.gov.cn/wljsite/gzdt/202607/ae86a5261ba043a691b86a82bde77106.shtml',[
 ['椰梦长廊','晚霞','三亚湾海岸日落观赏点，椰林和海面适合作前景。']]);
 add('厦门','https://jtyst.fujian.gov.cn/fjysgl/hyxx/ysyw/202403/t20240318_6416229.html',[
 ['海湾公园','晚霞','面向西海域寻找海面日落与港湾剪影。'],['第一码头滨海慢行道','观景候选','滨海步道可远眺海沧；具体日落视野需现场确认。']]);
 add('厦门','https://tyj.fujian.gov.cn/ztzl/bmms/bmfc/202510/t20251009_7018966.htm',[
 ['环东浪漫线滨海步道','朝霞','沿海湾步道观察海上晨光。']]);
 add('青岛','https://www.qingdao.gov.cn/zwgk/xxgk/whly/gkml/gzxx/202605/t20260526_10609084.shtml',[
 ['金茂湾后海广场','晚霞','海湾岸线的日落观赏点。'],['小鱼山览潮阁','朝霞','登高看海岸晨光；出发前核对早间开放时间。']]);
 add('昆明','https://www.yn.gov.cn/yngk/lyyn/lydt/202004/t20200427_203126.html',[
 ['海晏村沙滩','晚霞','滇池岸边的夕照观赏点。']]);
 add('昆明','https://www.ynrd.gov.cn/html/2024/rendajujiao_1228/4031090.html',[
 ['滇池绿道东风坝七孔浮桥','晚霞','可把浮桥、滇池与西山夕照纳入画面。']]);
 add('大理','https://www.ynxc.gov.cn/html/2024/dianyoumudedi_1023/3016298.html',[
 ['龙龛码头','朝霞','洱海西岸常见的日出观赏地点。']]);
 add('长沙','https://whhlyt.hunan.gov.cn/whhlyt/news/sxxw/202609/t20260923_34070837.html',[
 ['橘子洲洲头','晚霞','湘江、洲头与落日构成开阔景观，需核对预约。']]);
 add('无锡','https://www.wuxi.gov.cn/doc/2025/01/02/4468550.shtml',[
 ['鼋头渚太湖岸线','晚霞','太湖夕照观赏区域；游船与岸线开放以景区通知为准。']]);
 add('喀什','https://www.xjks.gov.cn/kss/c109223/202405/694e7189187542ccab52792f7509119c.shtml',[
 ['喀什古城开放街区','晚霞','古城夕照获气候景观推荐，具体无遮挡机位需现场寻找。']]);
 add('拉萨','https://wlj.lasa.gov.cn/lsslyfzj/xxyw/202607/e760ac97295e496bbdb97283d59a7fe3.shtml',[
 ['南山公园开放观景区','观景候选','远眺拉萨城市景观。景区分时封闭登山道，不得超过下山时限等待日落。']]);
 add('天津','https://www.tj.gov.cn/sy/tjxw/202603/t20260315_7262018.html',[
 ['解放桥海河岸线','观景候选','滨河步道可观城市建筑，日落方位和遮挡需现场确认。']]);
 add('重庆','https://cgj.cq.gov.cn/zwxx_173/bmdt/mtkd/202205/t20220506_10684023.html',[
 ['鹅岭公园瞰胜楼','晚霞','地势较高，可俯瞰两江和城市夕照；登楼开放时间需提前确认。'],['平顶山文化公园崖顶观江平台','晚霞','半山崖线步道上的观景平台，可看嘉陵江与远山。'],['鸿恩寺森林公园月桂琴台','晚霞','资料推荐的公园日落拍摄点，可把树木和城市天际线纳入画面。']]);
 add('宁波','https://wglyj.ningbo.gov.cn/art/2024/8/10/art_1229057570_58930096.html',[
 ['东钱湖随风沙滩','观景候选','湖岸休闲地点，有滨水活动资料；日落视野、营业和预约需另行确认。']]);
 add('南京','https://shuiwu.nanjing.gov.cn/bmdt/202502/t20250208_5070615.html',[
 ['玄武湖开放湖岸','晚霞','湖面可映照晚霞，沿开放岸线寻找无遮挡的西向视角。']]);
 add('西安','https://cbip.xa.gov.cn/xwzx/zyxw/1844189097327964162.html',[
 ['世博园长安塔周边','观景候选','可看灞河与园区景观；登塔、闭园和日落视野需现场确认。'],['浐灞国家湿地公园','观景候选','沿河公园，可寻找水面与天空的构图；尚未核实日落机位。']]);
 add('香港','https://www.discoverhongkong.com/tc/place-to-go/travel.guide-tai-mo-shan.html',[
 ['大帽山观景台','朝霞','登山线路上的开阔观景台，资料记录可看日出；需留意山上强风与步行条件。']]);
 add('台中','https://www.taiwan.net.tw/m1.aspx?id=r117&sNo=0001016',[
 ['高美湿地海堤','晚霞','湿地、海面与夕阳构成开阔景观，请遵守潮汐、步道和生态保护规定。']]);
 return rows.map(spot=>({...spot,...(window.SPOT_COORDINATES||{})[spot.id]}));
})();
