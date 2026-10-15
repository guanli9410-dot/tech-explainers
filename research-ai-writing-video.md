# 调研：AI 写作与视频生成的选型（千问/豆包/元宝/DeepSeek + 平台 agent）

> 定位：调研笔记（非架构分析文档）。**二轮定稿 2026-10-14**（一轮 10-12，同日修正版本错位）；来源为搜索摘要（横评/研报/社区实测），未逐条打开一手原文——**全部 ⚠️ 级**，自媒体横评有软文风险，多篇独立口径一致才采信、单源标注。
> **比较口径**：消费端服务（App/网页），非本地部署；AI 味在可接受范围内 + 质量/效率/成本；三场景=文案（解说稿）、视频（素材级）、小说（长文）。
> **版本基线（2026-10-14 在役）**：DeepSeek V4 系（V4.1-Flash 最新，旧模型名 07-24 停用、V3.2 七月下线）；豆包 Seed 2.0（2026-02-14 发布，驱动豆包 App）；元宝=混元 Hy3/Hy4 preview 底座 + 可选 DeepSeek（新版已接入 ⚠️）；千问 App=Qwen3.7（Pro 会员）/Qwen3.8-Max（2026-08）；视频=Seedance 2.5、可灵 4.0（2026-10）、Vidu Q4。
> 时效声明：本领域版本半年一换代，本文件结论**只对 2026-10 负责**；价格以官方页为准。

## 总结论（二轮修订）

文字侧"DeepSeek 文笔最好"的一轮结论**降级**：V4 口碑两极分化。当期格局是四家各占一角，没有统治者：

| 场景 | 当期推荐 | 依据（均 ⚠️） |
|---|---|---|
| 小说/长文 | **同题实测四家再选**：豆包 Seed 2.0（综合位次第一）、千问 3.7 Plus（写作性价比口碑黑马）、DeepSeek V4（同人/单篇强，网文连载圈说退化）、元宝 Hy3/Hy4（文笔是官方主打方向，用户数据最少） | 见下表 |
| 文案/解说稿 | 豆包 Seed 2.0 默认；千问 3.7 Plus 上位为平替 | SuperCLUE 中文第一 + 36氪体验口碑；千问旧"App 体验差"扣分项仍需自查 |
| 视频素材 | **即梦 Seedance 2.5**（快+中文+4K 直出+多素材投喂）与 **可灵 4.0**（10 月新上：30s/4K/HDR/10 关键帧叙事控制）双持；Sora 已停运 | 价格已打到 0.05–0.09 元/秒，素材级成本不再敏感 |

消费端 App 免费为主，**成本差基本不构成选型因素**；选型动作=拿当期版本各试三段同题文本（横评口径普遍滞后一两个版本，本文件两轮调研即为实例）。

## 一、小说 / 长文（当期版本口碑）

| 选项（当期版本） | 用户说法（时间/来源，均 ⚠️） | 定位 |
|---|---|---|
| 豆包（Seed 2.0，2026-02） | SuperCLUE 中文通用测评**国内第一、全球第二**（代码与指令遵循仍是弱项）；写作专项用户口碑少，综合位次最高 | 稳态默认选 |
| 千问 App（Qwen3.7 Plus / 3.8-Max） | **口碑翻转**：AtlasCloud 实测（2026-08-31）称 Qwen3.7 Plus 是"中文创意写作性价比首选"（小说草稿/对白/大纲均衡最强），3.8-Max 适合终稿润色——一轮里"文笔顽疾"是 Qwen3-235B 时代旧口径 | 写作黑马；旧偏见作废 |
| DeepSeek 官方 App（V4 系） | **两极分化**：负面=GitHub DeepSpec Issue #61（2026-07-08）"文案写作严重退化，身边多名网文创作者无一例外说文笔不如从前"；正面=端传媒（2026-04-29）称"最强中文同人文模型"（对 Gemini-3.1-Pro 胜率 83.25%）、B 站 V4 Pro 写小说实测好评、Reddit 称 V4 Pro 写作≈Claude Opus 但便宜得多 | 同人/单篇华丽向可用；网文连载向慎选 |
| 元宝（混元 Hy3/Hy4 + 可选 DeepSeek） | Hy3 preview（2026-04-30，姚顺雨加盟首秀）明确把**文风、文笔、情商**列为与元宝 Co-Design 的优化方向；官网现已上 Hy4 preview；2026-06 起元宝/腾讯文档全线接入 DeepSeek V4（腾讯云口径 ⚠️）；混元 2.0 时代（2025-12）文学创作已显著提升；微信生态检索独家 | 官方主打文笔但用户实测数据最少；双引擎都有新版，值得纳入实测 |
| （参照系）Claude | 同人圈对照基准；DeepSeek 正面口碑的参照物即它 | 天花板标杆，不在候选内 |

**DeepSeek 分化的机制注**：V4.1-Flash 是"新系列中最小的模型"，且 V4-Pro 下线路由到 Flash 的公告反复——**App 端默认拿到的档位可能是 Flash 而非 Pro**，网文圈的"退化感"可能部分来自档位而非代际（⚠️ 推断，未证实；实测时注意区分 App 内可选的 Pro/Flash 档）。另一可能是真实分化：对决式华丽（同人文）与长篇人味（连载网文）本就是两种能力。

**平台自建 agent**（一轮结论仍有效）：起点作家助手（妙笔+DeepSeek）、番茄"茄子小说 AI"、笔灵/蛙趣拼文/星月写作等垂类（爆款模板+素材库）。主流打法=**组合流**：底稿模型 + 垂类工作流管长篇连贯性。风险：平台 AI 审核趋严，纯 AI 全文收益被压缩（36氪）。

## 二、文案（短视频/解说稿）

- 豆包 Seed 2.0 综合位次第一，维持默认推荐；千问 3.7 Plus 作为写作口碑黑马上位为平替（旧"App 体验差"是 2025 横评口径，需自查新版）。
- **AI 味**：结论不变——没有免调教的，靠规则压制："禁止层/语气层/审核层"三层 skill（rar.design 2026-07）、qu-ai-wei 项目；本管线"原文即脚本、禁 AI 句式"纪律同构。
- 成本（消费端）：三 App 免费为主（千问 Pro 会员、豆包会员增值），选型可忽略。API 计价仅 video-kit 批量流水线相关，脚注：千问最便宜（Qwen-Long 输入 0.5 元/M、Batch 五折）、豆包 pro 档约 0.8/2 元/M（⚠️ 随时变）。

## 三、视频生成（2026-10 当期：一个月内刚换代）

**Seedance 2.5（字节/即梦）**：30 秒原生 4K 直出、50 个素材一次投喂、3D 白模预可视化、局部编辑、时间戳分镜；计费按是否含视频输入分档 42/70 元/百万 tokens；被称"全球 SOTA 领先身位"；2026-07 上线后因 AI 短剧市场见顶已开始降价（知乎 2026-10-01）。

**可灵 4.0（快手，2026-09-28 Flash 先行、10 月完整版）**：单次最长 30 秒、4K/1080p、10-bit HDR（即将）、21:9 超宽、**15 项多模态参考输入 + 10 张关键帧叙事控制**、高速运动/连续动作/复杂运镜稳定性、高保真音频；配套 Agent 创作工具 likli 内测；机构关注点=能否追上 Seedance。

**其他**：Vidu Q4 Preview（2026-10-08）主打人物演绎/镜头语言，优惠低至 0.09 元/秒；**Sora 已离场**（网页/App 2026-04-26 停服、Videos API 09-24 关闭；10-12 消息 OpenAI 拟重启并转向 AI 影视工具方向 ⚠️）。

**行业面**：价格快速下探至约 **0.05 元/秒**（知乎 2026-10-01："从 Sora 神话沦为大宗商品"）；竞争重心从生成质量转向**长叙事、编辑控制、工作流整合**。

**对 video-kit 的落点（更新）**：broll 补库成本已不敏感（0.05–0.09 元/秒），即梦为主（快+中文语义准+多素材投喂适合按"画面说明"批量喂）；可灵 4.0 的**10 关键帧叙事控制**对本管线"机制动画之外的叙事镜头"有直接用处；与 Remotion/manim 主线仍不冲突（素材级能力带）。

## 来源清单（均 ⚠️ 搜索摘要级）

**二轮（2026-10-14）**：[GitHub DeepSpec #61：V4 写作退化反馈](https://github.com/deepseek-ai/DeepSpec/issues/61)；[端传媒：V4 同人文胜率](https://theinitium.com/20260429-tech-in-numbers-deepseek-v4-writing-fan-fiction-zh-hans)；[B站 V4 Pro 写小说实测](https://www.bilibili.com/video/BV1UAokB6EiP)；[Reddit r/SillyTavernAI](https://www.reddit.com/r/SillyTavernAI/comments/1u25cbz/)；[雷锋网 V4 中文语境](https://www.leiphone.com/category/industrynews/YpMEgldEnok4fRSn.html)；[华尔街见闻 V4 Pro 体验](https://wallstreetcn.com/articles/3770793)；[解放日报：豆包 1.8 发布](https://www.jfdaily.com/news/detail?id=1037556)；[evolink：Seed 2.0 评测](https://evolink.ai/zh/blog/doubao-seed-2-0-review-benchmarks-pricing)；SuperCLUE Seed 2.0 测评（B站）；[腾讯混元 Hy3 preview](https://hy.tencent.com/research/hy3-preview?langVersion=en)；[Qwen3.8-Max 博客](https://qwen.ai/blog?id=qwen3.8)；AtlasCloud Qwen3.7/3.8 写作实测（2026-08-31）；[腾讯云：V4 全线接入](https://cloud.tencent.com/developer/article/2680827)；[元宝官网](https://yuanbao.tencent.com)；[知乎：AI视频 0.05元/秒](https://zhuanlan.zhihu.com/p/2089334545850151583)；[什么值得买：Seedance 2.5](https://post.smzdm.com/p/a70rw5rg)；Kling 4.0 Flash（百度百科/极客网 2026-09-29）；The Information via PANews（2026-10-12）Sora 重启洽谈。

**一轮（2026-10-12）**：[阿里云定价](https://help.aliyun.com/model-studio/model-pricing)、[火山方舟](https://ai.volcengine.com)、[AI 新榜视频成本实测](https://www.newrank.cn)、[36氪五款 App 实测](https://www.36kr.com)、[DeepSeek 官方更新日志](https://api-docs.deepseek.com/zh-cn/updates)、[V4 预览公告](https://www.deepseek.com/zh/news/v4-preview)、[腾讯元器模型介绍](https://yuanqi.tencent.com/guide/model-introduction)、[千问官网](https://www.qianwen.com)、CSDN 网文工具实测（2026-07/08）、极点商业"大文娱 AI"（2025-03）、知乎 Qwen3-235B 讨论（2025-07）、rar.design 去 AI 味（2026-07）。
