import GameApp from "@/components/GameApp";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function Home() {
  return (
    <ErrorBoundary>
      <GameApp />
    </ErrorBoundary>
  );
}
