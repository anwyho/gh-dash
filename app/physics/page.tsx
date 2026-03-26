import { getConfig } from "@/lib/config";
import PhysicsView from "@/components/views/PhysicsView";

export default function PhysicsPage() {
  const config = getConfig();
  return (
    <PhysicsView
      refreshIntervalMs={config.refreshIntervalMs}
      myLogin={config.myGitHubLogin}
      repo={config.repo}
    />
  );
}
