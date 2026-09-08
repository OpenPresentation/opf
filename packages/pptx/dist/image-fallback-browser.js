// Decode only the supplied local bytes. No URL is fetched and no canvas is
// attached to the document. Animated WebP becomes its first decoded frame.
export async function webpToPng(bytes) {
  const blob = new Blob([bytes], {type:'image/webp'});
  let picture, objectUrl;
  try {
    if (typeof createImageBitmap === 'function') {
      picture = await createImageBitmap(blob);
    } else {
      if (typeof Image === 'undefined') throw new Error('This browser has no image decoder.');
      objectUrl = URL.createObjectURL(blob);
      picture = new Image();
      picture.src = objectUrl;
      await picture.decode();
    }
    const width = picture.width || picture.naturalWidth;
    const height = picture.height || picture.naturalHeight;
    if (!width || !height || width * height > 40_000_000) throw new Error('Image dimensions exceed the 40 megapixel conversion limit.');
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(width, height) : document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser has no 2D canvas.');
    context.drawImage(picture, 0, 0);
    const png = canvas.convertToBlob
      ? await canvas.convertToBlob({type:'image/png'})
      : await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed.')), 'image/png'));
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    picture?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
