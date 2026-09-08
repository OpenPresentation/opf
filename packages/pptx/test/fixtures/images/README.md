# Synthetic image fixtures

Generated entirely by generate.py using Pillow 12.3.0: four colored quadrants and a circle on 120×60, 60×120 and 80×80 canvases. These project-authored fixtures use the repository MIT license. No external photographs, font files or private metadata are included.

The JPEG set includes baseline/progressive encoding and EXIF orientations 1–8. WebP includes lossless VP8L, lossy VP8 and extended VP8X/alpha. PNG and GIF cover their standard dimension headers. The generator is optional development tooling; tests use checked-in files and need no Python runtime.

Compatible WebP fixtures additionally cover EXIF 6/7 and two-frame animation. webp-references.json contains independent Pillow-decoded, EXIF-transposed first-frame RGBA SHA-256 values for all six WebP specimens. The Node tests compare decoded exported PNG pixels against these references.
