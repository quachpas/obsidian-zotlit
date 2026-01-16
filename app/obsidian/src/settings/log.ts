import type { LogLevel } from "@obzt/common";

export const DEFAULT_LOGLEVEL: LogLevel = "INFO";

export interface SettingsLog {
  logLevel: LogLevel;
}

export const defaultSettingsLog: SettingsLog = {
  logLevel: DEFAULT_LOGLEVEL,
};
