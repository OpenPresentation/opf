"""Project-authored fixtures. Run with Pillow 12.3.0; no external image inputs."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
import hashlib, json
root=Path(__file__).parent
image=Image.new('RGB',(120,60),'white')
draw=ImageDraw.Draw(image)
for bounds,color in [((0,0,60,30),'#da3745'),((60,0,120,30),'#2463eb'),((0,30,60,60),'#16a36a'),((60,30,120,60),'#f5bb29')]:
    draw.rectangle(bounds,fill=color)
draw.ellipse((45,15,75,45),fill='white',outline='black',width=2)
image.save(root/'wide.webp',lossless=True)
image.save(root/'wide-lossy.webp',quality=90)
rgba=image.convert('RGBA');rgba.putalpha(128);rgba.save(root/'wide-alpha.webp',quality=90)
for orientation in [6,7]:
    exif=Image.Exif();exif[274]=orientation
    image.save(root/f'webp-orientation-{orientation}.webp',lossless=True,exif=exif)
image.save(root/'wide-animated.webp',lossless=True,save_all=True,append_images=[Image.new('RGB',image.size,'blue')],duration=100,loop=0)
references={}
for file in ['wide.webp','wide-lossy.webp','wide-alpha.webp','webp-orientation-6.webp','webp-orientation-7.webp','wide-animated.webp']:
    with Image.open(root/file) as source:
        source.seek(0)
        pixels=ImageOps.exif_transpose(source).convert('RGBA')
        references[file]={'width':pixels.width,'height':pixels.height,'rgbaSha256':hashlib.sha256(pixels.tobytes()).hexdigest()}
(root/'webp-references.json').write_text(json.dumps(references,indent=2)+'\n')
