# JPEG orientation fixtures

Project-authored quadrants and circle under the repository MIT license. generate.py uses Pillow 12.3.0 to generate eight JPEG EXIF orientations and independent, decoded/oriented PNG references. Tests use the checked-in files; Python is optional fixture tooling. The two-channel-value comparison tolerance accounts for JPEG decoder differences, not geometric drift. Browser checks separately report edge/scaling differences and reject a deliberately incorrect orientation.
