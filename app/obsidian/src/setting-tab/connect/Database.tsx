import Setting from "../components/Setting";
import { DatabasePath } from "./DatabasePath";
import { useDatabaseStatus } from "./useDatabaseStatus";

export default function DatabaseSetting() {
  const [apiStatus] = useDatabaseStatus();

  return (
    <Setting
      name="Zotero HTTP API"
      description={
        <>
          <div>Requires Zotero 7+ with &quot;Allow other applications to communicate with Zotero&quot; enabled in Advanced settings.</div>
          <DatabasePath path="http://localhost:23119/api" state={apiStatus} />
        </>
      }
    />
  );
}
