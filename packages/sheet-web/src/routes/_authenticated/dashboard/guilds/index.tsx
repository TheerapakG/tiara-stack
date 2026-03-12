import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/guilds/")({
  component: GuildsIndexPage,
});

function GuildsIndexPage() {
  return (
    <div className="border border-[#33ccbb]/20 bg-[#0f1615] p-8">
      <div className="h-48 flex items-center justify-center border-2 border-dashed border-[#33ccbb]/20">
        <p className="text-white/40 font-medium tracking-wide">SELECT A GUILD FROM THE SIDEBAR</p>
      </div>
    </div>
  );
}
