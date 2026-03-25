import { getConfig } from "@/lib/config";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const config = getConfig();
  return (
    <Dashboard
      refreshIntervalMs={config.refreshIntervalMs}
      myLogin={config.myGitHubLogin}
      repo={config.repo}
    />
  );
}
