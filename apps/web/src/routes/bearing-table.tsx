import { createFileRoute } from "@tanstack/react-router";
import { useRealtimeModel } from "../realtime/useRealtimeModel";
import { getNearestEntities, getPlayerShip } from "@artemis-glitter/domain";
import { useMemo } from "react";

export const Route = createFileRoute("/bearing-table")({
  component: BearingTablePage,
});

function BearingTablePage() {
  const model = useRealtimeModel();
  const player = getPlayerShip(model);

  const rows = useMemo(() => {
    if (!player) return [];
    const entities = getNearestEntities(model, { maxCount: 20 });
    return entities.map((e) => {
      const dx = e.posX - player.posX;
      const dy = e.posY - player.posY;
      const dz = e.posZ - player.posZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const bearing = Math.atan2(dy, dx) * (180 / Math.PI);
      const heading = Math.atan2(dz, dx) * (180 / Math.PI);
      return {
        id: e.id,
        type: e.entityType,
        dist: dist.toFixed(0),
        brg: bearing.toFixed(1),
        hdg: heading.toFixed(1),
      };
    });
  }, [model, player]);

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Bearing Distance Table</h2>
      {!player ? (
        <p>Waiting for ship data...</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>BRG</th>
              <th style={thStyle}>DST</th>
              <th style={thStyle}>HDG</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={tdStyle}>{r.id}</td>
                <td style={tdStyle}>{r.type}</td>
                <td style={tdStyle}>{r.brg}</td>
                <td style={tdStyle}>{r.dist}</td>
                <td style={tdStyle}>{r.hdg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  border: "1px solid #0f0",
  padding: "0.25rem 0.5rem",
  textAlign: "left",
};
const tdStyle: React.CSSProperties = { border: "1px solid #0f0", padding: "0.25rem 0.5rem" };
