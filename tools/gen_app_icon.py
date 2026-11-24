# 生成小程序头像：墨绿底 + 暖纸色圆环 + 赤陶色缺口（"少一次"）
# 用法：python tools/gen_app_icon.py
# 设计要点：整体为圆形构图，微信裁成圆形头像时不会有任何内容被切掉
from PIL import Image, ImageDraw
import os

PINE = (0x23, 0x46, 0x3B)   # 墨绿底色
PAPER = (0xF6, 0xF4, 0xEE)  # 暖纸色环身
CLAY = (0xC0, 0x53, 0x3B)   # 赤陶色：中断的那一段

SIZE = 1024   # 输出基准尺寸（微信要求 >= 100x100）
SS = 4        # 超采样倍数，PIL 的 arc 不带抗锯齿，靠放大后缩放解决

# 以下数值均以 1024 画布为基准
R = 312        # 环中线半径
LINE = 90      # 线宽
OFFSET = 6     # 赤陶弧的轻微外移量，只为让断开处有一点错位感

# PIL 的角度约定：0° 在 3 点钟方向，顺时针为正
# 缺口放在正上方（270° 附近）而不是右侧：开口在右侧整体会被读成字母 C，
# 移到顶部后左右对称，语义变成"环在顶端裂开一道口，裂口处泛红"
RING_ARC = (318, 262)   # 暖纸环：从赤陶弧末端顺时针绕一整圈回到缺口右上
CLAY_ARC = (278, 318)   # 赤陶弧：缺口右侧，12 点半到 1 点半
# 262° → 278° 的 16° 空档就是缺口


def draw_ring(draw, cx, cy, radius, width, start, end, color):
    # bbox 半径 = 中线半径 + 半个线宽，线的外沿正好落在 bbox 上
    box = [
        cx - radius - width / 2,
        cy - radius - width / 2,
        cx + radius + width / 2,
        cy + radius + width / 2,
    ]
    draw.arc(box, start=start, end=end, fill=color, width=int(width))


def build():
    w = SIZE * SS
    img = Image.new('RGB', (w, w), PINE)
    draw = ImageDraw.Draw(img)
    cx = cy = w / 2

    draw_ring(draw, cx, cy, R * SS, LINE * SS, RING_ARC[0], RING_ARC[1], PAPER)
    draw_ring(draw, cx, cy, (R + OFFSET) * SS, LINE * SS, CLAY_ARC[0], CLAY_ARC[1], CLAY)

    return img.resize((SIZE, SIZE), Image.LANCZOS)


def circular(img, size):
    # 模拟微信把头像裁成圆形的效果
    base = img.resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    out = Image.new('RGB', (size, size), (255, 255, 255))
    out.paste(base, (0, 0), mask)
    return out


def contact_sheet(img):
    # 真实显示尺寸下的可辨识性检查：48 / 72 / 96 圆形头像并排
    sizes = [48, 72, 96, 144]
    pad = 24
    total_w = pad + sum(s + pad for s in sizes)
    max_h = max(sizes) + pad * 2
    sheet = Image.new('RGB', (total_w, max_h), (230, 228, 222))
    x = pad
    for s in sizes:
        sheet.paste(circular(img, s), (x, (max_h - s) // 2))
        x += s + pad
    return sheet


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'design', 'icon')
    os.makedirs(out, exist_ok=True)

    img = build()
    saved = []
    for s in (1024, 512, 256, 144):
        path = os.path.join(out, 'app-icon-%d.png' % s)
        img.resize((s, s), Image.LANCZOS).save(path)
        saved.append(path)

    preview = os.path.join(out, 'preview-circular.png')
    circular(img, 512).save(preview)
    saved.append(preview)

    sheet_path = os.path.join(out, 'preview-sizes.png')
    contact_sheet(img).save(sheet_path)
    saved.append(sheet_path)

    for p in saved:
        print('saved', os.path.relpath(p, root), os.path.getsize(p), 'bytes')


if __name__ == '__main__':
    main()
