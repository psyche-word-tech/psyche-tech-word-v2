#!/usr/bin/env bash
# 一键重建本地 PaddleOCR 词级框环境（沙箱清空 .venv 后运行）
# 用法: bash /workspace/projects/server/ocr-service/setup_local_ocr.sh
set -uo pipefail

ROOT=/workspace/projects/server/ocr-service
VENV=$ROOT/.venv
PY=$VENV/bin/python
MIRROR_ALI=https://mirrors.aliyun.com/pypi/simple/
PYPI=https://pypi.org/simple
PADDLE_CDN=https://www.paddlepaddle.org.cn/packages/stable/cpu/

command -v python3 >/dev/null || { echo "缺 python3"; exit 1; }

# venv 建不了则补 ensurepip / python3-venv
python3 -m venv --help >/dev/null 2>&1 || { python3 -m ensurepip --default-pip >/dev/null 2>&1 || { apt-get install -y python3.12-venv >/dev/null 2>&1 || echo "需安装 python3-venv"; }; }

rm -rf "$VENV"
python3 -m venv "$VENV" || exit 1
"$PY" -m pip install -q --upgrade pip -i "$PYPI"
"$PY" -m pip install -q setuptools -i "$PYPI"

echo "[1/5] paddlepaddle (CDN)"
"$PY" -m pip install -q paddlepaddle==2.6.2 -i "$PADDLE_CDN" || exit 1

echo "[2/5] paddleocr 核心依赖 (阿里)"
"$PY" -m pip install -q --no-deps \
  paddleocr==2.9.1 "numpy<2" "opencv-python-headless==4.10.0.84" "PyYAML>=6" \
  "shapely>=1.8" "pyclipper>=1.3" tqdm fire networkx "Pillow>=9" "scipy==1.11.4" requests \
  -i "$MIRROR_ALI" || exit 1

echo "[3/5] 补充依赖"
"$PY" -m pip install -q urllib3 scikit-image six lmdb python-docx rapidfuzz \
  beautifulsoup4 lxml defusedxml -i "$MIRROR_ALI" 2>/dev/null
"$PY" -m pip install -q "albumentations==1.4.10" "albucore==0.0.13" -i "$MIRROR_ALI" 2>/dev/null

echo "[4/5] 钉版本 (numpy/scipy/albucore, 避免 np.long/np.sctypes 爆炸)"
"$PY" -m pip install -q --force-reinstall --no-deps "numpy==1.26.4" -i "$MIRROR_ALI" || true
"$PY" -m pip install -q --force-reinstall --no-deps "scipy==1.11.4" -i "$MIRROR_ALI" || true
"$PY" -m pip install -q --force-reinstall --no-deps "albucore==0.0.13" -i "$MIRROR_ALI" || true

echo "[5/5] patch imgaug 导入 (OCR 推理不需要 imgaug 增强)"
F="$VENV/lib/python3.12/site-packages/paddleocr/ppocr/data/imaug/__init__.py"
if [ -f "$F" ]; then
  cp "$F" "$F.bak" 2>/dev/null || true
  "$PY" - "$F" <<'PY'
import sys, re
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
pat = re.compile(r'(from \.iaa_augment import IaaAugment)')
if pat.search(s):
    s = pat.sub(r'try:\n    \1\nexcept Exception:\n    IaaAugment = None', s)
    open(p, 'w', encoding='utf-8').write(s)
    print('patched imaug: iaa_augment optional')
else:
    print('imaug: no iaa_augment hit, skip')
PY
fi

echo "=== 验证 ==="
"$PY" -c "import paddle, paddleocr, numpy, scipy, cv2; print('local OCR env OK:', 'paddle', paddle.__version__, '| paddleocr', paddleocr.__version__, '| numpy', numpy.__version__, '| scipy', scipy.__version__)" \
  || { echo "import 失败，见上"; exit 1; }

echo "本地 OCR 环境就绪。首次运行会再次下载 det/rec 模型到 ~/.paddleocr。"