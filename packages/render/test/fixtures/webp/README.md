# WebP raster fixtures

Project-authored synthetic quadrants and circle, distributed under this repository's MIT license. These are shared with the local OPF PPTX fidelity tests. generate.py recreates the files and independent RGBA SHA-256 references using Pillow 12.3.0. Tests need only the checked-in files, not Python.

Cases cover lossless/lossy WebP, alpha, EXIF 6/7 and two-frame animation. Pixel references use the EXIF-transposed first frame. PNG tests inspect pixels and PDF tests inspect the embedded image stream and alpha mask; serialization alone is not the check.
