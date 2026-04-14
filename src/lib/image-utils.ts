/**
 * Trims the whitespace/transparency from an image.
 * @param canvas The source canvas
 * @param tolerance Tolerance for "white" detection (0-255)
 */
export function trimImage(canvas: HTMLCanvasElement, tolerance: number = 20): HTMLCanvasElement | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let top = height, bottom = 0, left = width, right = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      // Check if pixel is NOT transparent AND NOT white (within tolerance)
      const isTransparent = a < 10;
      const isWhite = r > (255 - tolerance) && g > (255 - tolerance) && b > (255 - tolerance);

      if (!isTransparent && !isWhite) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        found = true;
      }
    }
  }

  if (!found) return null;

  const trimmedWidth = right - left + 1;
  const trimmedHeight = bottom - top + 1;

  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;
  const trimmedCtx = trimmedCanvas.getContext('2d');
  if (!trimmedCtx) return null;

  trimmedCtx.drawImage(canvas, left, top, trimmedWidth, trimmedHeight, 0, 0, trimmedWidth, trimmedHeight);

  return trimmedCanvas;
}

/**
 * Removes the background (outer parts) of an icon using flood fill.
 * Automatically detects the background color from the corners.
 */
export function removeBackground(canvas: HTMLCanvasElement, tolerance: number = 20): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const visited = new Uint8Array(width * height);

  // Sample corner colors to detect background color
  const corners = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]
  ];
  
  const bgColors = corners.map(([x, y]) => {
    const idx = (y * width + x) * 4;
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3]
    };
  });

  // Helper to check if a pixel matches the background
  const isBackground = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    // If already transparent, it's background
    if (a < 10) return true;

    // Check against sampled corner colors
    for (const bg of bgColors) {
      // If the corner itself was transparent, and this pixel is transparent, it's a match
      if (bg.a < 10 && a < 10) return true;
      
      // Color distance (Euclidean in RGB space)
      const distance = Math.sqrt(
        Math.pow(r - bg.r, 2) +
        Math.pow(g - bg.g, 2) +
        Math.pow(b - bg.b, 2)
      );

      if (distance <= tolerance) return true;
    }

    // Fallback: also check if it's white/near-white if the corners weren't white
    const isNearWhite = r > (255 - tolerance) && g > (255 - tolerance) && b > (255 - tolerance);
    if (isNearWhite) return true;

    return false;
  };

  const stack: [number, number][] = [];

  // Start flood fill from the 4 corners and edges
  for (let x = 0; x < width; x++) {
    if (isBackground(x, 0)) stack.push([x, 0]);
    if (isBackground(x, height - 1)) stack.push([x, height - 1]);
  }
  for (let y = 0; y < height; y++) {
    if (isBackground(0, y)) stack.push([0, y]);
    if (isBackground(width - 1, y)) stack.push([width - 1, y]);
  }

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;

    if (visited[idx]) continue;
    visited[idx] = 1;

    // Make this pixel transparent
    const dataIdx = idx * 4;
    data[dataIdx + 3] = 0;

    // Add neighbors
    const neighbors: [number, number][] = [
      [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[ny * width + nx]) {
        if (isBackground(nx, ny)) {
          stack.push([nx, ny]);
        }
      }
    }
  }

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const resultCtx = resultCanvas.getContext('2d');
  if (resultCtx) {
    resultCtx.putImageData(imageData, 0, 0);
  }

  return resultCanvas;
}

/**
 * Resizes and centers an image into a square canvas of target size.
 */
export function resizeToIcon(source: HTMLCanvasElement | HTMLImageElement, size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const srcWidth = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
  const srcHeight = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;

  const ratio = Math.min(size / srcWidth, size / srcHeight);
  const newWidth = srcWidth * ratio;
  const newHeight = srcHeight * ratio;

  const x = (size - newWidth) / 2;
  const y = (size - newHeight) / 2;

  ctx.drawImage(source, x, y, newWidth, newHeight);

  return canvas.toDataURL('image/png');
}
