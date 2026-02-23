import { homedir } from "os";
import { join } from "path";

export interface SettingsDatabase {
  citationLibrary: number;
  /** Path to Zotero data directory, used for annotation image cache */
  zoteroCacheDir: string;
}

export const getDefaultSettingsDatabase = (): SettingsDatabase => ({
  citationLibrary: 1,
  zoteroCacheDir: join(homedir(), "Zotero"),
});
