"""生成 tabBar 图标 PNG，纯标准库实现，2x 超采样抗锯齿。
输出 81x81 RGBA PNG 到 miniprogram/images/。
"""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "miniprogram", "images")
S = 2  # 超采样倍数
OUT_SIZE = 81  # 输出尺寸（tabBar 标准）
SIZE = OUT_SIZE * S  # 采样画布

GRAY = (154, 160, 150, 255)   # --faint #9AA096 未选中
BLUE = (35, 70, 59, 255)      # --pine #23463B 选中
TRANSPARENT = (0, 0, 0, 0)


def in_rect(x, y, x1, y1, x2, y2):
    return x1 <= x <= x2 and y1 <= y <= y2


def home(x, y):
    u, v = x / S, y / S
    # 屋顶三角形
    if 10 <= v <= 42:
        half = (v - 10) * 0.75
        if abs(u - 40.5) <= half:
            return True
    # 房身
    if in_rect(u, v, 19, 38, 62, 71):
        # 门（镂空）
        if in_rect(u, v, 34, 53, 47, 71):
            return False
        return True
    return False


def stats(x, y):
    u, v = x / S, y / S
    if in_rect(u, v, 12, 70, 70, 74):
        return True
    if in_rect(u, v, 16, 46, 28, 70):
        return True
    if in_rect(u, v, 35, 27, 47, 70):
        return True
    if in_rect(u, v, 54, 38, 66, 70):
        return True
    return False


def habits(x, y):
    u, v = x / S, y / S
    # 左侧勾选框
    for cy in (24, 43, 62):
        if in_rect(u, v, 12, cy - 7, 25, cy + 6):
            # 空心框：内部 3px 镂空
            if in_rect(u, v, 15, cy - 4, 22, cy + 3):
                # 勾
                if (18 <= u <= 20 and cy + 1 <= v <= cy + 4) or \
                   (20 < u <= 23 and cy - 3 <= v <= cy):
                    return True
                return False
            return True
    # 右侧横线
    for cy in (24, 43, 62):
        if in_rect(u, v, 32, cy - 3, 70, cy + 3):
            return True
    return False


SHAPES = {"home": home, "stats": stats, "habits": habits}


def render(shape_fn, color):
    rows = []
    for y in range(OUT_SIZE):
        row = bytearray()
        for x in range(OUT_SIZE):
            # 4 个子像素采样，取覆盖率均值
            hits = sum(
                1
                for dx in range(S)
                for dy in range(S)
                if shape_fn(x * S + dx, y * S + dy)
            )
            cov = hits / (S * S)
            px = tuple(int(color[i] * cov + TRANSPARENT[i] * (1 - cov)) for i in range(4))
            row += bytes(px)
        rows.append(bytes(row))
    return rows


def png_chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path, rows, size):
    raw = b"".join(b"\x00" + row for row in rows)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    data = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(data)


os.makedirs(OUT, exist_ok=True)
for name, fn in SHAPES.items():
    for suffix, color in (("", GRAY), ("-active", BLUE)):
        path = os.path.join(OUT, f"{name}{suffix}.png")
        write_png(path, render(fn, color), OUT_SIZE)
        print("generated", os.path.basename(path))
