import { createFileRoute } from "@tanstack/react-router";
import { useRealtimeModel } from "../realtime/useRealtimeModel";
import {
  getNearestEntities,
  getPlayerShip,
  isConnected,
  type Entity,
} from "@artemis-glitter/domain";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

function MapPage() {
  const model = useRealtimeModel();
  const player = getPlayerShip(model);
  const connected = isConnected(model);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<Entity | null>(null);
  const [scale, setScale] = useState(0.1);

  const entities = useMemo(
    () => (player ? getNearestEntities(model, { maxCount: 200 }) : []),
    [model, player],
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !player) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    for (const e of entities) {
      const x = cx + (e.posX - player.posX) * scale;
      const y = cy + (e.posZ - player.posZ) * scale;
      if (x < 0 || x > w || y < 0 || y > h) continue;

      const color = entityColor(e.entityType);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#0f0";
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }, [entities, player, scale]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!player) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      for (const entity of entities) {
        const x = cx + (entity.posX - player.posX) * scale;
        const y = cy + (entity.posZ - player.posZ) * scale;
        if (Math.abs(mx - x) < 6 && Math.abs(my - y) < 6) {
          setSelected(entity);
          return;
        }
      }
      setSelected(null);
    },
    [entities, player, scale],
  );

  if (!connected) return <div style={{ padding: "1rem" }}>Not connected</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Debug Map</h2>
      <div style={{ margin: "0.5rem 0" }}>
        <label style={{ marginRight: "0.5rem" }}>Scale:</label>
        <input
          type="range"
          min="0.01"
          max="1"
          step="0.01"
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
        />
        <span style={{ marginLeft: "0.5rem" }}>{scale.toFixed(2)}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onClick={handleCanvasClick}
        style={{ border: "1px solid #0f0", display: "block" }}
      />
      {selected && (
        <div style={{ marginTop: "0.5rem", border: "1px solid #0f0", padding: "0.5rem" }}>
          <strong>Selected:</strong> ID={selected.id} Type={selected.entityType}
          <br />
          Pos=({selected.posX.toFixed(0)}, {selected.posY.toFixed(0)}, {selected.posZ.toFixed(0)})
        </div>
      )}
      <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#888" }}>
        {entities.length} entities visible | Player at ({player?.posX.toFixed(0)},{" "}
        {player?.posY.toFixed(0)}, {player?.posZ.toFixed(0)})
      </div>
    </div>
  );
}

function entityColor(type: string): string {
  switch (type) {
    case "asteroid":
      return "#888";
    case "enemy":
      return "#f00";
    case "nebula":
      return "#f0f";
    case "mine":
      return "#fa0";
    case "station":
      return "#0ff";
    case "whale":
      return "#00f";
    case "anomaly":
      return "#ff0";
    case "drone":
      return "#a0a";
    default:
      return "#0f0";
  }
}
