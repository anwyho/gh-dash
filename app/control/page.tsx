import { getConfig } from "@/lib/config";
import ControlPanel from "@/components/views/ControlPanel";

export default function ControlPage() {
  const config = getConfig();
  return (
    <ControlPanel
      refreshIntervalMs={config.refreshIntervalMs}
      myLogin={config.myGitHubLogin}
      repo={config.repo}
    />
  );
}
