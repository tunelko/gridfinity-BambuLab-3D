import type { Bin } from '../store/useStore';

export function checkCollision(
  bins: Bin[],
  newBin: { x: number; y: number; w: number; d: number },
  excludeId: string | null,
  gridCols: number,
  gridRows: number,
): boolean {
  if (newBin.x < 0 || newBin.y < 0) return true;
  if (newBin.x + newBin.w > gridCols) return true;
  if (newBin.y + newBin.d > gridRows) return true;

  return bins.some((b) => {
    if (b.id === excludeId) return false;
    return !(
      newBin.x + newBin.w <= b.x ||
      b.x + b.w <= newBin.x ||
      newBin.y + newBin.d <= b.y ||
      b.y + b.d <= newBin.y
    );
  });
}
