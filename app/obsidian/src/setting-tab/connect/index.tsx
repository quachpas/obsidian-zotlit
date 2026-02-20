import { BackgroundConnectSetting } from "./Background";
import DatabaseSetting from "./Database";

export default function Connect() {
  return (
    <>
      <DatabaseSetting />
      <BackgroundConnectSetting />
    </>
  );
}
