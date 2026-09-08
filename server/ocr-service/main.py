from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image
import pytesseract
import io
import uvicorn

app = FastAPI(title="OCR Service")

@app.post("/api/ocr")
async def recognize_image(file: UploadFile = File(...)):
    """
    识别图片中的文字，返回词级坐标
    """
    try:
        # 读取图片
        content = await file.read()
        image = Image.open(io.BytesIO(content))
        
        # 转换为 RGB
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # OCR 识别（返回详细数据包括坐标）
        data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
        
        # 解析结果
        words = []
        n_boxes = len(data['text'])
        
        for i in range(n_boxes):
            text = data['text'][i].strip()
            if text:  # 只保留非空文本
                words.append({
                    "text": text,
                    "x": data['left'][i],
                    "y": data['top'][i],
                    "width": data['width'][i],
                    "height": data['height'][i],
                    "confidence": data['conf'][i]
                })
        
        return JSONResponse(content={
            "success": True,
            "words": words,
            "count": len(words)
        })
        
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ocr"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
