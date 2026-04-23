<div align="center">

# 💘 下一任

**AI 驱动的情感量化分析工具 — 用数据告诉你 ta 到底喜不喜欢你**

[![License: MIT](https://img.shields.io/badge/License-MIT-pink.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek-purple)](https://platform.deepseek.com)
[![Claude Skill](https://img.shields.io/badge/Claude-Skill-orange)](skill/SKILL.md)

> 本项目基于 [`ta-likes-me`](skill/SKILL.md) Claude Code Skill 扩展开发，新增 Web 可视化界面、微信聊天记录导入、多维图表和关系走势分析。

</div>

---

## ✨ 核心功能

| 功能 | 描述 |
|------|------|
| 📊 **六维度量化评分** | 主动性、回应质量、独特性、情感暴露、行为信号、未来导向，权重科学分配 |
| 📈 **关系走势时间线** | 早期→中期→近期三段折线图，直观看出关系是升温还是降温 |
| 💬 **情感高光原句** | AI 从聊天记录中提取最有信号价值的原句，标注正向/负向 |
| 🧠 **认知偏差检测** | 识别"单方热恋"、"过度解读"、"把礼貌当特殊对待"等常见偏差 |
| 🏢 **工作场景过滤** | 即使主要聊工作，也能从工作对话中独立识别情感信号，不互相稀释 |
| 📱 **微信记录导入** | 支持 WeFlow / WeChatMsg 导出的数据库文件直接接入分析 |
| 🌙 **深夜联系 & 主动性量化** | 深夜消息、对方主动比例、回复速度、消息长度比等关键指标可视化 |
| 🔒 **完全本地运行** | 聊天记录不上传任何服务器，仅调用 DeepSeek API 进行分析 |

---

## 🖥️ 界面预览

```
综合好感度：8.2 / 10         关系状态：暧昧升温
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【关系走势】  早期 6.5 → 中期 7.3 → 近期 8.2  ↑ 持续升温

【互动量化】
  对方主动发起  约55%    回复速度  快
  深夜联系      有       消息长度比  对方更长

【情感高光原句】
  "你最近睡得好吗" — 工作话题中突然关心，超出工作范畴  [近期 · 正向]
  "下次你来，我带你去那家店" — 主动纳入未来计划       [中期 · 正向]

【认知偏差检测】
  未发现明显单方热恋或过度解读
```

---

## 🚀 快速开始

### 方式一：Web 可视化界面（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/zhangtianruiwork-droid/xia-yi-ren.git
cd xia-yi-ren/app

# 2. 安装依赖
npm install

# 3. 配置 API Key
cp .env.example .env
# 编辑 .env，填入你的 DeepSeek API Key（https://platform.deepseek.com/）

# 4. 启动
npm run dev
# 打开 http://localhost:5173
```

### 方式二：Claude Code Skill（命令行）

将 `skill/` 目录复制到你的 Claude Code skill 目录：

```bash
# macOS / Linux
cp -r skill/ ~/.claude/skills/ta-likes-me/

# Windows
xcopy /E /I skill\ %USERPROFILE%\.claude\skills\ta-likes-me\
```

然后在 Claude Code 中输入 `/ta-likes-me` 启动。

---

## 📱 如何获取微信聊天记录

### 推荐方案：WeFlow（最简单）

[**WeFlow**](https://github.com/hicccc77/WeFlow) 是一个完全本地的微信聊天记录实时查看与导出工具，无需越狱或 root。

1. 前往 [WeFlow Releases](https://github.com/hicccc77/WeFlow/releases) 下载并安装
2. 打开 WeFlow，选择目标联系人
3. 导出为 **CSV** 格式
4. 在"下一任"Web 界面上传该文件，或粘贴聊天内容

> WeFlow 仅在本地运行，聊天记录不会上传到任何服务器。

### 备选方案：WeChatMsg

[**WeChatMsg**](https://github.com/LC044/WeChatMsg) 支持将微信聊天记录导出为 HTML / CSV / TXT 格式。

```bash
pip install pywxdump
# 或直接使用 WeChatMsg 的 GUI 界面
```

### 工具脚本（高级用户）

本项目 `tools/` 目录提供了 Python 脚本：

```bash
# 安装依赖
pip install psutil pywxdump

# 导出微信聊天记录（需要微信正在运行）
python tools/wechat_export.py

# 解析已导出的聊天文件
python tools/wechat_parser.py --file chat.txt --output signals.txt

# QQ 聊天记录解析
python tools/qq_parser.py --file qq_chat.txt --output signals.txt

# 独立运行 DeepSeek 分析
export DEEPSEEK_API_KEY=sk-your_key_here
python tools/analyze.py --input signals_input.json --output result.json
```

> **注意**：微信 4.x（Weixin.exe）的数据库密钥提取目前尚在完善中，建议优先使用 WeFlow 可视化导出。

---

## 📐 评分体系

评分基于 6 个维度，参考心理学研究中的**语言风格匹配（LSM）**理论：

| 维度 | 权重 | 关键信号 |
|------|------|---------|
| 主动性 | 25% | 谁先发消息、发起话题、约见面的频率 |
| 回应质量 | 20% | 回复速度、消息长度、深夜回复、追问频率 |
| 独特性 | 20% | 专属称呼、与其他人的差异对待、私密分享 |
| 情感暴露 | 15% | 分享弱点/家庭/第一时间联系的对象 |
| 行为信号 | 10% | 记住细节、主动创造独处机会、实物关心 |
| 未来导向 + LSM | 10% | "我们"/"下次"语言、语言风格模仿 |

> 评分参考：**7+ 明显有意思，4- 建议冷静，5~6 才是真正需要继续观察的区间**

---

## 🏗️ 项目结构

```
xia-yi-ren/
├── app/                    # React + Vite Web 界面
│   ├── src/
│   │   ├── App.tsx         # 主应用（分析逻辑 + UI）
│   │   ├── config.ts       # 配置
│   │   └── components/     # shadcn/ui 组件库
│   ├── .env.example        # API Key 配置模板
│   └── package.json
│
├── skill/                  # Claude Code Skill（命令行版本）
│   ├── SKILL.md            # Skill 定义
│   └── prompts/
│       └── scoring_system.md   # 评分体系详细说明
│
├── tools/                  # Python 工具脚本
│   ├── wechat_export.py    # 微信聊天记录导出（支持 3.x / 4.x）
│   ├── wechat_parser.py    # 微信记录解析
│   ├── qq_parser.py        # QQ 记录解析
│   └── analyze.py          # DeepSeek API 分析
│
├── LICENSE                 # MIT
└── README.md
```

---

## 🛠️ 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS
- **组件库**：shadcn/ui + Recharts（雷达图、折线图）
- **AI**：DeepSeek API（`deepseek-chat`，支持长上下文）
- **聊天记录解析**：自研 Python 脚本 + pywxdump

---

## 🙏 鸣谢

本项目站在这些优秀项目的肩膀上：

| 项目 | 贡献 |
|------|------|
| [**ta-likes-me** Skill](skill/SKILL.md) | 原始情感分析框架与评分体系，本项目的直接前身 |
| [**WeFlow** by hicccc77](https://github.com/hicccc77/WeFlow) | 微信聊天分析的核心指标设计（主动率、回复速度、深夜消息等）启发了本项目的维度体系 |
| [**PyWxDump** by xaoyaoo](https://github.com/xaoyaoo/PyWxDump) | 微信数据库密钥提取方案 |
| [**WeChatMsg** by LC044](https://github.com/LC044/WeChatMsg) | 微信聊天记录导出工具推荐 |
| [**shadcn/ui**](https://ui.shadcn.com) | 界面组件库 |
| [**Recharts**](https://recharts.org) | 数据可视化图表 |

---

## ⚠️ 免责声明

- 本工具仅供辅助参考，**情感判断最终还是靠你自己**
- 所有聊天记录在本地处理，仅调用 DeepSeek API 进行文本分析
- **请勿将他人聊天记录用于非授权用途**，使用本工具须遵守相关法律法规
- 评分是参考，不是圣旨

---

## 📄 License

[MIT](LICENSE) © 2025 ZHANG Tianrui
