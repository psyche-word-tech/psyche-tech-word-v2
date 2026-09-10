import sys, json, time
import numpy as np
import cv2
from paddleocr import PaddleOCR

def to_gray_mask(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return (th > 0)

def split_into_blocks(colproj, thickness, min_gap):
    n = len(colproj)
    blocks = []
    i = 0
    while i < n:
        if colproj[i] < thickness:
            i += 1
            continue
        s = i
        j = s
        while j < n:
            if colproj[j] >= thickness:
                j += 1
                continue
            blank = 0
            k = j
            while k < n and colproj[k] < thickness:
                blank += 1
                k += 1
            if blank >= min_gap:
                break
            j = k
        blocks.append((s, j))
        i = j + 1
    return blocks

def merge_blocks(blocks, min_gap):
    if not blocks:
        return blocks
    merged = [blocks[0]]
    for b in blocks[1:]:
        if b[0] - merged[-1][1] < min_gap:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b[1]))
        else:
            merged.append(b)
    return merged

def fold_tokens_to_blocks(blocks, tokens, band_w):
    """把 tokens 依序折叠到真实 gap 块上。框坐标永远锚定 gap 边界，tokens 仅用于标注文本。
    - 块数与 token 数一致：一一对应
    - 块数 < token 数：相邻 token 合并进块（块内多词），尽量均匀
    - 块数 > token 数：部分块无 token(空串)"""
    res = []
    if not tokens:
        for (s, e) in blocks:
            res.append((s, e, ''))
        return res
    nb, nt = len(blocks), len(tokens)
    if nb == nt:
        for (s, e), t in zip(blocks, tokens):
            res.append((s, e, t))
        return res
    if nb < nt:
        # 决定每块 token 数：优先宽块多放
        widths = [(b[1] - b[0], i) for i, b in enumerate(blocks)]
        alloc = [1] * nb
        for _ in range(nt - nb):
            idx = max(range(nb), key=lambda i: (blocks[i][1] - blocks[i][0]) / (alloc[i] + 0.5))
            alloc[idx] += 1
        ti = 0
        for i, (s, e) in enumerate(blocks):
            group = tokens[ti:ti + alloc[i]]
            ti += alloc[i]
            res.append((s, e, ' '.join(group)))
        return res
    else:
        # 块数多于 token 数：多余块给空串（保留坐标供定位）
        for i, (s, e) in enumerate(blocks):
            t = tokens[i] if i < len(tokens) else ''
            res.append((s, e, t))
        return res

def main():
    img_path = sys.argv[1] if len(sys.argv) > 1 else ''
    if not img_path:
        print(json.dumps({'ok': False, 'error': 'no image path'}), flush=True)
        return
    t0 = time.time()
    ocr = PaddleOCR(lang='en', use_angle_cls=False, show_log=False)
    t_init = time.time() - t0
    t0 = time.time()
    res = ocr.ocr(img_path, cls=False, det=True, rec=True)
    t_ocr = time.time() - t0

    img = cv2.imread(img_path)
    if img is None:
        print(json.dumps({'ok': False, 'error': 'imread fail'}), flush=True)
        return
    mask = to_gray_mask(img)
    H, W = mask.shape

    out = []
    for page in res:
        for line in page or []:
            box = line[0]
            text, score = line[1][0], line[1][-1]
            xs = [p[0] for p in box]; ys = [p[1] for p in box]
            bx1, by1, bx2, by2 = int(min(xs)), int(min(ys)), int(max(xs)) + 1, int(max(ys)) + 1
            bx1, by1 = max(0, bx1), max(0, by1)
            bx2, by2 = min(W, bx2), min(H, by2)
            if bx2 <= bx1 or by2 <= by1:
                continue
            rawband = mask[by1:by2, bx1:bx2].copy()
            bh = rawband.shape[0]
            # 轻微横向腐蚀：切断字母间抗锯齿浅色残留导致的间隙粘连（仅用于分块）
            band = cv2.erode(rawband.astype(np.uint8), np.ones((1, 3), np.uint8)) > 0
            colproj = band.sum(axis=0)
            thickness = max(2, round(bh * 0.05))
            min_gap = max(4, round(bh * 0.28))
            blocks = split_into_blocks(colproj, thickness, min_gap)
            blocks = merge_blocks(blocks, max(4, round(bh * 0.18)))
            if not blocks:
                blocks = [(0, band.shape[1])]
            tokens = [t for t in text.split() if t]
            assigned = fold_tokens_to_blocks(blocks, tokens, band.shape[1])
            for (s, e, wtext) in assigned:
                sub = rawband[:, s:e]
                rows = np.where(sub.any(axis=1))[0]
                if len(rows) == 0:
                    continue
                y1, y2 = int(rows[0]), int(rows[-1]) + 1
                sub2 = rawband[y1:y2, s:e]
                cos = np.where(sub2.any(axis=0))[0]
                if len(cos) == 0:
                    continue
                x1, x2 = int(cos[0]), int(cos[-1]) + 1
                x_lo, x_hi = bx1 + s + x1, bx1 + s + x2
                y_lo, y_hi = by1 + y1, by1 + y2
                out.append({
                    'text': wtext, 'score': round(float(score), 3),
                    'x': int(x_lo), 'y': int(y_lo),
                    'width': int(x_hi - x_lo), 'height': int(y_hi - y_lo),
                    'bbox': [[int(x_lo), int(y_lo)], [int(x_hi), int(y_lo)], [int(x_hi), int(y_hi)], [int(x_lo), int(y_hi)]],
                })

    print(json.dumps({'ok': True, 'init': round(t_init, 1), 'ocr': round(t_ocr, 1),
                      'count': len(out), 'W': W, 'H': H}, ensure_ascii=False), flush=True)
    for o in out:
        print(json.dumps(o, ensure_ascii=False), flush=True)

main()