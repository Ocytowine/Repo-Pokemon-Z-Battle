export interface SourceFullscreenTarget {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
}

export interface SourceFullscreenDocument {
  readonly fullscreenElement: Element | null;
}

export interface SourceLandscapeOrientation {
  lock?: (orientation: "landscape") => Promise<void>;
}

export interface SourceAndroidImmersionResult {
  readonly fullscreen: boolean;
  readonly orientationLocked: boolean;
}

/** A appeler uniquement depuis un geste utilisateur Android. */
export async function requestSourceAndroidImmersion(documentState: SourceFullscreenDocument,
  target: SourceFullscreenTarget, orientation: SourceLandscapeOrientation): Promise<SourceAndroidImmersionResult> {
  let fullscreen = documentState.fullscreenElement !== null;
  if (!fullscreen && target.requestFullscreen !== undefined) {
    try {
      await target.requestFullscreen({ navigationUI: "hide" });
      fullscreen = true;
    } catch { /* Le navigateur peut refuser le plein écran sans installation PWA. */ }
  }
  let orientationLocked = false;
  if (fullscreen && orientation.lock !== undefined) {
    try {
      await orientation.lock("landscape");
      orientationLocked = true;
    } catch { /* Le verrouillage dépend du navigateur et du mode plein écran. */ }
  }
  return { fullscreen, orientationLocked };
}

export class SourceAndroidImmersion {
  private pending = false;
  private completedElement: Element | null = null;

  public constructor(private readonly documentState: SourceFullscreenDocument,
    private readonly target: SourceFullscreenTarget,
    private readonly orientation: SourceLandscapeOrientation) {}

  public requestFromUserGesture(): void {
    if (this.documentState.fullscreenElement === null) this.completedElement = null;
    else if (this.documentState.fullscreenElement === this.completedElement) return;
    if (this.pending) return;
    this.pending = true;
    void requestSourceAndroidImmersion(this.documentState, this.target, this.orientation)
      .then((result) => {
        if (result.fullscreen) this.completedElement = this.documentState.fullscreenElement;
      }).finally(() => { this.pending = false; });
  }
}
