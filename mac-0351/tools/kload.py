"""Load a slide image as it looks (embedded profile applied, alpha over white)."""
import io
from PIL import Image, ImageCms, ImageDraw

SRGB = ImageCms.createProfile('sRGB')


def load(path):
    """Open a slide image the way it looks: apply its embedded color profile (Keynote writes Display P3) and composite any alpha
    onto white (Keynote keeps a background's alpha in the exported PNG)."""
    im = Image.open(path)
    icc = im.info.get('icc_profile')
    im = im.convert('RGBA')
    if icc:
        rgb = ImageCms.profileToProfile(im.convert('RGB'), ImageCms.ImageCmsProfile(io.BytesIO(icc)), SRGB, outputMode='RGB')
        rgb.putalpha(im.getchannel('A'))
        im = rgb
    white = Image.new('RGBA', im.size, (255, 255, 255, 255))
    return Image.alpha_composite(white, im).convert('RGB')
