import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/_layout/")({
  component: DashboardIndex,
});

function DashboardIndex() {
  return <Navigate to="/dashboard/shifts" />;
}
