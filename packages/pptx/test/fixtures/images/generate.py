"""Generate synthetic image fixtures; requires Pillow. No external source images."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).parent
for width, height, shape in [(120,60,'wide'),(60,120,'tall'),(80,80,'square')]:
    image = Image.new('RGB',(width,height),'white')
    draw = ImageDraw.Draw(image)
    draw.rectangle((0,0,width//2,height//2),fill='#da3745')
    draw.rectangle((width//2,0,width,height//2),fill='#2463eb')
    draw.rectangle((0,height//2,width//2,height),fill='#16a36a')
    draw.rectangle((width//2,height//2,width,height),fill='#f5bb29')
    radius = min(width,height)//4
    draw.ellipse((width//2-radius,height//2-radius,width//2+radius,height//2+radius),fill='white',outline='black',width=2)
    image.save(root/f'{shape}.png')
    if shape=='wide':
        image.save(root/'wide.jpg',quality=90)
        image.save(root/'wide-progressive.jpg',quality=90,progressive=True)
        image.save(root/'wide.gif')
        image.save(root/'wide.webp',lossless=True)
        image.save(root/'wide-lossy.webp',quality=90)
        rgba=image.convert('RGBA');rgba.putalpha(128);rgba.save(root/'wide-alpha.webp',quality=90)
        for orientation in range(1,9):
            exif=Image.Exif();exif[274]=orientation
            image.save(root/f'orientation-{orientation}.jpg',quality=90,exif=exif)

# Independent decoded-pixel references for compatible WebP export.
import hashlib, json
from PIL import ImageOps
wide = Image.open(root/'wide.png')
for orientation in [6,7]:
    exif=Image.Exif();exif[274]=orientation
    wide.save(root/f'webp-orientation-{orientation}.webp',lossless=True,exif=exif)
wide.save(root/'wide-animated.webp',lossless=True,save_all=True,
          append_images=[Image.new('RGB',wide.size,'blue')],duration=100,loop=0)
references = {}
for name in ['wide.webp','wide-lossy.webp','wide-alpha.webp','webp-orientation-6.webp','webp-orientation-7.webp','wide-animated.webp']:
    with Image.open(root/name) as source:
        source.seek(0)
        decoded=ImageOps.exif_transpose(source).convert('RGBA')
        references[name]={'width':decoded.width,'height':decoded.height,'rgbaSha256':hashlib.sha256(decoded.tobytes()).hexdigest()}
(root/'webp-references.json').write_text(json.dumps(references,indent=2)+'\n')
