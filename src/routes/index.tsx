import { createFileRoute } from "@tanstack/react-router";
import { LiveDuo } from "@/components/live-duo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Duo" },
      {
        name: "description",
        content: "Watch two YouTube lives in one window, with chat and optional viewer counts.",
      },
      { name: "theme-color", content: "#0a0a0f" },
    ],
  }),
  component: Home,
});

function Home() {
  return <LiveDuo />;
}
