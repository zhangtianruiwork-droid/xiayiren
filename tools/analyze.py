#!/usr/bin/env python3
"""
好感度综合分析器 — 调用 DeepSeek API 进行多维度评分
输入：signals_input.json（由 Claude 准备的结构化信号）
输出：analysis_result.json（评分 + 分析报告）
"""

import argparse
import json
import os
import sys
from pathlib import Path

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
MODEL = "deepseek-chat"

SYSTEM_PROMPT = """你是一位专业的情感分析师，拥有心理学、行为科学和人际关系研究背景。
你的任务是根据用户提供的关于某人（ta）的各种信号，量化评估"ta喜不喜欢这个用户"。

你必须：
1. 客观分析，不美化，不安慰式编造
2. 区分"普通好感"、"暧昧"、"认真喜欢"、"把用户当备胎"四种状态
3. 给出具体可执行的行动建议，不说废话
4. 识别用户可能存在的认知偏差（投射、过度解读等）
5. 如果信号不足，明确指出需要什么额外信息

评分标准（1-10分）：
- 9-10：ta基本已经在等对方表白，信号极其明显
- 7-8：明显有好感，关系在升温，可以推进
- 5-6：有一定好感但不确定，需要更多信号
- 3-4：普通朋友感觉居多，好感信号偏弱
- 1-2：几乎没有特殊信号，可能是对方一厢情愿

输出必须是合法的 JSON，使用以下结构：
{
  "score": 数字（小数点后一位，如 7.2）,
  "dimensions": {
    "initiative": {"score": 数字, "key_signals": ["具体信号描述"], "concerns": ["担忧点"]},
    "response_quality": {"score": 数字, "key_signals": [], "concerns": []},
    "uniqueness": {"score": 数字, "key_signals": [], "concerns": []},
    "emotional_exposure": {"score": 数字, "key_signals": [], "concerns": []},
    "behavioral": {"score": 数字, "key_signals": [], "concerns": []},
    "future_oriented": {"score": 数字, "key_signals": [], "concerns": []}
  },
  "special_signals": {
    "strong_positive": ["强正向信号列表"],
    "red_flags": ["危险信号列表"]
  },
  "verdict": "一句话总结ta的感情状态",
  "what_type_of_like": "认真喜欢 / 普通好感 / 暧昧状态 / 可能当备胎 / 普通朋友",
  "confidence": "high / medium / low",
  "confidence_reason": "说明置信度原因",
  "action_advice": "具体的行动建议（200字以内，直接说要做什么）",
  "what_more_info_needed": "如果原材料不足，列出最有价值的补充信息",
  "honest_assessment": "不顾用户感受的诚实评估（50字以内）"
}
"""

USER_PROMPT_TEMPLATE = """请分析以下关于"ta"的信号，判断ta喜不喜欢这个用户。

## 基础关系信息
{relationship_info}

## 用户主观描述
{subjective_description}

## 量化信号数据
{quantitative_signals}

## 原材料摘要
{raw_material_summary}

## 评分维度权重参考
- 主动性（initiative）: 25%
- 回应质量（response_quality）: 20%
- 独特性（uniqueness）: 20%
- 情感暴露（emotional_exposure）: 15%
- 行为信号（behavioral）: 10%
- 未来导向（future_oriented）: 5%
- 直觉修正: 5%（已整合到主观描述中）

请综合所有信息，输出完整的 JSON 分析报告。只输出 JSON，不要其他内容。"""


def call_deepseek(input_data: dict) -> dict:
    """调用 DeepSeek API 进行分析"""
    try:
        import urllib.request
        import urllib.error

        user_prompt = USER_PROMPT_TEMPLATE.format(
            relationship_info=json.dumps(input_data.get("relationship_info", {}), ensure_ascii=False, indent=2),
            subjective_description=input_data.get("subjective_description", "用户未提供主观描述"),
            quantitative_signals=json.dumps(input_data.get("quantitative_signals", {}), ensure_ascii=False, indent=2),
            raw_material_summary=input_data.get("raw_material_summary", "无原始材料"),
        )

        payload = json.dumps({
            "model": MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 2000,
            "response_format": {"type": "json_object"}
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{DEEPSEEK_BASE_URL}/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=60) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))

        content = resp_data["choices"][0]["message"]["content"]

        # 尝试解析 JSON
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            # 如果 JSON 解析失败，提取其中的 JSON 块
            import re
            m = re.search(r'\{.*\}', content, re.DOTALL)
            if m:
                result = json.loads(m.group(0))
            else:
                raise ValueError("DeepSeek 返回内容无法解析为 JSON")

        result["api_success"] = True
        return result

    except Exception as e:
        return {
            "api_success": False,
            "error": str(e),
            "fallback_note": "DeepSeek API 调用失败，请由 Claude 完成综合分析"
        }


def main():
    parser = argparse.ArgumentParser(description='好感度综合分析器')
    parser.add_argument('--input', required=True, help='信号输入文件路径（JSON）')
    parser.add_argument('--output', default='/tmp/analysis_result.json', help='分析结果输出路径')
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"错误：输入文件不存在 {args.input}", file=sys.stderr)
        sys.exit(1)

    input_data = json.loads(input_path.read_text(encoding='utf-8'))

    print("正在调用 DeepSeek API 进行综合分析...", flush=True)
    result = call_deepseek(input_data)

    output_path = Path(args.output)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')

    if result.get("api_success"):
        print(f"分析完成！综合评分：{result.get('score', '?')} / 10")
        print(f"结论：{result.get('verdict', '')}")
        print(f"结果已保存到 {args.output}")
    else:
        print(f"API 调用失败：{result.get('error', '未知错误')}")
        print("已保存错误信息，Claude 将接管分析")
        sys.exit(2)


if __name__ == '__main__':
    main()
