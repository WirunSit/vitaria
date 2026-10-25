"""
ตัดภาพ "แผ่นรวม" จาก GPT ให้เป็นไฟล์แยกที่เกมใช้ได้ทันที

ตัวอย่าง:
  # แผ่นสีหน้า 8 แบบ (4 คอลัมน์ x 2 แถว) ของไมโทร่า
  python tools/crop_sheet.py portraits CHR_Mitora_Portraits.png Mitora

  # แผ่นไอคอนธาตุ 7 อัน (1 แถว)
  python tools/crop_sheet.py elements UI_Element_Sheet.png

  # ไอคอนตัวละครจากภาพเดี่ยว (ย่อเป็น 256x256 + ตัดเป็นสี่เหลี่ยมจัตุรัส)
  python tools/crop_sheet.py icon some_image.png Mitora

ผลลัพธ์จะถูกบันทึกลง public/assets/... ตามชื่อไฟล์ที่เกมค้นหา
ต้องติดตั้ง Pillow ก่อน:  pip install pillow
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CHAR_DIR = ROOT / "public" / "assets" / "characters"
UI_DIR = ROOT / "public" / "assets" / "ui"

EMOTIONS = ["Neutral", "Happy", "Sad", "Angry", "Surprised", "Worried", "Crying", "Thinking"]
ELEMENTS = ["Pyro", "Hydro", "Anemo", "Electro", "Dendro", "Cryo", "Geo"]


def trim(img: Image.Image) -> Image.Image:
    """Crop away fully transparent borders (if the image has alpha)."""
    if img.mode != "RGBA":
        return img
    box = img.getbbox()
    return img.crop(box) if box else img


def grid(img: Image.Image, cols: int, rows: int):
    w, h = img.size
    cw, ch = w // cols, h // rows
    for r in range(rows):
        for c in range(cols):
            yield img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))


def square(img: Image.Image, size: int) -> Image.Image:
    img = trim(img)
    w, h = img.size
    s = max(w, h)
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    canvas.paste(img, ((s - w) // 2, (s - h) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return
    mode, src = sys.argv[1], Path(sys.argv[2])
    img = Image.open(src).convert("RGBA")
    CHAR_DIR.mkdir(parents=True, exist_ok=True)
    UI_DIR.mkdir(parents=True, exist_ok=True)

    if mode == "portraits":
        name = sys.argv[3]
        for emo, part in zip(EMOTIONS, grid(img, 4, 2)):
            out = CHAR_DIR / f"CHR_{name}_Portrait_{emo}.png"
            part = trim(part)
            part.thumbnail((1024, 1024))
            part.save(out)
            print("saved", out.relative_to(ROOT))
    elif mode == "elements":
        for el, part in zip(ELEMENTS, grid(img, 7, 1)):
            out = UI_DIR / f"UI_Element_{el}.png"
            square(part, 256).save(out)
            print("saved", out.relative_to(ROOT))
    elif mode == "icon":
        name = sys.argv[3]
        out = CHAR_DIR / f"CHR_{name}_Icon.png"
        square(img, 256).save(out)
        print("saved", out.relative_to(ROOT))
    else:
        print("mode ต้องเป็น portraits | elements | icon")


if __name__ == "__main__":
    main()
