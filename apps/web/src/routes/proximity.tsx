import { createFileRoute } from "@tanstack/react-router";
import { useRealtimeModel } from "../realtime/useRealtimeModel";
import { getNearestEntities, getPlayerShip, isConnected } from "@artemis-glitter/domain";
import { useMemo } from "react";

export const Route = createFileRoute("/proximity")({
  component: ProximityPage,
});

function ProximityPage() {
  const model = useRealtimeModel();
  const player = getPlayerShip(model);
  const connected = isConnected(model);

  const nearest = useMemo(() => {
    if (!player) return { asteroids: null, enemies: null, nebulae: null, mines: null };
    const entities = getNearestEntities(model, { maxCount: 50 });
    const dist = (e: { posX: number; posY: number; posZ: number }) =>
      Math.sqrt(
        (e.posX - player.posX) ** 2 + (e.posY - player.posY) ** 2 + (e.posZ - player.posZ) ** 2,
      );

    return {
      asteroids: findNearest(entities, "asteroid", dist),
      enemies: findNearest(entities, "enemy", dist),
      nebulae: findNearest(entities, "nebula", dist),
      mines: findNearest(entities, "mine", dist),
    };
  }, [model, player]);

  if (!connected) return <div style={{ padding: "1rem" }}>Not connected</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Proximity Monitor</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <ProximityCard label="Nearest Asteroid" distance={nearest.asteroids} color="#ff0" />
        <ProximityCard label="Nearest Enemy" distance={nearest.enemies} color="#f00" />
        <ProximityCard label="Nearest Nebula" distance={nearest.nebulae} color="#f0f" />
        <ProximityCard label="Nearest Mine" distance={nearest.mines} color="#fa0" />
      </div>
    </div>
  );
}

function ProximityCard({
  label,
  distance,
  color,
}: {
  label: string;
  distance: number | null;
  color: string;
}) {
  return (
    <div style={{ border: `1px solid ${color}`, padding: "0.5rem", textAlign: "center" }}>
      <div style={{ color, fontSize: "0.8rem" }}>{label}</div>
      <div style={{ color, fontSize: "1.5rem", fontWeight: "bold" }}>
        {distance !== null ? distance.toFixed(0) : "---"}
      </div>
    </div>
  );
}

function findNearest(
  entities: Array<{ entityType: string; posX: number; posY: number; posZ: number }>,
  type: string,
  distFn: (e: { posX: number; posY: number; posZ: number }) => number,
): number | null {
  const filtered = entities.filter((e) => e.entityType === type);
  if (filtered.length === 0) return null;
  return Math.min(...filtered.map(distFn));
}
