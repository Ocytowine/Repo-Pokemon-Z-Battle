export type SourceSceneMode = "overworld" | "dialogue" | "battle" | "menu" | "transition";
export type SourceMenuTab = "team" | "bag" | "save" | "options";

export interface SourceSceneActivity {
  readonly dialogue: boolean;
  readonly battle: boolean;
  readonly transition: boolean;
  readonly sequence: boolean;
  readonly movement: boolean;
}

export class SourceSceneCoordinator {
  private openedMenu = false;
  private selectedTab: SourceMenuTab = "team";

  public get menuOpen(): boolean { return this.openedMenu; }
  public get menuTab(): SourceMenuTab { return this.selectedTab; }

  public mode(activity: SourceSceneActivity): SourceSceneMode {
    if (activity.battle) return "battle";
    if (activity.transition) return "transition";
    if (activity.dialogue || activity.sequence) return "dialogue";
    if (this.openedMenu) return "menu";
    return "overworld";
  }

  public openMenu(activity: SourceSceneActivity): boolean {
    if (this.mode(activity) !== "overworld" || activity.movement) return false;
    this.openedMenu = true;
    return true;
  }

  public closeMenu(): boolean {
    if (!this.openedMenu) return false;
    this.openedMenu = false;
    return true;
  }

  public selectMenuTab(tab: SourceMenuTab): void {
    this.selectedTab = tab;
  }
}
