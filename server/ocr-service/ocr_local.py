import sys, json, time
from paddleocr import PaddleOCR

def main():
    img = sys.argv[1] if len(sys.argv) > 1 else ''
    if not img:
        print(json.dumps({'ok': False, 'error': 'no image path'}), flush=True)
        return
    t0 = time.time()
    ocr = PaddleOCR(lang='en', use_angle_cls=True, show_log=False)
    t_init = time.time() - t0
    t0 = time.time()
    res = ocr.ocr(img, cls=True)
    t_ocr = time.time() - t0
    out = []
    for page in res:
        for line in page or []:
            box, rec = line if len(line) == 2 else (line[0], line[1])
            text, score = rec[0], rec[-1]
            out.append({
                'text': text,
                'score': round(float(score), 3),
                'box': [[round(x[0]) if isinstance(x[0], (int, float)) else round(x[0]), round(x[1]) if isinstance(x[1], (int, float)) else round(x[1])] for x in box],
            })
    print(json.dumps({'ok': True, 'init': round(t_init, 1), 'ocr': round(t_ocr, 1), 'count': len(out)}, ensure_ascii=False), flush=True)
    for o in out:
        print(json.dumps(o, ensure_ascii=False), flush=True)

main()