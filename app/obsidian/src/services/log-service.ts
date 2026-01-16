import { Service, calc, effect } from "@ophidian/core";
import DatabaseWorker from "@/services/zotero-db/connector/service";
import { SettingsService, skip } from "@/settings/base";
import { DEFAULT_LOGLEVEL } from "@/settings/log";
import { storageKey } from "@/log";

export class LogService extends Service {
  settings = this.use(SettingsService);

  @calc
  get level() {
    return this.settings.current?.logLevel;
  }

  async applyLogLevel() {
    localStorage.setItem(storageKey, this.level ?? DEFAULT_LOGLEVEL);
    await this.use(DatabaseWorker).api.setLoglevel(this.level ?? DEFAULT_LOGLEVEL);
  }

  onload(): void {
    this.register(
      effect(
        skip(
          () => this.applyLogLevel(),
          () => this.level,
        ),
      ),
    );
  }
}
