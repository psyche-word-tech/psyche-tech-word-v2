from PIL import Image
import os

assets_dir = "/workspace/projects/client/assets"

files = [
    ("rock.jpg", 800, 60, ".jpg"),
    ("iconRock.png", 400, 80, ".png"),
    ("region4.png", 600, 80, ".png"),
    ("butterfly_logo.png", 200, 85, ".png"),
]

for fname, max_width, quality, ext in files:
    fpath = os.path.join(assets_dir, fname)
    if not os.path.exists(fpath):
        print(f"SKIP: {fname} not found")
        continue
    
    img = Image.open(fpath)
    orig_size = os.path.getsize(fpath)
    
    # Resize if too wide
    w, h = img.size
    if w > max_width:
        ratio = max_width / w
        new_h = int(h * ratio)
        img = img.resize((max_width, new_h), Image.LANCZOS)
    
    # Convert to RGB if saving as JPEG
    if ext == ".jpg" and img.mode in ("RGBA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
        img = bg
    
    # Save
    if ext == ".jpg":
        img.save(fpath, "JPEG", quality=quality, optimize=True)
    else:
        img.save(fpath, optimize=True)
    
    new_size = os.path.getsize(fpath)
    print(f"{fname}: {orig_size/1024:.1f}KB -> {new_size/1024:.1f}KB")

