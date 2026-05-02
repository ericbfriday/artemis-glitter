import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRealtimeModel } from "../realtime/useRealtimeModel";
import { getWeapons, isConnected } from "@artemis-glitter/domain";
import { tubeLoadMutation, tubeUnloadMutation, tubeFireMutation } from "../api/mutations";

export const Route = createFileRoute("/tubes")({
  component: TubesPage,
});

const ORDNANCE_TYPES = ["Type 0", "Type 1", "Type 2", "Type 3"];

function TubesPage() {
  const model = useRealtimeModel();
  const weapons = getWeapons(model);
  const connected = isConnected(model);

  const loadTube = useMutation(tubeLoadMutation);
  const unloadTube = useMutation(tubeUnloadMutation);
  const fireTube = useMutation(tubeFireMutation);

  const [selectedOrdnance, setSelectedOrdnance] = useState(0);

  if (!connected) return <div style={{ padding: "1rem" }}>Not connected</div>;

  const tubeCount = weapons.tubeContents.length;

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Torpedo Tube Matrix</h2>

      <div style={{ margin: "0.5rem 0" }}>
        <label style={{ marginRight: "0.5rem" }}>Ordnance:</label>
        <select
          value={selectedOrdnance}
          onChange={(e) => setSelectedOrdnance(Number(e.target.value))}
          style={{
            background: "#111",
            color: "#0f0",
            border: "1px solid #0f0",
            padding: "0.25rem",
          }}
        >
          {ORDNANCE_TYPES.map((t, i) => (
            <option key={i} value={i}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "0.5rem",
        }}
      >
        {Array.from({ length: tubeCount }, (_, i) => {
          const contents = weapons.tubeContents[i] ?? -1;
          const used = weapons.tubeUsed[i] ?? 0;
          return (
            <div key={i} style={{ border: "1px solid #0f0", padding: "0.5rem" }}>
              <div style={{ fontWeight: "bold" }}>Tube {i}</div>
              <div>Used: {used}</div>
              <div>
                Contents:{" "}
                {contents >= 0 ? (ORDNANCE_TYPES[contents] ?? `Type ${contents}`) : "Empty"}
              </div>
              <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem" }}>
                <button
                  onClick={() => loadTube.mutate({ tube: i, ordnance: selectedOrdnance })}
                  style={btnStyle}
                >
                  Load
                </button>
                <button onClick={() => unloadTube.mutate(i)} style={btnStyle}>
                  Unload
                </button>
                <button
                  onClick={() => fireTube.mutate(i)}
                  style={{ ...btnStyle, borderColor: "#f00", color: "#f00" }}
                >
                  Fire
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {tubeCount === 0 && <p>No tube data available yet.</p>}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "transparent",
  color: "#0f0",
  border: "1px solid #0f0",
  padding: "0.15rem 0.4rem",
  fontSize: "0.8rem",
  cursor: "pointer",
};
