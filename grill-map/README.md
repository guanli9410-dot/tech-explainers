# 拷问导图 GrillMap

输入一个主题，AI 按**「构建—运行双视角」骨架**把它拷问成一棵思维导图；点击任意概念可继续追问（生成子树）、编辑、手动增删。纯静态、零依赖、零构建，Key 只存在浏览器本地。

- 线上地址（GitHub Pages）：`https://guanli9410-dot.github.io/tech-explainers/grill-map/`
- 方法论来源：本仓库《概念拆解通用SOP.md》

## 骨架（AI 生成的主干结构）

| 类型 | 判定 | 主干 |
|---|---|---|
| 系统类 · 搭建序列 | 可设计搭建的东西（软件栈、模型、管线） | 骨架（最小可动物）→ 每步加一块功能（每步一句 ≤50 字需求句）→ 一次实际运行 |
| 路线类 · 发展图解 | 有代际演进的领域（电池、电机、路线之争） | 起点（含参照系）→ 各代演进 → 前沿站（并列各牌）→ 一次穿线 |
| 通用类 · 双视角 | 其它概念/学科/技能 | 解决什么问题 → 静态（怎么构建/由什么组成）→ 动态（跑起来什么样）→ 边界与失效 |

语言硬规则（生成与追问同样生效）：只用领域公认标准术语、严禁自造词；首现术语必须配一句大白话解释；说人话；「X 是瓶颈」必须配定量量级例子；概念先立后用。

## 使用

1. 右上角 ⚙ 配置 API（OpenAI 兼容）。预设：智谱 GLM（默认，`glm-4.7`）、DeepSeek、OpenAI、本地 Ollama。Key 存在 localStorage，不上传。
2. 首页输入主题 + 选择读者水平（默认纯初学者）→ 开始拷问。
3. 编辑器里点任意节点：**追问**（自定义问题或快捷问题，追加/替换子节点）、**编辑**、**手动加**、**删除**。滚轮缩放、拖动平移、双击空白适应画布。
4. 导图自动保存；可导出 Markdown / JSON / PNG。没配 Key 可先打开内置示例导图。

## 跨域（CORS）说明（实测 2026-10）

| 服务商 | 浏览器直连 | 说明 |
|---|---|---|
| DeepSeek `api.deepseek.com` | ✅ | 预检与实际请求均正确回显 CORS 头 |
| 智谱 `open.bigmodel.cn` | ❌ | POST 响应带 ACAO 但**预检 OPTIONS 不带**，带 Authorization 的直连必被浏览器拦 |
| 智谱国际 `api.z.ai` | ❌ | 同上 |
| 本地 Ollama | ✅ | 启动前设 `OLLAMA_ORIGINS=*` |

想用智谱 Key 的话，花 3 分钟部署一个 Cloudflare Worker 反代（免费额度绰绰有余），部署后把应用设置里的「API 地址」换成你的 `https://xxx.workers.dev`（模型名不变）：

```js
// Cloudflare Worker：新建 → 粘贴 → 部署
const UPSTREAM = 'https://open.bigmodel.cn/api/paas/v4'; // z.ai 则换 https://api.z.ai/api/paas/v4
export default {
  async fetch(req) {
    const url = new URL(req.url);
    const upstream = await fetch(UPSTREAM + url.pathname.replace(/^\/v4?/, '') + url.search, {
      method: req.method,
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') || '' },
      body: req.method === 'GET' ? undefined : req.body,
    });
    const cors = new Headers(upstream.headers);
    cors.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return new Response(null, { headers: { ...Object.fromEntries(cors), 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' } });
    return new Response(upstream.body, { status: upstream.status, headers: cors });
  },
};
```

API Key 只存在你本浏览器（localStorage），走反代也只是转发请求头，Worker 不落盘。

## 本地开发

```bash
cd grill-map
python -m http.server 8765
# 打开 http://localhost:8765
```

## 文件

- `index.html` — 页面骨架（首页 / 编辑器 / 设置 / 帮助）
- `prompts.js` — 方法论提示词（三型骨架 + 硬规则）与内置示例导图
- `mapview.js` — SVG 思维导图渲染器（CJK 换行、tidy 布局、缩放平移、折叠、PNG 导出）
- `app.js` — 应用逻辑（状态、存储、API 客户端、弹层与导出）
- `style.css` — 样式
