import type { Extension } from "@codemirror/state";
import { Service, calc, effect } from "@ophidian/core";
import { SettingsService, skip } from "@/settings/base";
import { bracketExtension } from "./bracket";
import { EtaSuggest } from "./suggester";
import { Plugin, App } from "obsidian";

export class TemplateEditorHelper extends Service {
  /** null if not registered */
  #editorExtensions: Extension[] | null = null;

  app = this.use(App);

  private _plugin?: Plugin;
  public initializePlugin(plugin: Plugin) {
    this._plugin = plugin;
  }

  settings = this.use(SettingsService);

  #registerEtaEditorHelper() {
    this._plugin?.registerEditorSuggest(new EtaSuggest(this.app));
  }

  @calc
  get etaBracketPairing() {
    return this.settings.current?.autoPairEta;
  }
  #setEtaBracketPairing(enable: boolean) {
    const loadedBefore = this.#editorExtensions !== null;
    if (this.#editorExtensions === null) {
      this.#editorExtensions = [];
      this._plugin?.registerEditorExtension(this.#editorExtensions);
    } else {
      this.#editorExtensions.length = 0;
    }
    if (enable) {
      this.#editorExtensions.push(bracketExtension(this.app.vault));
    }
    if (loadedBefore) {
      this.app.workspace.updateOptions();
    }
  }

  onload(): void {
    this.#registerEtaEditorHelper();
    this.register(
      effect(
        skip(
          () => this.#setEtaBracketPairing(this.etaBracketPairing),
          () => this.etaBracketPairing,
        ),
      ),
    );
  }
}
