#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
微信聊天记录一键导出工具
基于 WeChatMsg (github.com/LC044/WeChatMsg) 的核心解密逻辑
用法：python wechat_export.py [--contact "联系人名字"] [--output "输出路径"]

前提条件：
1. Windows 系统
2. 微信电脑版已登录（必须是运行状态）
3. 以管理员身份运行本脚本
4. 已安装依赖：pip install pycryptodomex pymem pywin32 psutil
"""

import argparse
import ctypes
import hashlib
import hmac
import os
import re
import sqlite3
import sys
import tempfile
import winreg
from datetime import datetime
from pathlib import Path

# ── 依赖检查 ────────────────────────────────────────────────────────────────

def check_dependencies():
    missing = []
    try:
        import pymem
    except ImportError:
        missing.append("pymem")
    try:
        from Cryptodome.Cipher import AES
    except ImportError:
        try:
            from Crypto.Cipher import AES
        except ImportError:
            missing.append("pycryptodomex")
    try:
        import psutil
    except ImportError:
        missing.append("psutil")
    try:
        from win32com.client import Dispatch
    except ImportError:
        missing.append("pywin32")

    if missing:
        print("❌ 缺少以下依赖，请先安装：")
        print(f"   pip install {' '.join(missing)}")
        print("\n推荐命令（使用清华镜像加速）：")
        print(f"   pip install {' '.join(missing)} -i https://pypi.tuna.tsinghua.edu.cn/simple")
        sys.exit(1)

check_dependencies()

import pymem
import pymem.pattern
import psutil
from Cryptodome.Cipher import AES

# ── 常量 ────────────────────────────────────────────────────────────────────

KEY_SIZE = 32
DEFAULT_PAGESIZE = 4096
DEFAULT_ITER = 64000
SQLITE_FILE_HEADER = b"SQLite format 3\x00"
ReadProcessMemory = ctypes.windll.kernel32.ReadProcessMemory
void_p = ctypes.c_void_p

MSG_TYPES = {
    1: "文本",
    3: "图片",
    34: "语音",
    43: "视频",
    47: "表情包",
    49: "链接/文件",
    10000: "系统消息",
    10002: "撤回消息",
}

# ── 获取微信信息 ──────────────────────────────────────────────────────────────

def get_wechat_process():
    """获取正在运行的微信进程（兼容 3.x WeChat.exe 和 4.x Weixin.exe）"""
    # 优先检测 4.x（Weixin.exe），再检测 3.x（WeChat.exe）
    found = {}
    for proc in psutil.process_iter(['name', 'exe', 'pid']):
        name = proc.name()
        if name in ('WeChat.exe', 'Weixin.exe'):
            found[name] = proc
    return found.get('Weixin.exe') or found.get('WeChat.exe') or None


def is_wechat_v4(proc) -> bool:
    """判断是否为微信 4.x（Weixin.exe）"""
    return proc.name() == 'Weixin.exe'


def get_exe_bit(file_path):
    """获取 PE 文件位数（32/64）"""
    try:
        with open(file_path, 'rb') as f:
            if f.read(2) != b'MZ':
                return 64
            f.seek(60)
            pe_offset = int.from_bytes(f.read(4), 'little')
            f.seek(pe_offset + 4)
            machine = int.from_bytes(f.read(2), 'little')
            return 32 if machine == 0x14c else 64
    except Exception:
        return 64


def get_info_wxid(h_process):
    """从进程内存中读取 wxid（兼容 3.x MSG 和 4.x Msg 路径大小写）"""
    try:
        pm = pymem.Pymem.__new__(pymem.Pymem)
        pm.process_handle = h_process
        pm.process_id = ctypes.windll.kernel32.GetProcessId(h_process)

        find_num = 100
        addrs = []
        next_region = 0
        user_space_limit = 0x7FFFFFFF0000
        # 4.x 使用 \Msg\，3.x 使用 \MSG\，两个都扫
        patterns = [br'\\Msg\\FTSContact', br'\\MSG\\FTSContact']
        for pattern in patterns:
            next_region = 0
            while next_region < user_space_limit and len(addrs) < find_num:
                try:
                    next_region, found = pymem.pattern.scan_pattern_page(
                        h_process, next_region, pattern, return_multiple=True)
                    if found:
                        addrs += found
                except Exception:
                    break
            if addrs:
                break  # 找到就不再尝试另一个模式

        wxids = []
        for addr in addrs:
            array = ctypes.create_string_buffer(80)
            if ReadProcessMemory(h_process, void_p(addr - 30), array, 80, 0) == 0:
                continue
            raw_bytes = bytes(array)
            # 4.x 用 \Msg，3.x 用 \MSG
            for sep in [b"\\Msg", b"\\MSG"]:
                parts = raw_bytes.split(sep)
                if len(parts) > 1:
                    raw = parts[0].split(b"\\")[-1]
                    break
            else:
                raw = b""
            wxids.append(raw.decode('utf-8', errors='ignore'))
        return max(wxids, key=wxids.count) if wxids else None
    except Exception as e:
        return None


def get_wechat_file_path(wxid=None):
    """获取微信文件存储路径（兼容 3.x 和 4.x 注册表路径）"""
    w_dir = None

    # 方法1a：4.x 注册表路径 HKCU\Software\Tencent\Weixin → OldFileSavePath
    if not w_dir:
        for reg_path, reg_key in [
            (r"Software\Tencent\Weixin", "OldFileSavePath"),
            (r"Software\Tencent\Weixin", "FileSavePath"),
        ]:
            try:
                key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, reg_path, 0, winreg.KEY_READ)
                val, _ = winreg.QueryValueEx(key, reg_key)
                winreg.CloseKey(key)
                if val and val != "MyDocument:":
                    w_dir = val
                    break
            except Exception:
                pass

    # 方法1b：3.x 注册表路径 HKCU\Software\Tencent\WeChat → FileSavePath
    if not w_dir:
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Tencent\WeChat", 0, winreg.KEY_READ)
            val, _ = winreg.QueryValueEx(key, "FileSavePath")
            winreg.CloseKey(key)
            if val and val != "MyDocument:":
                w_dir = val
        except Exception:
            pass

    # 方法2：配置文件（3.x）
    if not w_dir or w_dir == "MyDocument:":
        try:
            ini = Path(os.environ.get("USERPROFILE", "")) / "AppData" / "Roaming" / "Tencent" / "WeChat" / "All Users" / "config" / "3ebffe94.ini"
            w_dir = ini.read_text(encoding='utf-8').strip()
        except Exception:
            pass

    # 方法3：默认文档目录
    if not w_dir or w_dir == "MyDocument:":
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                                 r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders")
            docs = winreg.QueryValueEx(key, "Personal")[0]
            winreg.CloseKey(key)
            w_dir = os.path.expandvars(docs) if '%' in docs else docs
        except Exception:
            w_dir = str(Path.home() / "Documents")

    msg_dir = Path(w_dir) / "WeChat Files"
    if not msg_dir.exists():
        # 常见备选路径
        for fallback in [
            Path.home() / "Documents" / "WeChat Files",
            Path("C:/Users") / os.environ.get("USERNAME", "") / "Documents" / "WeChat Files",
        ]:
            if fallback.exists():
                msg_dir = fallback
                break

    if wxid:
        return msg_dir / wxid
    return msg_dir


def get_wechat_key(db_path, handle, addr_len, proc_name="WeChat.exe"):
    """从微信进程内存中提取加密密钥（兼容 3.x 和 4.x）"""
    try:
        pm = pymem.Pymem(proc_name)
        module_name = "Weixin.dll" if proc_name == "Weixin.exe" else "WeChatWin.dll"

        micro_candidates = [
            Path(db_path) / "Msg" / "MicroMsg.db",
            Path(db_path) / "MSG" / "MicroMsg.db",
        ]
        micromsg_path = next((str(p) for p in micro_candidates if p.exists()), str(micro_candidates[0]))

        def read_ptr_key(address):
            """读指针→跳转→32字节（3.x 方式）"""
            array = ctypes.create_string_buffer(addr_len)
            if ReadProcessMemory(handle, void_p(address), array, addr_len, 0) == 0:
                return None
            ptr = int.from_bytes(array, 'little')
            key = ctypes.create_string_buffer(32)
            if ReadProcessMemory(handle, void_p(ptr), key, 32, 0) == 0:
                return None
            return bytes(key)

        def read_direct(address, size=32):
            """直接读取地址处的字节"""
            buf = ctypes.create_string_buffer(size)
            if ReadProcessMemory(handle, void_p(address), buf, size, 0) == 0:
                return None
            return bytes(buf)

        def is_plausible_key(data):
            if not data or len(data) < 32:
                return False
            return data.count(0) <= 8 and len(set(data)) >= 16

        def verify_key(key_bytes):
            if not os.path.exists(micromsg_path):
                return True
            try:
                with open(micromsg_path, 'rb') as f:
                    blist = f.read(5000)
                salt = blist[:16]
                byte_key = hashlib.pbkdf2_hmac("sha1", key_bytes, salt, DEFAULT_ITER, KEY_SIZE)
                first = blist[16:DEFAULT_PAGESIZE]
                mac_salt = bytes([salt[i] ^ 58 for i in range(16)])
                mac_key = hashlib.pbkdf2_hmac("sha1", byte_key, mac_salt, 2, KEY_SIZE)
                h = hmac.new(mac_key, first[:-32], hashlib.sha1)
                h.update(b'\x01\x00\x00\x00')
                return h.digest() == first[-32:-12]
            except Exception:
                return False

        # ── 方法1：手机类型字符串定位（3.x 常用）──────────────────────────
        phone_patterns = [
            b"iphone\x00", b"android\x00", b"ipad\x00",
            b"iPhone\x00", b"Android\x00", b"iPad\x00",
        ]
        for phone_type in phone_patterns:
            type_addrs = pm.pattern_scan_module(phone_type, module_name, return_multiple=True)
            if len(type_addrs) < 2:
                continue
            for i in type_addrs[::-1]:
                for j in range(i, i - 15000, -addr_len):
                    key_bytes = read_ptr_key(j)
                    if is_plausible_key(key_bytes) and verify_key(key_bytes):
                        return key_bytes.hex()

        # ── 方法2：pywxdump（4.x 最可靠）─────────────────────────────────
        print("  方法1未找到，尝试 pywxdump...")
        try:
            from pywxdump import get_wx_info
            wx_list = get_wx_info()
            if wx_list:
                for info in (wx_list if isinstance(wx_list, list) else [wx_list]):
                    key = info.get('key') or info.get('Key') or ''
                    if key and len(key) == 64:
                        print("  pywxdump 提取成功")
                        return key.lower()
        except ImportError:
            print("  pywxdump 未安装，请运行：")
            print("  pip install pywxdump -i https://pypi.tuna.tsinghua.edu.cn/simple")
        except Exception as e2:
            print(f"  pywxdump 调用失败: {e2}")

    except Exception as e:
        print(f"  读取密钥失败: {e}")
    return None


# ── 解密数据库 ──────────────────────────────────────────────────────────────

def decrypt_db(key_hex: str, db_path: str, out_path: str) -> bool:
    """解密单个微信数据库文件"""
    try:
        if not os.path.exists(db_path):
            return False
        password = bytes.fromhex(key_hex)
        with open(db_path, 'rb') as f:
            data = f.read()
        salt = data[:16]
        byte_key = hashlib.pbkdf2_hmac("sha1", password, salt, DEFAULT_ITER, KEY_SIZE)
        first = data[16:DEFAULT_PAGESIZE]
        mac_salt = bytes([salt[i] ^ 58 for i in range(16)])
        mac_key = hashlib.pbkdf2_hmac("sha1", byte_key, mac_salt, 2, KEY_SIZE)
        h = hmac.new(mac_key, first[:-32], hashlib.sha1)
        h.update(b'\x01\x00\x00\x00')
        if h.digest() != first[-32:-12]:
            return False

        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, 'wb') as out:
            out.write(SQLITE_FILE_HEADER)
            t = AES.new(byte_key, AES.MODE_CBC, first[-48:-32])
            out.write(t.decrypt(first[:-48]))
            out.write(first[-48:])
            for i in range(DEFAULT_PAGESIZE, len(data), DEFAULT_PAGESIZE):
                page = data[i:i + DEFAULT_PAGESIZE]
                t = AES.new(byte_key, AES.MODE_CBC, page[-48:-32])
                out.write(t.decrypt(page[:-48]))
                out.write(page[-48:])
        return True
    except Exception as e:
        print(f"  解密失败: {e}")
        return False


# ── 查询联系人 ──────────────────────────────────────────────────────────────

def get_contacts(micromsg_db: str, msg_db: str) -> list:
    """获取有聊天记录的联系人列表"""
    contacts = {}

    # 从 MicroMsg.db 读取联系人信息
    try:
        conn = sqlite3.connect(micromsg_db)
        c = conn.cursor()
        c.execute("""
            SELECT UserName, Remark, NickName
            FROM Contact
            WHERE Type % 2 = 1
              AND NickName != ''
              AND UserName NOT LIKE '%chatroom%'
              AND UserName NOT LIKE 'gh_%'
        """)
        for row in c.fetchall():
            username, remark, nickname = row
            display = remark if remark else nickname
            contacts[username] = {'display': display, 'username': username, 'count': 0}
        conn.close()
    except Exception as e:
        print(f"  读取联系人失败: {e}")

    # 从 MSG.db 统计消息数量
    try:
        conn = sqlite3.connect(msg_db)
        c = conn.cursor()
        c.execute("""
            SELECT StrTalker, COUNT(*) as cnt
            FROM MSG
            WHERE StrTalker NOT LIKE '%chatroom%'
            GROUP BY StrTalker
            ORDER BY cnt DESC
            LIMIT 200
        """)
        for username, count in c.fetchall():
            if username in contacts:
                contacts[username]['count'] = count
            else:
                # MSG 里有但 Contact 里没有的（可能是已删除联系人）
                contacts[username] = {
                    'display': f"[已删除联系人] {username[:20]}",
                    'username': username,
                    'count': count
                }
        conn.close()
    except Exception as e:
        print(f"  读取消息计数失败: {e}")

    # 按消息数量排序，过滤无消息的
    result = [v for v in contacts.values() if v['count'] > 0]
    result.sort(key=lambda x: x['count'], reverse=True)
    return result


# ── 导出消息 ──────────────────────────────────────────────────────────────────

def export_messages(msg_db: str, username: str, display_name: str, my_name: str, output_path: str) -> int:
    """将指定联系人的聊天记录导出为 TXT"""
    try:
        conn = sqlite3.connect(msg_db)
        c = conn.cursor()
        c.execute("""
            SELECT IsSender,
                   strftime('%Y-%m-%d %H:%M:%S', CreateTime, 'unixepoch', 'localtime') AS StrTime,
                   Type,
                   StrContent
            FROM MSG
            WHERE StrTalker = ?
            ORDER BY CreateTime
        """, [username])
        rows = c.fetchall()
        conn.close()
    except Exception as e:
        print(f"  读取消息失败: {e}")
        return 0

    lines = []
    lines.append(f"# 与 {display_name} 的聊天记录")
    lines.append(f"# 导出时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"# 共 {len(rows)} 条消息")
    lines.append("=" * 60)
    lines.append("")

    count = 0
    for is_sender, str_time, msg_type, content in rows:
        sender = my_name if is_sender else display_name
        content = (content or "").strip()

        # 处理不同消息类型
        if msg_type == 1:  # 文本
            pass
        elif msg_type == 3:
            content = "[图片]"
        elif msg_type == 34:
            content = "[语音]"
        elif msg_type == 43:
            content = "[视频]"
        elif msg_type == 47:
            content = "[表情包]"
        elif msg_type == 49:
            # 尝试提取链接/文件标题
            title_match = re.search(r'<title>(.*?)</title>', content or '')
            if title_match:
                content = f"[链接] {title_match.group(1)}"
            else:
                content = "[文件/链接]"
        elif msg_type == 10000:
            content = f"[系统] {content}"
        elif msg_type == 10002:
            content = "[撤回了一条消息]"
        elif not content:
            content = f"[{MSG_TYPES.get(msg_type, f'消息类型{msg_type}')}]"

        if content:
            lines.append(f"{str_time}  {sender}：{content}")
            count += 1

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_text('\n'.join(lines), encoding='utf-8')
    return count


# ── 主流程 ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='微信聊天记录一键导出工具')
    parser.add_argument('--contact', '-c', help='联系人名字（模糊匹配）', default=None)
    parser.add_argument('--output', '-o', help='输出 TXT 文件路径', default=None)
    parser.add_argument('--list', '-l', action='store_true', help='仅列出所有联系人')
    args = parser.parse_args()

    print("=" * 55)
    print("  微信聊天记录导出工具  (ta喜不喜欢我？配套工具)")
    print("=" * 55)
    print()

    # Step 1: 检查微信进程
    print("[ 1/4 ] 检查微信运行状态...")
    proc = get_wechat_process()
    if not proc:
        print("❌ 未检测到微信进程，请先登录微信电脑版")
        print("   支持：WeChat.exe（3.x）和 Weixin.exe（4.x）")
        sys.exit(1)
    v4 = is_wechat_v4(proc)
    ver_str = "4.x (Weixin.exe)" if v4 else "3.x (WeChat.exe)"
    print(f"  ✓ 微信正在运行 (PID: {proc.pid}, 版本: {ver_str})")

    # 打开进程句柄
    handle = ctypes.windll.kernel32.OpenProcess(0x1F0FFF, False, proc.pid)
    if not handle:
        print("❌ 无法获取进程权限，请以管理员身份运行本脚本")
        print("   右键脚本 → 以管理员身份运行，或在管理员 CMD 中执行")
        sys.exit(1)

    addr_len = get_exe_bit(proc.exe()) // 8
    print(f"  ✓ 微信版本：{addr_len * 8}位")

    # Step 2: 获取 wxid 和文件路径
    print("\n[ 2/4 ] 获取微信数据路径...")

    # 先尝试从文件系统找 wxid 目录（4.x 内存扫描可能失败，文件系统更可靠）
    base = get_wechat_file_path()
    file_path = None
    wxid = None

    if base.exists():
        # 优先找含聊天数据库的目录
        db_dirs = []
        for d in base.iterdir():
            if not d.is_dir():
                continue
            has_db = (d / "Msg" / "ChatMsg.db").exists() or (d / "MSG" / "MSG.db").exists()
            if has_db:
                db_dirs.append(d)
        if not db_dirs:
            # 没找到数据库，退而求其次找 wxid_ 开头的目录
            db_dirs = [d for d in base.iterdir() if d.is_dir() and d.name.lower().startswith('wxid_')]
        if not db_dirs:
            db_dirs = [d for d in base.iterdir() if d.is_dir() and d.name not in ('All Users', 'Applet')]

        if len(db_dirs) == 1:
            file_path = db_dirs[0]
            wxid = file_path.name
            print(f"  ✓ 自动识别账号目录: {wxid}")
        elif len(db_dirs) > 1:
            print(f"  检测到多个账号目录，请选择：")
            for i, d in enumerate(db_dirs):
                print(f"    {i+1}. {d.name}")
            choice = input("  请输入编号：").strip()
            file_path = db_dirs[int(choice) - 1]
            wxid = file_path.name
            print(f"  ✓ 已选择: {wxid}")

    # 文件系统找不到时，再尝试内存扫描
    if not file_path:
        wxid = get_info_wxid(handle)
        if wxid:
            file_path = get_wechat_file_path(wxid)
            print(f"  ✓ wxid (内存): {wxid}")

    if not file_path or not file_path.exists():
        print(f"❌ 找不到微信数据目录，已查找：{base}")
        print("   请确认微信文件保存路径，并已将手机聊天记录迁移到电脑")
        sys.exit(1)

    print(f"  ✓ 数据目录: {file_path}")

    # 4.x: Msg/ChatMsg.db；3.x: MSG/MSG.db
    msg_db_candidates = [
        file_path / "Msg" / "ChatMsg.db",   # 4.x
        file_path / "MSG" / "MSG.db",        # 3.x
    ]
    micro_db_candidates = [
        file_path / "Msg" / "MicroMsg.db",  # 4.x
        file_path / "MSG" / "MicroMsg.db",  # 3.x
    ]
    msg_db_path = next((p for p in msg_db_candidates if p.exists()), None)
    micro_db_path = next((p for p in micro_db_candidates if p.exists()), None)

    if not msg_db_path:
        print(f"❌ 找不到聊天数据库，已查找：")
        for p in msg_db_candidates:
            print(f"   {p}")
        print("   请确认已将手机聊天记录迁移到电脑（微信→设置→聊天→聊天记录迁移）")
        sys.exit(1)
    print(f"  ✓ 聊天数据库: {msg_db_path}")

    # Step 3: 获取密钥并解密
    print("\n[ 3/4 ] 解密微信数据库...")
    key = get_wechat_key(str(file_path), handle, addr_len, proc.name())
    if not key:
        print("❌ 密钥获取失败，可能原因：")
        print("   - 微信版本暂不支持（可在 WeChatMsg 项目查看支持版本）")
        print("   - 未以管理员身份运行")
        sys.exit(1)
    print(f"  ✓ 密钥获取成功")

    # 解密到临时目录
    tmp_dir = Path(tempfile.mkdtemp(prefix="wechat_export_"))
    dec_msg = str(tmp_dir / "MSG.db")
    dec_micro = str(tmp_dir / "MicroMsg.db")

    ok1 = decrypt_db(key, str(msg_db_path), dec_msg)
    ok2 = decrypt_db(key, str(micro_db_path), dec_micro) if micro_db_path and micro_db_path.exists() else False

    if not ok1:
        print("❌ 数据库解密失败，密钥可能不正确")
        sys.exit(1)
    print(f"  ✓ 解密成功")

    # Step 4: 获取联系人列表
    print("\n[ 4/4 ] 读取联系人...")
    contacts = get_contacts(dec_micro if ok2 else dec_msg, dec_msg)

    if not contacts:
        print("❌ 未找到任何联系人聊天记录")
        sys.exit(1)

    print(f"  ✓ 找到 {len(contacts)} 个有聊天记录的联系人\n")

    # 仅列表模式
    if args.list:
        print("联系人列表（按消息数量排序）：")
        for i, c in enumerate(contacts[:50]):
            print(f"  {i+1:>3}. {c['display']:<20}  ({c['count']} 条消息)")
        return

    # 根据参数筛选联系人
    if args.contact:
        matched = [c for c in contacts if args.contact.lower() in c['display'].lower()]
        if not matched:
            print(f"❌ 未找到联系人：{args.contact}")
            print("使用 --list 查看所有联系人")
            sys.exit(1)
        if len(matched) > 1:
            print(f"找到 {len(matched)} 个匹配的联系人：")
            for i, c in enumerate(matched):
                print(f"  {i+1}. {c['display']} ({c['count']}条消息)")
            choice = input("请输入编号：").strip()
            contact = matched[int(choice) - 1]
        else:
            contact = matched[0]
    else:
        # 交互式选择
        print("有聊天记录的联系人（按消息数量排序）：")
        print("-" * 50)
        show_count = min(len(contacts), 30)
        for i, c in enumerate(contacts[:show_count]):
            print(f"  {i+1:>3}. {c['display']:<20}  {c['count']:>5} 条消息")
        if len(contacts) > show_count:
            print(f"  ... 还有 {len(contacts) - show_count} 个联系人（使用 --contact 搜索）")
        print("-" * 50)
        print()

        while True:
            choice = input("请输入编号（或输入名字搜索）：").strip()
            if not choice:
                continue
            if choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < show_count:
                    contact = contacts[idx]
                    break
                else:
                    print(f"  请输入 1-{show_count} 之间的数字")
            else:
                matched = [c for c in contacts if choice.lower() in c['display'].lower()]
                if matched:
                    contact = matched[0]
                    print(f"  已选择：{contact['display']}")
                    break
                else:
                    print(f"  未找到 {choice}，请重新输入")

    # 确定输出路径
    safe_name = re.sub(r'[\\/:*?"<>|]', '_', contact['display'])
    if args.output:
        output_path = args.output
    else:
        desktop = Path.home() / "Desktop"
        output_path = str(desktop / f"微信聊天记录_{safe_name}.txt")

    # 读取"我"的名字
    my_name = "我"
    try:
        conn = sqlite3.connect(dec_micro if ok2 else dec_msg)
        c = conn.cursor()
        c.execute("SELECT value FROM Setting WHERE key='MyNickName'")
        row = c.fetchone()
        if row:
            my_name = row[0] or "我"
        conn.close()
    except Exception:
        pass

    # 导出
    print(f"\n正在导出与「{contact['display']}」的聊天记录...")
    count = export_messages(dec_msg, contact['username'], contact['display'], my_name, output_path)

    if count > 0:
        print(f"\n✅ 导出成功！")
        print(f"   共 {count} 条消息")
        print(f"   文件路径：{output_path}")
        print(f"\n   把这个文件上传到「ta喜不喜欢我？」页面即可开始分析 💕")
    else:
        print("❌ 导出失败，消息为空")

    # 清理临时文件
    try:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)
    except Exception:
        pass


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n已取消")
    except Exception as e:
        import traceback
        print(f"\n❌ 发生错误：{e}")
        print("详细信息：")
        traceback.print_exc()
        print("\n如果问题持续，请尝试：")
        print("  1. 以管理员身份运行")
        print("  2. 确认微信已登录且正在运行")
        print("  3. 确认已将手机聊天记录迁移到电脑")
