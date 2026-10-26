export interface SourceAspectFrameSize {
  readonly width: number;
  readonly height: number;
}

export function sourceAspectFrameSize(availableWidth: number, availableHeight: number,
  aspectRatio: number): SourceAspectFrameSize {
  if (!Number.isFinite(availableWidth) || !Number.isFinite(availableHeight)
    || !Number.isFinite(aspectRatio) || availableWidth <= 0 || availableHeight <= 0 || aspectRatio <= 0) {
    return { width: 0, height: 0 };
  }
  const width = Math.min(availableWidth, availableHeight * aspectRatio);
  return { width, height: width / aspectRatio };
}

export function bindSourceAspectFrame(container: HTMLElement, frame: HTMLElement,
  aspectRatio: number): () => void {
  const update = (): void => {
    const size = sourceAspectFrameSize(container.clientWidth, container.clientHeight, aspectRatio);
    if (size.width === 0 || size.height === 0) return;
    frame.style.width = `${size.width}px`;
    frame.style.height = `${size.height}px`;
  };
  const observer = new ResizeObserver(update);
  observer.observe(container);
  update();
  const animationFrame = requestAnimationFrame(update);
  return () => {
    cancelAnimationFrame(animationFrame);
    observer.disconnect();
  };
}
