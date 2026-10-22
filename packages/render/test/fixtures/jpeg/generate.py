"""Create project-authored JPEG orientation fixtures and independent PNG references."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
root=Path(__file__).parent
image=Image.new('RGB',(120,60),'white');draw=ImageDraw.Draw(image)
for bounds,color in [((0,0,60,30),'#da3745'),((60,0,120,30),'#2463eb'),((0,30,60,60),'#16a36a'),((60,30,120,60),'#f5bb29')]:
    draw.rectangle(bounds,fill=color)
draw.ellipse((45,15,75,45),fill='white',outline='black',width=2)
for orientation in range(1,9):
    exif=Image.Exif();exif[274]=orientation
    file=root/f'orientation-{orientation}.jpg'
    image.save(file,quality=90,exif=exif)
    with Image.open(file) as decoded:
        ImageOps.exif_transpose(decoded).convert('RGBA').save(root/f'expected-{orientation}.png')
