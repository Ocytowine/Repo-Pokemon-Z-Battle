export type SourceSceneMode = "overworld" | "dialogue" | "battle" | "menu" | "transition";
export type SourceMenuTab = "team" | "bag" | "save" | "coop" | "options";
export type SourceSceneAction = "ambient-motion" | "world-input" | "dialogue-input" | "scene-change"
  | "start-sequence" | "source-transfer";

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

  public allows(action: SourceSceneAction, activity: SourceSceneActivity): boolean {
    const mode = this.mode(activity);
    switch (action) {
      case "ambient-motion":
        return mode === "overworld";
      case "world-input":
      case "scene-change":
      case "start-sequence":
        return mode === "overworld" && !activity.movement;
      case "dialogue-input":
        return mode === "dialogue" && activity.dialogue && !activity.movement;
      case "source-transfer":
        // Une commande de transfert peut appartenir à une séquence, mais jamais
        // concurrencer un combat, un menu, un mouvement ou un autre transfert.
        return !activity.battle && !activity.transition && !this.openedMenu && !activity.movement;
    }
  }

  public openMenu(activity: SourceSceneActivity): boolean {
    if (!this.allows("scene-change", activity)) return false;
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
