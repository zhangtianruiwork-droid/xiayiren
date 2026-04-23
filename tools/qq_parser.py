#!/usr/bin/env python3
"""
QQ 聊天记录解析器
支持格式：QQ 消息管理器导出的 txt 格式
输出：结构化信号摘要
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path


def parse_qq_txt(content: str, target_name: str = None) -> list:
    """
    解析 QQ 导出的 txt 格式
    典型格式：
    发送时间: 2024-01-01 12:00:00
    发送人: 张三(12345678)

    消息内容
    """
    messages = []
    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # QQ 格式1：时间行 + 发送人行 + 空行 + 内容
        time_match = re.match(r'发送时间[：:]\s*(.+)', line)
        if time_match:
            time_str = time_match.group(1).strip()
            i += 1
            sender_line = lines[i].strip() if i < len(lines) else ''
            sender_match = re.match(r'发送人[：:]\s*(.+)', sender_line)
            sender = ''
            if sender_match:
                sender = re.sub(r'\(\d+\)', '', sender_match.group(1)).strip()
            i += 1
            # 跳过空行
            while i < len(lines) and not lines[i].strip():
                i += 1
            # 收集消息内容（直到下一个时间行）
            content_lines = []
            while i < len(lines):
                check_line = lines[i].strip()
                if re.match(r'发送时间[：:]', check_line):
                    break
                content_lines.append(lines[i])
                i += 1
            msg_content = '\n'.join(content_lines).strip()
            if sender and msg_content:
                messages.append({'time': time_str, 'sender': sender, 'content': msg_content})
            continue

        # QQ 格式2：2024-01-01 12:00:00 张三
        # 或 2024-01-01 12:00:00  张三(123456)
        m2 = re.match(r'(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(.+?)(?:\(\d+\))?$', line)
        if m2:
            time_str = m2.group(1)
            sender = m2.group(2).strip()
            i += 1
            content_lines = []
            while i < len(lines):
                check_line = lines[i].strip()
                if re.match(r'\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}', check_line):
                    break
                if check_line:
                    content_lines.append(check_line)
                i += 1
            msg_content = '\n'.join(content_lines).strip()
            if sender and msg_content:
                messages.append({'time': time_str, 'sender': sender, 'content': msg_content})
            continue

        i += 1

    return messages


def extract_signals(messages: list, my_name: str, target_name: str) -> dict:
    """提取好感度信号"""
    ta_msgs = [m for m in messages if m.get('sender') == target_name]
    my_msgs = [m for m in messages if m.get('sender') == my_name]
    total = len(messages)

    # 主动发起话题（两条消息间隔 > 30 分钟视为新会话）
    starters = {'me': 0, 'ta': 0}
    prev_time_str = None
    for msg in messages:
        is_new = False
        if prev_time_str is None:
            is_new = True
        else:
            try:
                from datetime import datetime
                fmt = '%Y-%m-%d %H:%M:%S'
                t1 = datetime.strptime(prev_time_str[:19], fmt)
                t2 = datetime.strptime(msg['time'][:19], fmt)
                if (t2 - t1).total_seconds() > 1800:
                    is_new = True
            except Exception:
                pass
        if is_new:
            if msg.get('sender') == my_name:
                starters['me'] += 1
            elif msg.get('sender') == target_name:
                starters['ta'] += 1
        prev_time_str = msg.get('time', '')

    ta_avg_len = sum(len(m['content']) for m in ta_msgs) / max(len(ta_msgs), 1)
    my_avg_len = sum(len(m['content']) for m in my_msgs) / max(len(my_msgs), 1)

    # 情感词
    pos_words = ['喜欢', '想你', '好想', '开心', '哈哈', '爱', '棒', '可爱', '想见', '想着你']
    future_words = ['下次', '以后', '改天', '一起', '我们', '陪你']
    ta_pos = sum(1 for m in ta_msgs for w in pos_words if w in m['content'])
    ta_future = sum(1 for m in ta_msgs for w in future_words if w in m['content'])

    return {
        "total_messages": total,
        "ta_message_count": len(ta_msgs),
        "my_message_count": len(my_msgs),
        "ta_message_ratio": round(len(ta_msgs) / max(total, 1), 2),
        "conversation_starters": {
            "ta_initiated": starters['ta'],
            "me_initiated": starters['me'],
        },
        "message_length": {
            "ta_avg_length": round(ta_avg_len, 1),
            "my_avg_length": round(my_avg_len, 1),
        },
        "emotional_signals": {
            "ta_positive_word_count": ta_pos,
            "ta_future_topic_count": ta_future,
        },
        "sample_ta_messages": [m['content'][:100] for m in ta_msgs[-10:]]
    }


def main():
    parser = argparse.ArgumentParser(description='QQ 聊天记录解析器')
    parser.add_argument('--file', required=True, help='聊天记录文件路径')
    parser.add_argument('--target', default=None, help='ta 的名字')
    parser.add_argument('--output', default='/tmp/qq_signals.txt', help='输出文件路径')
    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"错误：文件不存在 {args.file}", file=sys.stderr)
        sys.exit(1)

    content = file_path.read_text(encoding='utf-8', errors='ignore')
    messages = parse_qq_txt(content, args.target)

    if not messages:
        result = {"error": "parse_failed", "raw_preview": content[:300]}
    else:
        counter = Counter(m['sender'] for m in messages)
        top2 = counter.most_common(2)
        my_name = top2[0][0] if top2 else None
        target = args.target or (top2[1][0] if len(top2) > 1 else None)

        result = {
            "parse_success": True,
            "total_messages": len(messages),
            "detected_speakers": {"me": my_name, "ta": target},
            "signals": extract_signals(messages, my_name, target)
        }

    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"解析完成，共 {result.get('total_messages', 0)} 条消息，结果保存到 {args.output}")


if __name__ == '__main__':
    main()
