import { useContext } from "react";
import { SettingTabCtx } from "../common";
import Setting, { useSetting } from "../components/Setting";
import { DatabasePath } from "./DatabasePath";
import { useDatabaseStatus } from "./useDatabaseStatus";

export default function DatabaseSetting() {
  const [apiStatus, refreshApiStatus] = useDatabaseStatus();
  const apiUrl = `http://localhost:${useApiPort()}/api`;

  return (
    <Setting
      name="Zotero HTTP API"
      description={
        <>
          <div>Requires Zotero 7+ with &quot;Allow other applications to communicate with Zotero&quot; enabled in Advanced settings.</div>
          <DatabasePath path={apiUrl} state={apiStatus} />
        </>
      }
    >
      <ApiPortInput onChanged={refreshApiStatus} />
      <ApiKeyInput />
    </Setting>
  );
}

function useApiPort() {
  const { settings } = useContext(SettingTabCtx);
  return settings.zoteroApiPort;
}

function ApiPortInput({ onChanged }: { onChanged: () => void }) {
  const [port, setPort] = useSetting(
    (s) => s.zoteroApiPort,
    (v, prev) => ({ ...prev, zoteroApiPort: v }),
  );
  return (
    <input
      type="number"
      placeholder="23119"
      value={port}
      onChange={(e) => {
        const val = Number.parseInt(e.target.value, 10);
        if (!Number.isNaN(val) && val > 0) {
          setPort(val);
          onChanged();
        }
      }}
    />
  );
}

function ApiKeyInput() {
  const [key, setKey] = useSetting(
    (s) => s.zoteroApiKey,
    (v, prev) => ({ ...prev, zoteroApiKey: v }),
  );
  return (
    <input
      type="text"
      placeholder="API key (optional)"
      value={key}
      onChange={(e) => setKey(e.target.value)}
    />
  );
}
