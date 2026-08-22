export interface RgbaImage {
    width: number;
    height: number;
    /** Length `width * height * 4`, straight (non-premultiplied) alpha. */
    data: Uint8Array;
}
export declare function encodePng(rgba: Uint8Array, width: number, height: number): Buffer;
export declare function decodePng(png: Uint8Array): RgbaImage;
