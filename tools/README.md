# 工具脚本使用说明

## 环境准备

```bash
pip install psutil pywxdump requests
```

## wechat_export.py — 微信聊天记录导出

支持微信 3.x（WeChat.exe）和 4.x（Weixin.exe）。

**前提**：微信需正在运行，且已登录。

```bash
python wechat_export.py
```

脚本会自动：
1. 检测微信进程和版本
2. 读取数据文件路径
3. 尝试提取数据库密钥（4.x 建议改用 WeFlow）
4. 输出可读聊天记录

> 微信 4.x 密钥提取尚在完善中，建议优先使用 [WeFlow](https://github.com/hicccc77/WeFlow)。

## wechat_parser.py — 解析已导出文件

```bash
python wechat_parser.py --file chat.txt --output signals.txt --format auto
```

支持格式：`txt`、`csv`、`html`（WeFlow / WeChatMsg 导出均可）

## qq_parser.py — QQ 聊天记录解析

```bash
python qq_parser.py --file qq_chat.txt --output signals.txt
```

支持 QQ 消息管理器导出的 `txt` / `mht` 格式。

## analyze.py — 独立调用 DeepSeek 分析

```bash
export DEEPSEEK_API_KEY=sk-your_key_here   # Windows: set DEEPSEEK_API_KEY=...
python analyze.py --input signals_input.json --output result.json
```

`signals_input.json` 格式：
```json
{
  "ta_name": "小橙子",
  "relationship": "同事，认识3个月",
  "signals": {
    "initiative": "对方主动发起约60%的对话",
    "response_speed": "通常5分钟内回复",
    "late_night": true,
    "unique_treatment": "有专属称呼"
  },
  "chat_content": "（粘贴聊天记录文本）"
}
```
