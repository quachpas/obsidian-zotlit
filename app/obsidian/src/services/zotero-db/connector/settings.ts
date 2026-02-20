import { homedir } from "os";
import { join } from "path";

export interface SettingsDatabase {
  zoteroApiPort: number;
  zoteroApiKey: string;
  citationLibrary: number;
  /** Path to Zotero data directory, used for annotation image cache */
  zoteroCacheDir: string;
}

export const getDefaultSettingsDatabase = (): SettingsDatabase => ({
  zoteroApiPort: 23119,
  zoteroApiKey: "",
  citationLibrary: 1,
  zoteroCacheDir: join(homedir(), "Zotero"),
});
