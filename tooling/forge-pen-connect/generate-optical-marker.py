"""Generate an optional, measurable ArUco target. Run with OpenCV Python 4.12.0.88.

Print the SVG at 100% scale and measure the BLACK square, not the paper margin.
The target does not calibrate its attachment to the pen or establish native Quest support.
"""
import argparse
from pathlib import Path
import cv2
import numpy as np


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if cv2.__version__ != '4.12.0':
        raise SystemExit('Use the pinned OpenCV 4.12.0 Python package')
    dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
    pixels = cv2.aruco.generateImageMarker(dictionary, 0, 600, borderBits=1)
    # Verify the produced bit pattern with a separate detector before distributing it.
    canvas = np.full((800, 800), 255, dtype=np.uint8)
    canvas[100:700, 100:700] = pixels
    _, ids, _ = cv2.aruco.ArucoDetector(dictionary).detectMarkers(canvas)
    if ids is None or ids.tolist() != [[0]]:
        raise SystemExit('Generated marker did not decode uniquely as ID 0')
    cells = []
    for y in range(6):
        for x in range(6):
            if pixels[y * 100 + 50, x * 100 + 50] == 0:
                cells.append(f'<rect x="{x}" y="{y}" width="1" height="1"/>')
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">
<rect width="210" height="297" fill="white"/>
<g font-family="sans-serif" fill="black" text-anchor="middle">
<text x="105" y="20" font-size="5">Optional Muse optical tracking target</text>
<text x="105" y="28" font-size="3.5">ArUco DICT_4X4_50 - ID 0</text>
<text x="105" y="105" font-size="3.5">Black square: 40 mm at 100% print scale</text>
<text x="105" y="113" font-size="3.5">Measure the printed black square before entering its size.</text>
<text x="105" y="121" font-size="3.5">Keep a white border. Attach rigidly only if using marker mode.</text>
<text x="105" y="155" font-size="3.5">Check line below: 100 mm</text>
</g>
<g transform="translate(85 45) scale(6.666666666666667)" fill="black" shape-rendering="crispEdges">'''
    svg += ''.join(cells)
    svg += '''</g><path d="M55 165 H155 M55 162 V168 M155 162 V168" stroke="black" stroke-width="0.3"/>
</svg>\n'''
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(svg)
    print('Generated and decoded DICT_4X4_50 ID 0; nominal black square 40 mm')


if __name__ == '__main__':
    main()
