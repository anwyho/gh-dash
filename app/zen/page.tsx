import { getConfig } from "@/lib/config";
import ZenView from "@/components/views/ZenView";

export default function ZenPage() {
  const config = getConfig();
  return (
    <ZenView
      refreshIntervalMs={config.refreshIntervalMs}
      myLogin={config.myGitHubLogin}
      repo={config.repo}
    />
  );
}
