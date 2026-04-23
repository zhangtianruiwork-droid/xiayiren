import { useState, useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import {
  Heart, MessageCircle, Image as ImageIcon, FileText,
  ChevronRight, ChevronLeft, Sparkles, Zap, Target,
  TrendingUp, AlertTriangle, MessageSquare, Send,
  Upload, X, Loader2, BarChart3, Smile, HelpCircle,
  CheckCircle2, RefreshCw, Info, Quote, Brain, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import './App.css';

// ─── Types ─────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 'chat';

interface FormData {
  taName: string;
  relationship: string;
  currentStatus: string;
  yourFeeling: string;
  chatFiles: File[];
  chatText: string;
  socialImages: File[];
  chatImages: File[];
  additionalNotes: string;
}

interface AnalysisResult {
  score: number;
  conclusion: string;
  status: string;
  dimensions: { name: string; score: number; description: string; evidence?: string }[];
  keySignals: { signal: string; explanation: string; direction?: string }[];
  riskSignals: { signal: string; explanation: string }[];
  advice: string[];
  confidence: 'low' | 'medium' | 'high';
  confidenceReason?: string;
  honestAssessment: string;
  whatTypeOfLike: string;
  // 工作/私人内容比例
  workContextRatio?: {
    workPercent: number;
    personalPercent: number;
    emotionalSignalsInWork: string[];
  };
  // 关系时间线走势
  timeline?: {
    phase: string;
    score: number;
    trend: string;
    keyEvent: string;
  }[];
  // 情感高光句
  emotionalHighlights?: {
    quote: string;
    significance: string;
    phase: string;
    sentiment: 'positive' | 'negative' | 'neutral';
  }[];
  // 主动性量化
  initiativeStats?: {
    taInitiatedEstimate: string;
    responseSpeedSignal: string;
    lateNightContact: boolean | string;
    messageLengthRatio: string;
  };
  cognitiveBiasCheck?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';

const initialFormData: FormData = {
  taName: '', relationship: '', currentStatus: '', yourFeeling: '',
  chatFiles: [], chatText: '', socialImages: [], chatImages: [], additionalNotes: '',
};

const loadingMessages = [
  '正在分析 ta 的说话习惯...',
  '正在计算回复速度和主动性...',
  '正在识别深夜消息和情感投入信号...',
  '正在评估你们关系的独特性...',
  '正在排除你的主观投射...',
  '正在生成行动建议...',
  '马上好了，别紧张...',
];

const quickQuestions = [
  '给我具体话术',
  'ta是把我当备胎吗',
  '我怎么提高好感度',
  '什么时候表白合适',
  'ta忽冷忽热怎么办',
  '我是不是想多了',
];

// ─── Export Guide Content ───────────────────────────────────────────────────

const SKILL_TOOLS_PATH = String.raw`C:\Users\Administrator\.claude\skills\ta-likes-me\tools`;

const wechatGuide = {
  title: '如何导出微信聊天记录',
  methods: [
    {
      name: '方法一：一键导出脚本（最推荐）',
      badge: '内置工具',
      badgeColor: 'pink',
      steps: [
        '确保微信电脑版已登录并正在运行',
        '确认已将手机聊天记录迁移到电脑：手机微信 → 我 → 设置 → 聊天 → 聊天记录迁移与备份 → 迁移到电脑',
        '首次使用需安装依赖（只需一次）：\n以管理员身份打开 CMD，运行：\npip install pycryptodomex pymem pywin32 psutil',
        '以管理员身份打开 CMD，运行导出脚本：\npython "' + SKILL_TOOLS_PATH + '\\wechat_export.py"',
        '脚本会列出所有联系人，输入编号选择 ta',
        '导出的 TXT 文件自动保存到桌面，上传到这里即可',
      ],
      tip: '全自动一键完成，无需手动操作，导出文件保存到桌面',
      color: 'pink',
      command: `python "${SKILL_TOOLS_PATH}\\wechat_export.py"`,
    },
    {
      name: '方法二：先迁移聊天记录（重要前提）',
      badge: '必读',
      badgeColor: 'red',
      steps: [
        '安卓用户：手机微信 → 我 → 设置 → 聊天 → 聊天记录迁移与备份 → 迁移 → 迁移到电脑微信',
        'iPhone 用户：手机微信 → 我 → 设置 → 通用 → 聊天记录迁移与备份 → 迁移 → 迁移到电脑微信',
        '迁移完成后重启微信电脑版',
        '此步骤决定能导出多少历史记录，建议先迁移再运行脚本',
      ],
      tip: '没有迁移的话，电脑端只有登录后的新消息',
      color: 'red',
    },
    {
      name: '方法三：手动复制（无需任何工具）',
      steps: [
        '打开微信电脑版，找到与 ta 的聊天',
        '直接用鼠标框选聊天记录并复制（Ctrl+A 全选，Ctrl+C 复制）',
        '粘贴到下方的文本框里即可',
      ],
      tip: '最简单，但只能复制当前屏幕显示的内容，历史记录有限',
      color: 'purple',
    },
  ],
};

const qqGuide = {
  title: '如何导出 QQ 聊天记录',
  methods: [
    {
      name: '方法一：QQ 消息管理器（内置功能）',
      steps: [
        '打开 QQ 电脑版',
        '点击左下角「消息管理器」图标（或 Ctrl+Alt+H）',
        '在左侧找到对应的对话',
        '右上角点击「导出消息记录」',
        '选择「TXT 格式」，保存文件',
        '上传到这里即可',
      ],
      tip: 'QQ 电脑版内置功能，不需要额外工具',
      color: 'blue',
    },
    {
      name: '方法二：手机 QQ 导出',
      steps: [
        '在手机 QQ 中打开聊天界面',
        '长按任意消息 → 多选',
        '点击右下角「合并转发」',
        '发给自己（文件传输助手）',
        '在电脑 QQ 中接收，复制内容粘贴到这里',
      ],
      tip: '适合需要特定时间段记录的情况',
      color: 'green',
    },
  ],
};

// ─── Utility Functions ──────────────────────────────────────────────────────

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string || '');
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}


/**
 * 用 canvas 把长图/大图压缩到 Vision 模型能高质量识别的尺寸
 * 微信聊天长截图通常是窄高图，保持宽度 ~1080px、最大高度 4096px
 */
async function compressImageForVision(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const MAX_W = 1080;
      const MAX_H = 4096;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      // 按比例缩放
      if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
      if (h > MAX_H) { w = Math.round(w * MAX_H / h); h = MAX_H; }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);
      // quality 0.9 保持文字清晰度
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(''); };
    img.src = objectUrl;
  });
}

/**
 * 用 DeepSeek Vision 从截图中提取文字内容
 * type='chat'  → 识别聊天气泡中的对话
 * type='social' → 描述朋友圈/社交互动
 */
/** 返回 { text, error } */
async function extractTextFromScreenshot(
  file: File,
  type: 'chat' | 'social'
): Promise<{ text: string; error?: string }> {
  try {
    const base64 = await compressImageForVision(file);
    if (!base64) return { text: '', error: '图片读取失败' };

    const prompt = type === 'chat'
      ? `这是一张微信/QQ聊天截图。请把截图中所有可见的聊天记录逐条识别并输出。

规则：
- 左侧气泡（对方发的）→ 每行以"对方："开头
- 右侧气泡（我发的）→ 每行以"我："开头
- 如果有时间戳，写在括号里，例如"[14:32]"
- 表情包写为[表情]，语音消息写为[语音]，图片写为[图片]
- 按时间从上到下顺序输出

示例输出：
[昨天 20:15]
对方：你今天干嘛了
我：在家刷剧，你呢
对方：我也是 哈哈 刷什么剧
我：想见你

只输出上面格式的内容，不要解释，不要分析，遇到不确定的文字用【？】标注。`
      : `这是一张朋友圈或社交媒体截图。请提取关键互动信息：
1. 发帖内容（一句话概括）
2. 评论互动：ta评论了什么 / 我评论了什么
3. 点赞：ta点赞了我的内容吗 / 我点赞了ta吗
只输出事实，不超过150字，不分析。`;

    const payload = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: base64, detail: 'high' } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 1200,
      temperature: 0.05,
    };

    const endpoints = ['/deepseek-api/chat/completions', 'https://api.deepseek.com/chat/completions'];
    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
          body: JSON.stringify(payload),
        });
        if (resp.ok) {
          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content || '';
          if (content) return { text: content };
        }
        const errBody = await resp.text().catch(() => '');
        const errMsg = `HTTP ${resp.status}${errBody ? ': ' + errBody.slice(0, 120) : ''}`;
        console.warn(`[Screenshot OCR] ${url} → ${errMsg}`);
        // 4xx 说明该 endpoint 不支持，不再重试
        if (resp.status >= 400 && resp.status < 500) {
          return { text: '', error: `模型不支持图片识别（${errMsg}）` };
        }
      } catch (e) {
        console.warn('[Screenshot OCR] fetch error:', e);
      }
    }
    return { text: '', error: '网络请求失败' };
  } catch (e) {
    console.warn('[Screenshot OCR] unexpected error:', e);
    return { text: '', error: String(e) };
  }
}

function buildScoreBar(score: number): string {
  const filled = Math.round(score);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

// ─── DeepSeek API ───────────────────────────────────────────────────────────

async function analyzeWithDeepSeek(
  formData: FormData,
  chatContents: string[],
  _imageDescriptions: string[]
): Promise<AnalysisResult> {
  const systemPrompt = `你是一位专业的情感行为分析师，基于心理学研究和行为科学，专门分析聊天记录中的情感信号。
你必须基于具体行为证据做出判断，禁止出于"保险"而打中间分数。

## 关键量化信号框架（每项必须评估，哪怕数据不足也要说明原因）

**主动性 [权重25%]**
- 对方主动发起对话的比例：若对方主动 >60% → 强阳性；若用户主动 >70% → 强负信号（单方热恋预警）
- 对方是否在无理由情况下主动找话题
- 是否主动提出线下见面/约

**回应质量 [权重20%]**
- 回复速度：常态 <10分钟 → 阳性；常态数小时甚至不回 → 负信号
- 消息长度比：对方消息普遍更长 → 阳性；明显更短更敷衍 → 负信号
- 深夜回复（22:00–02:00）频繁 → 强阳性
- 回复中是否频繁追问/延续对话（而非"哦""嗯""好的"收尾）

**独特性 [权重20%]**
- 对用户是否有区别于他人的称呼/专属梗/特别对待
- 朋友圈互动（点赞、评论的速度与频率）
- 是否分享不对外公开的事情

**情感暴露 [权重15%]**
- 主动分享弱点/烦恼/私密家庭信息
- 征询用户意见并认真对待
- 第一时间找用户分享好消息/坏消息

**行为信号 [权重10%]**
- 记住细节并之后提及（证明在认真听）
- 制造或维持1对1相处机会
- 实物/行动关心（礼物、帮忙、接送等）

**未来导向+语言风格匹配 [权重10%]**
- 使用"我们"、"下次"、"以后"等包含用户的未来语言
- 语言风格是否在向用户靠拢（用词、表情包风格、句式模仿）→ 心理学研究显示LSM是浪漫吸引的有效预测指标

## 评分强制规则（严格执行）

9–10：强阳性信号在3个以上维度集中出现，对方明显主动，几乎可以断定
7–8：2–3个维度有清晰正向证据，综合指向有意，可以推进
5–6：【仅允许在以下情况打此区间】信号真实相互矛盾（某些维度强阳性但其他维度强负），或材料极少无法判断，但必须在confidence中注明
3–4：主要信号偏弱或偏负，如用户单方面高主动、回复敷衍、无独特对待
1–2：多项负信号，明确没有特殊感情

**严格禁止打5.0/5.5/5.3等正中间分数来表达"不确定"**
→ 不确定 = confidence: low + 解释哪些数据缺失 + 给出偏低的分数（宁可低估，避免给用户虚假希望）
→ 有矛盾信号 = 具体说明哪些信号指向正面、哪些负面，然后给出综合判断而非回避

## 工作场景下的情感信号提取（重要）

当聊天以工作内容为主时，不要因为工作消息多就稀释评分。要单独识别：
- **超出职责的关心**：工作聊天中夹带"你吃了吗""最近累不累""注意休息"等非必要关心
- **下班后主动联系**：在工作时间之外发起工作相关消息（可能是借口）
- **工作之外的切换**：聊着工作突然问私人问题或分享私人话题
- **温度注入**：在纯工作消息里用了特别亲近/温柔的语气、专属表情、段子
- **工作帮忙主动超出范围**：主动帮对方解决工作问题但没有必须帮的理由
先估算工作消息占全部消息的比例（0–100整数），再从中提取情感信号，两者分开评估。

## 关键词和情感高光句提取

从聊天记录中找出最有分析价值的原句（直接引用），每句注明：
- 所在阶段（早期/中期/近期）
- 情感倾向（positive正向好感/negative疏远冷漠/neutral中性工作）
- 为什么这句话重要

高价值信号词参考（但不限于此）：
- 正向：主动约见/无理由关心/分享不对外说的事/深夜消息/使用"我们"/"下次"/"记得你说过"/独特昵称/心情首选分享对象
- 负向：已读不回/回复极短只有"嗯/哦/好"/只在需要帮助时联系/从不主动/从不问你的状态

## 关系时间线（如有早中近期数据）

对比三段数据，分析关系走势：
- 早期：初始互动模式和温度
- 中期：关系是否升温/降温/维持
- 近期：当前真实状态
每段给出1–10的阶段评分，并标明走势方向。

## 必须检查的认知偏差
- 用户是否把"正常礼貌回复"当作"特殊对待"
- 用户自己主动比例是否 >70%（常见的单方热恋）
- 对方回应是否高度同质化（可能是群发/客套话）
- 热恋期回忆≠现在的状态（如果提供的是热恋期记录，需说明）

只输出JSON，结构如下：
{
  "score": 数字（1–10，一位小数，不得为5.0/5.5/5.3/5.2/4.8等明显的"中间保险分"），
  "conclusion": "一句话总结（15字以内，必须有明确倾向，不得用'有待观察'敷衍）",
  "status": "认真喜欢/暧昧升温/单方热恋/普通好感/暧昧模糊/当备胎/普通朋友",
  "initiativeStats": {
    "taInitiatedEstimate": "估算对方主动发起比例，如'约40%'或'材料不足无法判断'",
    "responseSpeedSignal": "快/慢/不稳定/无数据",
    "lateNightContact": true或false或"无数据",
    "messageLengthRatio": "对方消息更长/更短/相当/无数据"
  },
  "workContextRatio": {
    "workPercent": 0–100整数（估算工作相关消息占比），
    "personalPercent": 0–100整数,
    "emotionalSignalsInWork": ["在工作语境中发现的情感信号描述，如'下班后发来关心消息'", "..."]
  },
  "timeline": [
    {"phase": "早期", "score": 1–10数字, "trend": "升温/降温/稳定/无数据", "keyEvent": "这一阶段的典型行为或事件"},
    {"phase": "中期", "score": 数字, "trend": "...", "keyEvent": "..."},
    {"phase": "近期", "score": 数字, "trend": "...", "keyEvent": "..."}
  ],
  "emotionalHighlights": [
    {"quote": "直接引用聊天原句（不超过50字）", "significance": "为什么这句话是关键信号", "phase": "早期/中期/近期", "sentiment": "positive/negative/neutral"},
    ...至多6条最有价值的
  ],
  "dimensions": [
    {"name": "主动性", "weight": "25%", "score": 0–100整数, "evidence": "引用聊天记录中的具体内容或行为，不得泛泛而谈"},
    {"name": "回应质量", "weight": "20%", "score": 整数, "evidence": "具体证据"},
    {"name": "独特性", "weight": "20%", "score": 整数, "evidence": "具体证据"},
    {"name": "情感暴露", "weight": "15%", "score": 整数, "evidence": "具体证据"},
    {"name": "行为信号", "weight": "10%", "score": 整数, "evidence": "具体证据"},
    {"name": "未来导向+LSM", "weight": "10%", "score": 整数, "evidence": "具体证据"}
  ],
  "keySignals": [
    {"signal": "信号名称", "direction": "正向或负向", "explanation": "为什么重要+在哪里体现的"}
  ],
  "riskSignals": [
    {"signal": "风险", "explanation": "说明"}
  ],
  "cognitiveBiasCheck": "用户是否存在过度解读/投射，具体说明（如无则写'未发现明显偏差'）",
  "advice": ["建议1（具体可操作，不说废话）", "建议2", "建议3"],
  "confidence": "high/medium/low",
  "confidenceReason": "数据量是否足够，哪些维度信息缺失",
  "honestAssessment": "不顾用户感受的诚实一句话（30字以内，必须有明确观点，不得模糊）",
  "whatTypeOfLike": "认真喜欢/普通好感/暧昧/备胎/普通朋友"
}

只输出JSON，不要任何其他内容。`;

  const chatSummary = (() => {
    if (chatContents.length === 0) return '';
    const fullText = chatContents.join('\n---\n');
    const LIMIT = 15000;
    let chatText: string;
    let note: string;
    if (fullText.length <= LIMIT) {
      chatText = fullText;
      note = '';
    } else {
      // 分段采样：早期20% + 中期30% + 近期50%，覆盖关系全程而非只截一端
      const early = fullText.slice(0, Math.floor(LIMIT * 0.2));
      const midStart = Math.floor(fullText.length / 2 - LIMIT * 0.15);
      const mid = fullText.slice(midStart, midStart + Math.floor(LIMIT * 0.3));
      const recent = fullText.slice(-Math.floor(LIMIT * 0.5));
      chatText = `【早期片段】\n${early}\n\n【中期片段】\n${mid}\n\n【近期片段】\n${recent}`;
      note = `（原始内容 ${Math.round(fullText.length / 1000)}k字，已按早期/中期/近期三段采样，覆盖关系全程）`;
    }
    return `\n\n## 聊天记录内容（含截图OCR）${note}\n${chatText}`;
  })();

  const totalImages = formData.chatImages.length + formData.socialImages.length;
  const imageSummary = totalImages > 0
    ? `\n\n## 截图材料说明\n用户上传了 ${totalImages} 张截图，内容已通过 OCR 提取并包含在上方聊天记录中。`
    : '';

  const userPrompt = `请分析以下信息，判断 ta 喜不喜欢这个用户。

## 基础关系信息
- ta 的代号：${formData.taName}
- 关系类型：${formData.relationship}
- 当前状态描述：${formData.currentStatus || '未填写'}

## 用户的直觉/主观感受
${formData.yourFeeling || '用户未提供主观感受'}

## 用户的补充描述
${formData.additionalNotes || '无'}
${chatSummary}
${imageSummary}

## 原材料丰富度
- 聊天记录文件：${formData.chatFiles.length} 个
- 直接粘贴文本：${formData.chatText ? '有' : '无'}
- 朋友圈截图：${formData.socialImages.length} 张
- 聊天截图：${formData.chatImages.length} 张

请综合以上全部信息，输出JSON分析报告。`;

  // Try via Vite proxy first (dev mode), fallback to direct call
  const endpoints = [
    '/deepseek-api/chat/completions',
    'https://api.deepseek.com/chat/completions',
  ];

  let lastError: Error | null = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 4000,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        throw new Error(`API ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('API 返回空内容');

      const parsed = JSON.parse(content);

      // Normalize to match our AnalysisResult interface
      return {
        score: Number(parsed.score) || 5,
        conclusion: parsed.conclusion || '分析完成',
        status: parsed.status || '暧昧状态',
        dimensions: Array.isArray(parsed.dimensions) ? parsed.dimensions : [],
        keySignals: Array.isArray(parsed.keySignals) ? parsed.keySignals : [],
        riskSignals: Array.isArray(parsed.riskSignals) ? parsed.riskSignals : [],
        advice: Array.isArray(parsed.advice) ? parsed.advice : [],
        confidence: (['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium') as 'high' | 'medium' | 'low',
        confidenceReason: parsed.confidenceReason || '',
        honestAssessment: parsed.honestAssessment || '',
        whatTypeOfLike: parsed.whatTypeOfLike || parsed.status || '',
        workContextRatio: parsed.workContextRatio || undefined,
        timeline: Array.isArray(parsed.timeline) ? parsed.timeline : undefined,
        emotionalHighlights: Array.isArray(parsed.emotionalHighlights) ? parsed.emotionalHighlights : undefined,
        initiativeStats: parsed.initiativeStats || undefined,
        cognitiveBiasCheck: parsed.cognitiveBiasCheck || '',
      };
    } catch (e) {
      lastError = e as Error;
      console.warn(`Endpoint ${endpoint} failed:`, e);
    }
  }

  throw lastError || new Error('所有 API 端点均失败');
}

// ─── Export Guide Modal ─────────────────────────────────────────────────────

function ExportGuideModal({
  type,
  open,
  onClose,
}: {
  type: 'wechat' | 'qq';
  open: boolean;
  onClose: () => void;
}) {
  const guide = type === 'wechat' ? wechatGuide : qqGuide;
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const colorMap: Record<string, { tip: string; badge: string; border: string }> = {
    pink:   { tip: 'bg-pink-50 border-pink-200 text-pink-800',     badge: 'bg-pink-500 text-white',   border: 'border-pink-200' },
    green:  { tip: 'bg-green-50 border-green-200 text-green-800',  badge: 'bg-green-500 text-white',  border: 'border-green-200' },
    blue:   { tip: 'bg-blue-50 border-blue-200 text-blue-800',     badge: 'bg-blue-500 text-white',   border: 'border-blue-200' },
    purple: { tip: 'bg-purple-50 border-purple-200 text-purple-800', badge: 'bg-purple-500 text-white', border: 'border-purple-200' },
    red:    { tip: 'bg-red-50 border-red-200 text-red-800',        badge: 'bg-red-500 text-white',    border: 'border-red-200' },
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[88vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-5 border-b border-gray-100 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="w-5 h-5 text-pink-500" />
            {guide.title}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 p-5">
          <div className="space-y-5">
            {(guide.methods as any[]).map((method, idx) => {
              const c = colorMap[method.color] || colorMap.blue;
              return (
                <div key={idx} className={`rounded-2xl border ${c.border} overflow-hidden`}>
                  {/* Header */}
                  <div className={`px-4 py-3 flex items-center gap-2 ${method.color === 'pink' ? 'bg-pink-50' : method.color === 'red' ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <h4 className="font-semibold text-gray-800 flex-1">{method.name}</h4>
                    {method.badge && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>
                        {method.badge}
                      </span>
                    )}
                  </div>

                  {/* Steps */}
                  <div className="px-4 py-3 space-y-2.5">
                    {method.steps.map((step: string, sIdx: number) => (
                      <div key={sIdx} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="whitespace-pre-line leading-relaxed">{step}</span>
                      </div>
                    ))}

                    {/* 命令复制框 */}
                    {method.command && (
                      <div className="mt-3 rounded-xl bg-gray-900 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800">
                          <span className="text-xs text-gray-400">管理员 CMD / PowerShell</span>
                          <button
                            onClick={() => handleCopy(method.command, idx)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                          >
                            {copiedIdx === idx ? (
                              <><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">已复制</span></>
                            ) : (
                              <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>复制命令</>
                            )}
                          </button>
                        </div>
                        <div className="px-3 py-2.5 font-mono text-xs text-green-400 break-all">
                          {method.command}
                        </div>
                      </div>
                    )}

                    {/* Tip */}
                    {method.tip && (
                      <div className={`mt-2 px-3 py-2 rounded-lg border text-xs ${c.tip}`}>
                        💡 {method.tip}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2 text-sm text-amber-800">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">隐私说明</p>
                  <p>导出脚本在你的电脑本地运行，聊天记录不会上传到任何服务器。分析完成后刷新网页即可清除所有数据。</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Score Bar Component ────────────────────────────────────────────────────

function ScoreDisplay({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 8) return { ring: 'from-green-400 to-emerald-500', text: 'from-green-500 to-emerald-600', glow: 'shadow-green-500/30' };
    if (s >= 6) return { ring: 'from-yellow-400 to-orange-400', text: 'from-yellow-500 to-orange-500', glow: 'shadow-orange-500/30' };
    if (s >= 4) return { ring: 'from-orange-400 to-red-400', text: 'from-orange-500 to-red-500', glow: 'shadow-orange-500/30' };
    return { ring: 'from-red-400 to-rose-500', text: 'from-red-500 to-rose-600', glow: 'shadow-red-500/30' };
  };

  const getEmoji = (s: number) => {
    if (s >= 9) return '😍';
    if (s >= 7) return '😊';
    if (s >= 5) return '🤔';
    if (s >= 3) return '😐';
    return '😢';
  };

  const getLabel = (s: number) => {
    if (s >= 9) return 'ta基本在等你表白';
    if (s >= 7) return '明显有好感';
    if (s >= 5) return '有一定好感';
    if (s >= 3) return '普通朋友感觉';
    return '信号很弱';
  };

  const c = getColor(score);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`relative w-44 h-44 rounded-full bg-gradient-to-br ${c.ring} p-1.5 shadow-2xl ${c.glow}`}>
        <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center">
          <span className={`text-5xl font-black bg-gradient-to-r ${c.text} bg-clip-text text-transparent`}>
            {score.toFixed(1)}
          </span>
          <span className="text-gray-400 text-sm font-medium">/ 10</span>
        </div>
        <div className="absolute -top-1 -right-1 w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center text-2xl">
          {getEmoji(score)}
        </div>
      </div>
      <p className="text-sm text-gray-500 font-mono">{buildScoreBar(score)}</p>
      <p className="text-base font-semibold text-gray-600">{getLabel(score)}</p>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────

function App() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: '你好！关于刚才的分析结果，有什么想深入了解的？' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [exportGuide, setExportGuide] = useState<'wechat' | 'qq' | null>(null);
  // OCR 提取结果：key=文件名，value={ text, error }
  const [ocrPreviews, setOcrPreviews] = useState<Record<string, { text: string; error?: string }>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);

  // GSAP step transitions
  useEffect(() => {
    if (stepRef.current) {
      gsap.fromTo(stepRef.current, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
    }
  }, [currentStep]);

  // Loading progress animation
  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = setInterval(() => {
      setLoadingProgress(prev => Math.min(prev + 1.2, 92)); // stops at 92, jumps to 100 on success
    }, 80);
    const msgInterval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length);
    }, 900);
    return () => { clearInterval(interval); clearInterval(msgInterval); };
  }, [isAnalyzing]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleStartAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setLoadingProgress(0);
    setCurrentStep(3);

    try {
      // Read text files
      const chatContents: string[] = [];
      for (const file of formData.chatFiles) {
        try {
          const text = await readFileAsText(file);
          chatContents.push(`[文件: ${file.name}]\n${text}`);
        } catch { /* skip unreadable files */ }
      }
      if (formData.chatText.trim()) {
        chatContents.push(`[直接粘贴的聊天记录]\n${formData.chatText}`);
      }

      // ── 截图 OCR：逐张提取文字后塞进 chatContents ──────────────────
      const allScreenshots: { file: File; type: 'chat' | 'social' }[] = [
        ...formData.chatImages.map(f => ({ file: f, type: 'chat' as const })),
        ...formData.socialImages.map(f => ({ file: f, type: 'social' as const })),
      ];
      const newOcrPreviews: Record<string, { text: string; error?: string }> = {};
      for (const { file, type } of allScreenshots) {
        const label = type === 'chat' ? '聊天截图' : '朋友圈截图';
        const result = await extractTextFromScreenshot(file, type);
        newOcrPreviews[file.name] = result;
        if (result.text) {
          chatContents.push(`[${label}: ${file.name}]\n${result.text}`);
        } else {
          // 识别失败时告知分析模型
          chatContents.push(`[${label}: ${file.name}]\n（识别失败：${result.error || '未知错误'}，请在口述描述中补充这张截图的关键内容）`);
        }
      }
      setOcrPreviews(newOcrPreviews);

      const imageDescriptions: string[] = []; // 内容已并入 chatContents

      const result = await analyzeWithDeepSeek(formData, chatContents, imageDescriptions);

      setLoadingProgress(100);
      await new Promise(r => setTimeout(r, 400));
      setIsAnalyzing(false);
      setAnalysisResult(result);
      setCurrentStep(4);
    } catch (err) {
      setIsAnalyzing(false);
      setAnalysisError((err as Error).message || '分析失败，请检查网络或重试');
      setCurrentStep(2);
    }
  }, [formData]);

  const handleFileUpload = (type: 'chatFiles' | 'socialImages' | 'chatImages', files: FileList | null) => {
    if (files) {
      setFormData(prev => ({ ...prev, [type]: [...prev[type], ...Array.from(files)] }));
    }
  };

  const removeFile = (type: 'chatFiles' | 'socialImages' | 'chatImages', index: number) => {
    setFormData(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
  };

  const handleChatSend = useCallback(async (message?: string) => {
    const text = message || chatInput.trim();
    if (!text || isChatLoading) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsChatLoading(true);

    try {
      const systemPrompt = `你是情感分析助手，基于刚才对"${formData.taName}"的分析结果（综合评分 ${analysisResult?.score}/10，结论：${analysisResult?.conclusion}）来回答问题。
      回答要简洁直接，不超过150字，用中文，口语化风格。不要废话，直接给出有用建议。`;

      const response = await fetch('/deepseek-api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            ...chatMessages.slice(-6),
            { role: 'user', content: text },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) throw new Error('API 请求失败');
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || '抱歉，我现在有点懵，能换个问法吗？';
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '网络好像有点问题，刷新一下再试试？' }]);
    } finally {
      setIsChatLoading(false);
    }
  }, [chatInput, chatMessages, isChatLoading, formData.taName, analysisResult]);

  // ── Step 1: Basic Info ──────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-100 to-purple-100 rounded-full text-pink-600 text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          第一步 / 共两步
        </div>
        <h2 className="text-3xl font-bold text-gray-800">先告诉我关于 ta 的事 💕</h2>
        <p className="text-gray-500 text-sm">这些信息帮助 AI 更准确地判断</p>
      </div>

      <div className="space-y-5 bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl shadow-pink-100/50 border border-pink-100">
        <div className="space-y-2">
          <Label className="text-gray-700 font-medium flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-500" />
            ta 的代号 <span className="text-red-400 text-xs">必填</span>
          </Label>
          <Input
            placeholder="小橙子 / 隔壁工位那个 / 学长 / 初恋"
            value={formData.taName}
            onChange={(e) => setFormData(prev => ({ ...prev, taName: e.target.value }))}
            className="h-12 rounded-xl border-gray-200 focus:border-pink-400"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-700 font-medium flex items-center gap-2">
            <Target className="w-4 h-4 text-pink-500" />
            你们的关系 <span className="text-red-400 text-xs">必填</span>
          </Label>
          <Select value={formData.relationship} onValueChange={(v) => setFormData(prev => ({ ...prev, relationship: v }))}>
            <SelectTrigger className="h-12 rounded-xl border-gray-200">
              <SelectValue placeholder="选择关系类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="同学">同学 📚</SelectItem>
              <SelectItem value="同事">同事 💼</SelectItem>
              <SelectItem value="网友">网友 💻</SelectItem>
              <SelectItem value="朋友">朋友 🤝</SelectItem>
              <SelectItem value="邻居">邻居 🏠</SelectItem>
              <SelectItem value="前任">前任（又联系了）💔</SelectItem>
              <SelectItem value="陌生人">刚认识</SelectItem>
              <SelectItem value="其他">其他 ✨</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-700 font-medium flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-pink-500" />
            你们现在的状态
          </Label>
          <Textarea
            placeholder="认识多久了？有没有单独出去过？平时聊天频繁吗？最近发生了什么让你想分析 ta？"
            value={formData.currentStatus}
            onChange={(e) => setFormData(prev => ({ ...prev, currentStatus: e.target.value }))}
            className="min-h-[90px] rounded-xl border-gray-200 focus:border-pink-400 resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-700 font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-pink-500" />
            你自己觉得 ta 喜不喜欢你？为什么这么想？
          </Label>
          <Textarea
            placeholder="直觉很重要！说说你的感受，以及让你这么觉得的具体事情..."
            value={formData.yourFeeling}
            onChange={(e) => setFormData(prev => ({ ...prev, yourFeeling: e.target.value }))}
            className="min-h-[90px] rounded-xl border-gray-200 focus:border-pink-400 resize-none"
          />
        </div>
      </div>

      {analysisError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-1">上次分析失败</p>
            <p>{analysisError}</p>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => setCurrentStep(2)}
          disabled={!formData.taName || !formData.relationship}
          className="h-13 px-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold text-base shadow-lg shadow-pink-500/30 transition-all hover:scale-105 disabled:opacity-50"
        >
          下一步，上传原材料
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );

  // ── Step 2: Materials ───────────────────────────────────────────────────

  const renderStep2 = () => (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-100 to-purple-100 rounded-full text-pink-600 text-sm font-medium">
          <Upload className="w-4 h-4" />
          第二步 / 共两步
        </div>
        <h2 className="text-3xl font-bold text-gray-800">上传你们的互动记录 📱</h2>
        <p className="text-gray-500 text-sm">材料越多越准。没有文件也没关系，口述一样能分析。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WeChat / QQ */}
        <Accordion type="single" collapsible className="space-y-4">
          <AccordionItem value="chat" className="bg-white/80 backdrop-blur-sm rounded-2xl border border-pink-100 shadow-lg shadow-pink-100/30 overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-pink-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-800">微信/QQ 聊天记录</div>
                  <div className="text-sm text-gray-500">.txt .csv .html 或直接粘贴</div>
                </div>
                {(formData.chatFiles.length > 0 || formData.chatText) && (
                  <Badge className="bg-green-100 text-green-700 border-green-300 ml-2 text-xs">已上传</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-4">
                {/* How to export buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportGuide('wechat')}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-full hover:bg-green-100 transition-colors border border-green-200"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    怎么导出微信记录？
                  </button>
                  <button
                    onClick={() => setExportGuide('qq')}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors border border-blue-200"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    怎么导出QQ记录？
                  </button>
                </div>

                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-pink-400 transition-colors cursor-pointer"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFileUpload('chatFiles', e.dataTransfer.files); }}
                >
                  <input type="file" accept=".txt,.csv,.html" multiple
                    onChange={(e) => handleFileUpload('chatFiles', e.target.files)}
                    className="hidden" id="chat-files" />
                  <label htmlFor="chat-files" className="cursor-pointer">
                    <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">点击上传或拖拽文件到此处</p>
                    <p className="text-xs text-gray-400 mt-1">.txt .csv .html</p>
                  </label>
                </div>

                {formData.chatFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {formData.chatFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <span className="text-sm text-gray-700 truncate max-w-[200px]">{file.name}</span>
                          <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)}KB</span>
                        </div>
                        <button onClick={() => removeFile('chatFiles', i)} className="text-gray-400 hover:text-red-500 ml-2">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Textarea
                  placeholder="或者把聊天记录直接粘贴到这里（支持微信/QQ/任何平台）..."
                  value={formData.chatText}
                  onChange={(e) => setFormData(prev => ({ ...prev, chatText: e.target.value }))}
                  className="min-h-[100px] rounded-xl border-gray-200 focus:border-pink-400 resize-none text-sm"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Social screenshots */}
          <AccordionItem value="social" className="bg-white/80 backdrop-blur-sm rounded-2xl border border-pink-100 shadow-lg shadow-pink-100/30 overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-pink-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-800">朋友圈/社交截图</div>
                  <div className="text-sm text-gray-500">ta 的动态、你们的互动</div>
                </div>
                {formData.socialImages.length > 0 && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-300 ml-2 text-xs">{formData.socialImages.length}张</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-3">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  朋友圈截图、点赞互动、微博/小红书/ins 截图都可以
                </p>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-pink-400 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFileUpload('socialImages', e.dataTransfer.files); }}
                >
                  <input type="file" accept="image/*" multiple
                    onChange={(e) => handleFileUpload('socialImages', e.target.files)}
                    className="hidden" id="social-images" />
                  <label htmlFor="social-images" className="cursor-pointer">
                    <ImageIcon className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">点击上传或拖拽图片</p>
                  </label>
                </div>
                {formData.socialImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {formData.socialImages.map((file, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => removeFile('socialImages', i)}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Accordion type="single" collapsible className="space-y-4">
          {/* Chat screenshots */}
          <AccordionItem value="chat-images" className="bg-white/80 backdrop-blur-sm rounded-2xl border border-pink-100 shadow-lg shadow-pink-100/30 overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-pink-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-800">聊天截图</div>
                  <div className="text-sm text-gray-500">关键对话截图</div>
                </div>
                {formData.chatImages.length > 0 && (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-300 ml-2 text-xs">{formData.chatImages.length}张</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
                  <p className="font-medium">💡 推荐：直接粘贴文字效果最好</p>
                  <p>在微信里长按消息 → 复制，或用电脑版微信全选复制，粘贴到上方"直接粘贴聊天记录"框里，比截图更准确。</p>
                </div>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-pink-400 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFileUpload('chatImages', e.dataTransfer.files); }}
                >
                  <input type="file" accept="image/*" multiple
                    onChange={(e) => handleFileUpload('chatImages', e.target.files)}
                    className="hidden" id="chat-images" />
                  <label htmlFor="chat-images" className="cursor-pointer">
                    <MessageSquare className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">点击上传或拖拽截图</p>
                    <p className="text-xs text-gray-400 mt-1">长图会自动压缩处理，分析时AI会识别内容</p>
                  </label>
                </div>
                {formData.chatImages.length > 0 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2">
                      {formData.chatImages.map((file, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                          <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => removeFile('chatImages', i)}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {/* OCR 预览区：分析完成后显示提取结果 */}
                    {formData.chatImages.some(f => ocrPreviews[f.name]) && (
                      <div className="space-y-2 mt-2">
                        <p className="text-xs font-medium text-gray-600">AI 识别结果预览：</p>
                        {formData.chatImages.map((file, i) => {
                          const preview = ocrPreviews[file.name];
                          if (!preview) return null;
                          return (
                            <div key={i} className={`rounded-xl p-3 text-xs border ${preview.error && !preview.text ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                              <p className="font-medium mb-1 text-gray-700">{file.name}</p>
                              {preview.error && !preview.text ? (
                                <p className="text-red-600">识别失败：{preview.error}<br/>请在"口述补充"里描述这张截图的内容。</p>
                              ) : (
                                <pre className="whitespace-pre-wrap text-gray-700 max-h-32 overflow-y-auto font-sans">{preview.text}</pre>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Notes */}
          <AccordionItem value="notes" className="bg-white/80 backdrop-blur-sm rounded-2xl border border-pink-100 shadow-lg shadow-pink-100/30 overflow-hidden">
            <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-pink-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-800">补充口述</div>
                  <div className="text-sm text-gray-500">没有文件？说说你观察到的事</div>
                </div>
                {formData.additionalNotes && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-300 ml-2 text-xs">已填</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-1.5 text-sm text-gray-500">
                  {[
                    'ta 平时是谁先发消息？',
                    '发消息给 ta，ta 一般多久回？',
                    'ta 会记住你说过的小细节吗？',
                    'ta 有没有主动约过你单独见面？',
                    'ta 跟你说话和跟别人有什么不同？',
                    '最近让你觉得"ta可能有意思"的事是什么？',
                  ].map((q, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink-400 flex-shrink-0" />
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
                <Textarea
                  placeholder="把你想说的都写在这里，越具体越好..."
                  value={formData.additionalNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, additionalNotes: e.target.value }))}
                  className="min-h-[140px] rounded-xl border-gray-200 focus:border-pink-400 resize-none text-sm"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Material summary */}
      {(formData.chatFiles.length > 0 || formData.chatText || formData.socialImages.length > 0 || formData.chatImages.length > 0 || formData.additionalNotes) && (
        <div className="flex flex-wrap gap-2 justify-center">
          {formData.chatFiles.length > 0 && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">聊天记录 {formData.chatFiles.length}份</Badge>}
          {formData.chatText && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">粘贴文本</Badge>}
          {formData.socialImages.length > 0 && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">朋友圈截图 {formData.socialImages.length}张</Badge>}
          {formData.chatImages.length > 0 && <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">聊天截图 {formData.chatImages.length}张</Badge>}
          {formData.additionalNotes && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">口述补充</Badge>}
        </div>
      )}

      <div className="flex justify-between items-center">
        <Button onClick={() => setCurrentStep(1)} variant="outline"
          className="h-12 px-6 rounded-full border-gray-300 text-gray-600 hover:bg-gray-100 font-medium">
          <ChevronLeft className="w-4 h-4 mr-2" />
          上一步
        </Button>
        <Button onClick={handleStartAnalysis}
          className="h-12 px-8 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold shadow-lg shadow-pink-500/30 transition-all hover:scale-105">
          <Sparkles className="w-4 h-4 mr-2" />
          开始 AI 分析
        </Button>
      </div>
    </div>
  );

  // ── Step 3: Loading ─────────────────────────────────────────────────────

  const renderStep3 = () => (
    <div className="w-full max-w-md mx-auto text-center space-y-10">
      <div className="relative w-36 h-36 mx-auto">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 animate-ping opacity-20" />
        <div className="absolute inset-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 animate-pulse opacity-60" />
        <div className="absolute inset-0 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Heart className="w-12 h-12 text-white animate-pulse drop-shadow" />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-bold text-gray-800">AI 正在深度分析中...</h2>
        <p className="text-base text-pink-600 font-medium min-h-[26px] transition-all">
          {loadingMessages[loadingMessageIndex]}
        </p>
      </div>

      <div className="space-y-2">
        <Progress value={loadingProgress} className="h-2.5 rounded-full bg-pink-100" />
        <p className="text-sm text-gray-400">{Math.round(loadingProgress)}%</p>
      </div>

      <div className="flex justify-center gap-6 text-xs text-gray-400">
        {['分析聊天模式', '识别情感信号', '评估关系阶段'].map((label, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );

  // ── Step 4: Results ─────────────────────────────────────────────────────

  const renderStep4 = () => {
    if (!analysisResult) return null;
    const r = analysisResult;

    const confidenceConfig = {
      high: { text: '高', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
      medium: { text: '中', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
      low: { text: '低', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
    }[r.confidence];

    const statusColors: Record<string, string> = {
      '认真喜欢': 'bg-rose-100 text-rose-700 border-rose-300',
      '暧昧状态': 'bg-pink-100 text-pink-700 border-pink-300',
      '普通好感': 'bg-amber-100 text-amber-700 border-amber-300',
      '当备胎嫌疑': 'bg-orange-100 text-orange-700 border-orange-300',
      '普通朋友': 'bg-slate-100 text-slate-700 border-slate-300',
    };

    return (
      <div className="w-full max-w-5xl mx-auto space-y-8">
        {/* Score header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-100 to-purple-100 rounded-full text-pink-600 text-sm font-medium">
            <BarChart3 className="w-4 h-4" />
            关于 {formData.taName}，分析完成
          </div>
          <ScoreDisplay score={r.score} />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">{r.conclusion}</h2>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Badge variant="outline" className={`px-4 py-1 text-sm font-medium ${statusColors[r.status] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                {r.status}
              </Badge>
              {r.whatTypeOfLike && r.whatTypeOfLike !== r.status && (
                <Badge variant="outline" className="px-3 py-1 text-sm bg-purple-50 text-purple-700 border-purple-200">
                  {r.whatTypeOfLike}
                </Badge>
              )}
            </div>
          </div>

          {/* Honest assessment callout */}
          {r.honestAssessment && (
            <div className="max-w-xl mx-auto px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl">
              <p className="text-sm text-gray-600 italic">
                <span className="font-semibold text-gray-800 not-italic">直说：</span>{r.honestAssessment}
              </p>
            </div>
          )}
        </div>

        {/* Dimensions */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl shadow-pink-100/50 border border-pink-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-pink-500" />
            六维度分析
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={r.dimensions}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                  <Radar name="得分" dataKey="score" stroke="#ec4899" fill="#ec4899" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5">
              {r.dimensions.map((dim, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{dim.name}</span>
                    <span className="text-sm font-bold text-pink-600">{dim.score}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-500 transition-all duration-700"
                      style={{ width: `${dim.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">{dim.evidence || dim.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline trend */}
        {r.timeline && r.timeline.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl shadow-pink-100/50 border border-pink-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-pink-500" />
              关系走势
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={r.timeline} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="phase" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis domain={[1, 10]} tick={{ fill: '#6b7280', fontSize: 11 }} tickCount={5} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #fce7f3', fontSize: 12 }}
                      formatter={(v: number) => [`${v} 分`, '阶段评分']}
                    />
                    <Line
                      type="monotone" dataKey="score" stroke="#ec4899" strokeWidth={2.5}
                      dot={{ fill: '#ec4899', r: 5 }} activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {r.timeline.map((t, i) => {
                  const trendColor = t.trend === '升温' ? 'text-rose-500' : t.trend === '降温' ? 'text-blue-400' : 'text-gray-400';
                  const trendIcon = t.trend === '升温' ? '↑' : t.trend === '降温' ? '↓' : '→';
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50">
                      <div className="flex-shrink-0 w-14 text-center">
                        <div className="text-xs text-gray-500 mb-0.5">{t.phase}</div>
                        <div className="text-xl font-bold text-pink-600">{t.score}</div>
                        <div className={`text-xs font-semibold ${trendColor}`}>{trendIcon} {t.trend}</div>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed pt-1">{t.keyEvent}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Initiative balance */}
        {r.initiativeStats && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl shadow-pink-100/50 border border-pink-100">
            <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              互动量化指标
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: '对方主动发起', value: r.initiativeStats.taInitiatedEstimate, icon: '💬' },
                { label: '回复速度', value: r.initiativeStats.responseSpeedSignal, icon: '⚡' },
                { label: '深夜联系', value: r.initiativeStats.lateNightContact === true ? '有' : r.initiativeStats.lateNightContact === false ? '无' : String(r.initiativeStats.lateNightContact), icon: '🌙' },
                { label: '消息长度比', value: r.initiativeStats.messageLengthRatio, icon: '📏' },
              ].map((item, i) => (
                <div key={i} className="p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 text-center border border-purple-100">
                  <div className="text-2xl mb-1">{item.icon}</div>
                  <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                  <div className="text-sm font-bold text-gray-800">{item.value}</div>
                </div>
              ))}
            </div>
            {/* Work context ratio */}
            {r.workContextRatio && r.workContextRatio.workPercent > 20 && (
              <div className="mt-5 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-amber-800">聊天内容构成</span>
                  <span className="text-xs text-amber-600">工作 {r.workContextRatio.workPercent}% · 私人 {r.workContextRatio.personalPercent}%</span>
                </div>
                <div className="h-2 bg-amber-100 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
                    style={{ width: `${r.workContextRatio.workPercent}%` }}
                  />
                </div>
                {r.workContextRatio.emotionalSignalsInWork.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-amber-700 mb-1.5">即便在工作语境中，发现了这些情感信号：</p>
                    {r.workContextRatio.emotionalSignalsInWork.map((sig, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                        <span className="mt-0.5 flex-shrink-0">✦</span>
                        <span>{sig}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Emotional highlights */}
        {r.emotionalHighlights && r.emotionalHighlights.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl shadow-pink-100/50 border border-pink-100">
            <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
              <Quote className="w-5 h-5 text-pink-500" />
              情感高光原句
            </h3>
            <div className="space-y-3">
              {r.emotionalHighlights.map((h, i) => {
                const sentimentStyle = h.sentiment === 'positive'
                  ? 'border-l-rose-400 bg-rose-50'
                  : h.sentiment === 'negative'
                  ? 'border-l-blue-300 bg-blue-50'
                  : 'border-l-gray-300 bg-gray-50';
                const phaseBadge = { '早期': 'bg-purple-100 text-purple-700', '中期': 'bg-blue-100 text-blue-700', '近期': 'bg-green-100 text-green-700' }[h.phase] || 'bg-gray-100 text-gray-600';
                return (
                  <div key={i} className={`border-l-4 pl-4 pr-3 py-3 rounded-r-2xl ${sentimentStyle}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${phaseBadge}`}>{h.phase}</span>
                      <span className="text-xs text-gray-500">{h.sentiment === 'positive' ? '正向信号' : h.sentiment === 'negative' ? '负向信号' : '中性'}</span>
                    </div>
                    <p className="text-sm text-gray-800 font-medium italic mb-1.5">"{h.quote}"</p>
                    <p className="text-xs text-gray-500">{h.significance}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cognitive bias check */}
        {r.cognitiveBiasCheck && r.cognitiveBiasCheck !== '未发现明显偏差' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-pink-100/50 border border-pink-100">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-base">
              <Brain className="w-5 h-5 text-violet-500" />
              认知偏差检测
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">{r.cognitiveBiasCheck}</p>
          </div>
        )}

        {/* Signals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-pink-100/50 border border-pink-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-base">
              <Smile className="w-5 h-5 text-green-500" />
              关键信号解读
            </h3>
            <div className="space-y-3">
              {r.keySignals.length > 0 ? r.keySignals.map((s, i) => (
                <div key={i} className="p-3 bg-green-50 rounded-xl border border-green-100">
                  <div className="font-semibold text-green-800 text-sm mb-0.5">{s.signal}</div>
                  <div className="text-xs text-green-700">{s.explanation}</div>
                </div>
              )) : (
                <p className="text-sm text-gray-500">原材料不足，无法提取关键信号</p>
              )}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl shadow-pink-100/50 border border-pink-100">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-base">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              风险信号
            </h3>
            <div className="space-y-3">
              {r.riskSignals.length > 0 ? r.riskSignals.map((s, i) => (
                <div key={i} className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="font-semibold text-amber-800 text-sm mb-0.5">{s.signal}</div>
                  <div className="text-xs text-amber-700">{s.explanation}</div>
                </div>
              )) : (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <p className="text-sm text-green-700">暂未发现明显风险信号</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Advice */}
        <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl p-8 border border-pink-100">
          <h3 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
            <Zap className="w-5 h-5 text-pink-500" />
            行动建议
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {r.advice.map((adv, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-white rounded-2xl shadow-sm">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-gray-700">{adv}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence & bottom actions */}
        <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm ${confidenceConfig.bg}`}>
          <Info className="w-4 h-4 flex-shrink-0" />
          <span>分析置信度：<span className={`font-semibold ${confidenceConfig.color}`}>{confidenceConfig.text}</span>
          {r.confidence !== 'high' && ' — 补充更多原材料可提高准确度'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <Button onClick={() => setShowChat(true)}
            className="h-12 px-7 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold shadow-lg shadow-pink-500/30 transition-all hover:scale-105">
            <MessageSquare className="w-4 h-4 mr-2" />
            继续追问
          </Button>
          <Button onClick={() => { setAnalysisResult(null); setCurrentStep(2); }} variant="outline"
            className="h-12 px-7 rounded-full border-pink-200 text-pink-600 hover:bg-pink-50 font-semibold">
            <RefreshCw className="w-4 h-4 mr-2" />
            追加材料重新分析
          </Button>
          <Button onClick={() => { setAnalysisResult(null); setFormData(initialFormData); setCurrentStep(1); }} variant="outline"
            className="h-12 px-7 rounded-full border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold">
            换一个 ta
          </Button>
        </div>

        {/* Chat Dialog */}
        <Dialog open={showChat} onOpenChange={setShowChat}>
          <DialogContent className="sm:max-w-lg h-[580px] flex flex-col p-0 gap-0">
            <DialogHeader className="p-4 border-b border-gray-100 flex-shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-500" />
                关于 {formData.taName}，继续问
              </DialogTitle>
            </DialogHeader>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 space-y-3 flex-shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {quickQuestions.map((q, i) => (
                  <button key={i} onClick={() => handleChatSend(q)}
                    className="px-3 py-1 bg-pink-50 text-pink-600 rounded-full text-xs hover:bg-pink-100 transition-colors border border-pink-100">
                    {q}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="输入你的问题..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSend()}
                  className="flex-1 rounded-full border-gray-200 focus:border-pink-400 text-sm"
                />
                <Button onClick={() => handleChatSend()}
                  disabled={!chatInput.trim() || isChatLoading}
                  className="rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 w-10 h-10 p-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // ── Root Layout ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-orange-50">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-pink-200/25 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-purple-200/25 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-orange-200/20 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setCurrentStep(1); setAnalysisResult(null); }}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center shadow-md">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              ta喜不喜欢我？
            </span>
          </div>

          {/* Step indicator */}
          {(currentStep === 1 || currentStep === 2) && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {[1, 2].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    step <= (currentStep as number)
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-md'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step}
                  </div>
                  {step < 2 && <div className={`w-6 h-0.5 rounded ${step < (currentStep as number) ? 'bg-pink-400' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 px-6 py-8 pb-16">
        <div ref={stepRef} className="max-w-6xl mx-auto">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>
      </main>

      <footer className="relative z-10 px-6 pb-8 text-center text-xs text-gray-400">
        仅供参考，感情的事最终靠你自己 💕 · 分析数据不会上传或储存
      </footer>

      {/* Export guide modals */}
      {exportGuide && (
        <ExportGuideModal
          type={exportGuide}
          open={!!exportGuide}
          onClose={() => setExportGuide(null)}
        />
      )}
    </div>
  );
}

export default App;
