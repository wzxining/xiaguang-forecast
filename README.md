# 霞光观测站

展示网址：https://wzxining.github.io/xiaguang-forecast/

面向个人非商业课堂展示的朝霞、晚霞观赏参考网站。无需购买域名或运行服务器。

## 功能

- 搜索中国城市，查看未来三天日出、日落时间和实验性观赏指数。网页打开时每五分钟重新请求预报；从后台返回且超过五分钟时也会更新。天气提供方不一定每五分钟发布新数据，因此结果可能相同。
- 城市下方显示附有来源的观景点，区分朝霞、晚霞及尚未核实视野的候选地点。未收录的城市会尝试查询 OpenStreetMap 中附近有名称的观景台和公园，地图服务失败时给出明确提示和地图入口。
- 顶部“我的观霞”保存城市和景点收藏，可导入、导出 JSON。收藏保存在当前浏览器，按已验证的 GitHub 账号区分；访客收藏单独保存，不会自动跨设备同步。
- 使用 Giscus 的 GitHub 登录发表评论。留言写入本仓库的 Discussions，仓库所有者可直接查看和回复。每个账号使用一个公开留言帖，在个人页面查看本网站留言记录及站长回复。没有 GitHub 账号的访客可通过页面链接注册。

## 留言配置

本仓库已启用 Discussions 并安装 Giscus。`community.js` 中的仓库 ID、分类 ID 都是公开配置，不是密钥。初始留言大厅为 Discussion #1；成功登录后按已验证的 GitHub 用户名切换到个人留言帖。个人帖在首次留言时自动建立。

本站不读取 GitHub 密码，不要求访客输入访问令牌。认证由 GitHub/Giscus 完成。留言公开可见，请勿填写私人信息。网络无法访问 Giscus 时，可直接打开仓库 Discussions。

## 文件及部署

根目录部署文件：`index.html`、`style.css`、`app.js`、`weather.js`、`community.js`、`spots.js`、`cities.js`、`CITY-DATA-LICENSE.txt`。

GitHub Settings → Pages：Deploy from a branch，`main`，`/(root)`。更新根目录文件即可发布。请在课堂使用的学校网络上提前打开网址检查；GitHub、Giscus、气象和地图接口的可达性取决于访问者网络。

## 数据与边界

- 气象：[Open-Meteo](https://open-meteo.com/)，适用其[非商业使用条款](https://open-meteo.com/en/terms)。指数综合日出、日落前后约 90 分钟的分层云量、降水概率和能见度，**未经过实测校准，不是霞光出现概率**。城市天气不等于景点现场天气。
- 城市：[City Geo](https://github.com/88250/city-geo)，木兰宽松许可证第 2 版，完整许可证见 `CITY-DATA-LICENSE.txt`。城市中心坐标经过近似转换及部分修正，只用于粗略天气网格定位；在线补充搜索使用 Open-Meteo / GeoNames。城市索引不等于全部行政区划或县级市名录。
- 景点：`spots.js` 包含逐条资料来源和自行撰写的短摘要。它不代表全国每座城市的完整景点名录；开放、预约、潮汐及交通信息须以景区当日公告为准。
- 地图候选：[OpenStreetMap contributors](https://www.openstreetmap.org/copyright)，ODbL。按城市中心附近范围查询，可能跨行政边界；不保证日落视野。地图候选查询结果在当前浏览器缓存 24 小时。
- API 失败不会生成虚构预报或景点；已获取的天气缓存会明确标示。

## 本地预览

在此目录运行 `python3 -m http.server 8876 --bind 127.0.0.1`，打开 http://127.0.0.1:8876/ 。GitHub 登录需要网页地址，请勿直接双击 HTML 文件使用 `file://` 进行登录测试。需要联网才能加载气象预报与留言。
