#!/usr/bin/env python3
"""
微信聊天记录解析器
支持格式：txt（WeChatMsg/留痕导出）、html、csv、纯文本粘贴
输出：结构化信号摘要，供好感度分析使用
"""

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path


def parse_txt_format(content: str, target_name: str = None) -> dict:
    """解析常见 txt 格式聊天记录（WeChatMsg、手动复制等）"""
    lines = content.strip().split('\n')
    messages = []

    # 常见时间戳格式
    time_patterns = [
        r'(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}:\d{2})',
        r'(\d{4}/\d{2}/\d{2}\s+\d{1,2}:\d{2})',
        r'(\d{2}:\d{2}:\d{2})',
        r'(\d{2}:\d{2})',
    ]

    current_msg = None
    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 检测发言行：时间 + 发言人 + 内容
        matched = False
        for pattern in time_patterns:
            m = re.match(rf'^{pattern}\s+(.+?)[：:]\s*(.*)', line)
            if m:
                if current_msg:
                    messages.append(current_msg)
                time_str = m.group(1)
                sender = m.group(2).strip()
                content_part = m.group(3).strip()
                current_msg = {
                    'time': time_str,
                    'sender': sender,
                    'content': content_part,
                    'is_target': False  # 待确认
                }
                matched = True
                break

        if not matched and current_msg:
            # 续行
            current_msg['content'] += '\n' + line

    if current_msg:
        messages.append(current_msg)

    return messages


def parse_csv_format(content: str) -> list:
    """解析 CSV 格式聊天记录"""
    import csv
    import io
    messages = []
    reader = csv.DictReader(io.StringIO(content))
    for row in reader:
        # 兼容不同的列名
        sender = row.get('sender') or row.get('发送者') or row.get('from') or ''
        content_col = row.get('content') or row.get('内容') or row.get('message') or row.get('消息') or ''
        time_col = row.get('time') or row.get('时间') or row.get('CreateTime') or ''
        if sender and content_col:
            messages.append({
                'time': time_col,
                'sender': sender.strip(),
                'content': content_col.strip(),
            })
    return messages


def identify_speakers(messages: list) -> tuple:
    """识别对话双方：取消息数最多的两个发言人"""
    counter = Counter(m['sender'] for m in messages if m.get('sender'))
    top2 = counter.most_common(2)
    if len(top2) >= 2:
        return top2[0][0], top2[1][0]
    elif len(top2) == 1:
        return top2[0][0], None
    return None, None


def extract_signals(messages: list, my_name: str, target_name: str) -> dict:
    """从消息列表中提取好感度信号"""
    if not messages:
        return {}

    my_msgs = [m for m in messages if m.get('sender') == my_name]
    ta_msgs = [m for m in messages if m.get('sender') == target_name]

    total = len(messages)
    ta_count = len(ta_msgs)
    my_count = len(my_msgs)

    # 1. 主动性分析：谁先开始对话？
    # 简单判断：一段时间内第一条消息视为"开始对话"
    conversation_starters = {'me': 0, 'ta': 0}
    prev_time = None
    for msg in messages:
        if prev_time is None or _time_gap_minutes(prev_time, msg.get('time', '')) > 60:
            if msg.get('sender') == my_name:
                conversation_starters['me'] += 1
            elif msg.get('sender') == target_name:
                conversation_starters['ta'] += 1
        prev_time = msg.get('time', '')

    # 2. 消息长度
    ta_avg_len = sum(len(m['content']) for m in ta_msgs) / max(ta_count, 1)
    my_avg_len = sum(len(m['content']) for m in my_msgs) / max(my_count, 1)

    # 3. 深夜消息（22:00-02:00）
    ta_night = sum(1 for m in ta_msgs if _is_night(m.get('time', '')))
    my_night = sum(1 for m in my_msgs if _is_night(m.get('time', '')))

    # 4. 情感词汇分析
    positive_words = ['喜欢', '想你', '好想', '开心', '哈哈', '嘻嘻', '哈', '爱', '棒', '厉害', '好看', '可爱', '宝', '亲爱', '么么', '抱抱', '想见']
    question_words = ['吗', '呢', '嘛', '吧', '怎么', '为什么', '什么时候', '哪', '要不要', '有没有']

    ta_positive = sum(1 for m in ta_msgs for w in positive_words if w in m['content'])
    ta_questions = sum(1 for m in ta_msgs for w in question_words if w in m['content'])

    # 5. 未来话题
    future_words = ['下次', '以后', '改天', '下周', '明天', '明年', '我们', '一起', '陪你', '带你']
    ta_future = sum(1 for m in ta_msgs for w in future_words if w in m['content'])

    # 6. 回复连续性：ta 在你发消息后多久回复
    # 简化：计算 ta 消息紧跟我消息的比例
    quick_replies = 0
    for i, msg in enumerate(messages[:-1]):
        if msg.get('sender') == my_name:
            next_msg = messages[i + 1]
            if next_msg.get('sender') == target_name:
                gap = _time_gap_minutes(msg.get('time', ''), next_msg.get('time', ''))
                if gap is not None and gap < 5:
                    quick_replies += 1

    result = {
        "total_messages": total,
        "ta_message_count": ta_count,
        "my_message_count": my_count,
        "ta_message_ratio": round(ta_count / max(total, 1), 2),
        "conversation_starters": {
            "ta_initiated": conversation_starters['ta'],
            "me_initiated": conversation_starters['me'],
            "ta_initiative_ratio": round(
                conversation_starters['ta'] / max(conversation_starters['ta'] + conversation_starters['me'], 1), 2
            )
        },
        "message_length": {
            "ta_avg_length": round(ta_avg_len, 1),
            "my_avg_length": round(my_avg_len, 1),
            "ta_longer_than_me": ta_avg_len > my_avg_len
        },
        "night_messages": {
            "ta_night_count": ta_night,
            "my_night_count": my_night
        },
        "emotional_signals": {
            "ta_positive_word_count": ta_positive,
            "ta_question_count": ta_questions,
            "ta_future_topic_count": ta_future
        },
        "quick_replies_after_me": quick_replies,
        "sample_ta_messages": [m['content'][:100] for m in ta_msgs[-10:] if m.get('content')]
    }

    return result


def _time_gap_minutes(t1: str, t2: str) -> float | None:
    """计算两个时间字符串之间的分钟差，解析失败返回 None"""
    formats = ['%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M', '%H:%M:%S', '%H:%M']
    dt1 = dt2 = None
    for fmt in formats:
        try:
            dt1 = datetime.strptime(t1.strip(), fmt)
            break
        except Exception:
            pass
    for fmt in formats:
        try:
            dt2 = datetime.strptime(t2.strip(), fmt)
            break
        except Exception:
            pass
    if dt1 and dt2:
        diff = (dt2 - dt1).total_seconds() / 60
        return diff if diff >= 0 else None
    return None


def _is_night(time_str: str) -> bool:
    """判断是否是深夜（22:00-02:59）"""
    for pattern in [r'(\d{1,2}):\d{2}']:
        m = re.search(pattern, time_str)
        if m:
            hour = int(m.group(1))
            return hour >= 22 or hour < 3
    return False


def main():
    parser = argparse.ArgumentParser(description='微信聊天记录解析器')
    parser.add_argument('--file', required=True, help='聊天记录文件路径')
    parser.add_argument('--target', default=None, help='ta 的名字（可选，自动识别）')
    parser.add_argument('--output', default='/tmp/wechat_signals.txt', help='输出文件路径')
    parser.add_argument('--format', default='auto', choices=['auto', 'txt', 'csv', 'html'], help='文件格式')
    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"错误：文件不存在 {args.file}", file=sys.stderr)
        sys.exit(1)

    content = file_path.read_text(encoding='utf-8', errors='ignore')

    fmt = args.format
    if fmt == 'auto':
        suffix = file_path.suffix.lower()
        if suffix == '.csv':
            fmt = 'csv'
        elif suffix in ['.html', '.htm']:
            fmt = 'html'
        else:
            fmt = 'txt'

    if fmt == 'csv':
        messages = parse_csv_format(content)
    elif fmt == 'html':
        # 简单去除 HTML 标签
        clean = re.sub(r'<[^>]+>', '', content)
        messages = parse_txt_format(clean, args.target)
    else:
        messages = parse_txt_format(content, args.target)

    if not messages:
        print("警告：未能解析到消息，请检查文件格式", file=sys.stderr)
        result = {"error": "parse_failed", "raw_content_preview": content[:500]}
    else:
        my_name, ta_auto = identify_speakers(messages)
        target = args.target or ta_auto

        # 标记发言人
        for m in messages:
            m['is_target'] = (m.get('sender') == target)

        result = {
            "parse_success": True,
            "total_messages": len(messages),
            "detected_speakers": {"me": my_name, "ta": target},
            "signals": extract_signals(messages, my_name, target)
        }

    output_path = Path(args.output)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"解析完成，结果已保存到 {args.output}")
    print(f"共 {result.get('total_messages', 0)} 条消息")


if __name__ == '__main__':
    main()
