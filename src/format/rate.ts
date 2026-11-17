/** Frames per second, one decimal, as the status bar shows it ("12.5 fps"). */
export function formatFrameRate(fps: number): string {
  return `${fps.toFixed(1)} fps`;
}
