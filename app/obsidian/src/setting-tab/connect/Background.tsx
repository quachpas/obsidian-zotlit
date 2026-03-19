import getPort from "get-port";
import { Notice } from "obsidian";
import { useContext, useState } from "react";
import { useIconRef } from "@/utils/icon";
import { SettingTabCtx, useRefreshAsync } from "../common";
import { BooleanSettingBase, useSwitch } from "../components/Boolean";
import Setting, { useSetting } from "../components/Setting";
import { DatabasePath } from "./DatabasePath";
import type { DatabaseStatus } from "./useDatabaseStatus";

function ServerStatus() {
  const { server } = useContext(SettingTabCtx);
  const [enableServer] = useSetting(
    (s) => s.enableServer,
    (_, s) => s,
  );
  const [hostname] = useSetting(
    (s) => s.serverHostname ?? "127.0.0.1",
    (_, s) => s,
  );
  const [port] = useSetting(
    (s) => s.serverPort ?? 9091,
    (_, s) => s,
  );
  const [promise, refresh] = useRefreshAsync(
    () =>
      Promise.resolve({
        listening: server.server?.listening ?? false,
        error: server.lastError,
      }),
    [],
  );
  const [refreshIconRef] = useIconRef<HTMLButtonElement>("refresh-cw");

  let state: DatabaseStatus;
  if (!enableServer || promise.loading) {
    state = "disabled";
  } else {
    state = promise.result?.listening ? "success" : "failed";
  }

  const errorMsg = state === "failed" ? promise.result?.error?.message : undefined;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <DatabasePath
          path={`http://${hostname}:${port}/notify`}
          state={state}
        />
        <button aria-label="Refresh" ref={refreshIconRef} onClick={refresh} />
      </div>
      {errorMsg && (
        <code className="text-txt-error text-xs">{errorMsg}</code>
      )}
    </div>
  );
}

export function BackgroundConnectSetting() {
  const [value, setValue] = useSetting(
    (s) => s.enableServer,
    (v, s) => ({ ...s, enableServer: v }),
  );
  const ref = useSwitch(value, setValue);
  return (
    <>
      <Setting
        heading
        name="Background connect"
        description={
          <>
            <div>
              Allow Zotero to send status in the background, which is required
              for some features like focus annotation on selection in Zotero
            </div>
            <ServerStatus />
          </>
        }
      />
      <BooleanSettingBase ref={ref} name="Enable">
        Remember to enable the server in Zotero as well
      </BooleanSettingBase>
      {value && <ServerPort />}
    </>
  );
}

function ServerPort() {
  const [defaultPort, applyPort] = useSetting(
    (s) => s.serverPort,
    (v, prev) => ({ ...prev, serverPort: v }),
  );
  const [hostname] = useSetting(
    (s) => s.serverHostname,
    (v, prev) => ({ ...prev, serverHostname: v }),
  );
  const [port, setPort] = useState<number>(defaultPort);
  const [checkIconRef] = useIconRef<HTMLButtonElement>("check");
  async function apply() {
    if (isNaN(port) || port < 0 || port > 65535) {
      new Notice("Invalid port number: " + port);
      setPort(defaultPort);
      return false;
    }
    if (port === defaultPort) {
      // no need to save if port is not changed
      return false;
    }
    const portReady = await getPort({
      host: hostname,
      port: [port],
    });
    if (portReady !== port) {
      new Notice(
        `Port is currently occupied, a different port is provided: ${portReady}, confirm again to apply the change.`,
      );
      setPort(portReady);
      return false;
    }
    applyPort(portReady);
    return true;
  }
  return (
    <Setting name="Port number" description={`Default to ${defaultPort}`}>
      <input
        type="number"
        value={port}
        min={0}
        max={65535}
        onChange={(evt) => setPort(Number.parseInt(evt.target.value, 10))}
      />
      <button aria-label="Apply" ref={checkIconRef} onClick={apply} />
    </Setting>
  );
}
