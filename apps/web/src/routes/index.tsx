import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { connectMutation, disconnectMutation, shipSelectMutation } from "../api/mutations";
import { useRealtimeModel } from "../realtime/useRealtimeModel";
import { ConnectionOverlay } from "../components/ConnectionOverlay";
import { isConnected } from "@artemis-glitter/domain";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const model = useRealtimeModel();
  const [serverAddr, setServerAddr] = useState("");
  const [shipIndex, setShipIndex] = useState(0);

  const connect = useMutation(connectMutation);
  const disconnect = useMutation(disconnectMutation);
  const selectShip = useMutation(shipSelectMutation);

  const connected = isConnected(model);

  return (
    <div style={{ padding: "1rem" }}>
      <ConnectionOverlay model={model} />

      <h1>Artemis Glitter</h1>

      <section style={{ margin: "1rem 0" }}>
        <h2>Connection</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder="host:port"
            value={serverAddr}
            onChange={(e) => setServerAddr(e.target.value)}
            disabled={connected}
            style={{
              background: "#111",
              color: "#0f0",
              border: "1px solid #0f0",
              padding: "0.25rem 0.5rem",
            }}
          />
          <button
            onClick={() => connect.mutate(serverAddr)}
            disabled={connected || !serverAddr}
            style={{
              background: "#030",
              color: "#0f0",
              border: "1px solid #0f0",
              padding: "0.25rem 0.5rem",
            }}
          >
            Connect
          </button>
          <button
            onClick={() => disconnect.mutate()}
            disabled={!connected}
            style={{
              background: "#300",
              color: "#f00",
              border: "1px solid #f00",
              padding: "0.25rem 0.5rem",
            }}
          >
            Disconnect
          </button>
          <span>{connected ? "● Connected" : "○ Disconnected"}</span>
        </div>
      </section>

      <section style={{ margin: "1rem 0" }}>
        <h2>Ship Selection</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            value={shipIndex}
            onChange={(e) => setShipIndex(Number(e.target.value))}
            style={{
              background: "#111",
              color: "#0f0",
              border: "1px solid #0f0",
              padding: "0.25rem",
            }}
          >
            {Array.from({ length: 8 }, (_, i) => (
              <option key={i} value={i}>
                Ship {i + 1}
              </option>
            ))}
          </select>
          <button
            onClick={() => selectShip.mutate(shipIndex)}
            disabled={!connected}
            style={{
              background: "#030",
              color: "#0f0",
              border: "1px solid #0f0",
              padding: "0.25rem 0.5rem",
            }}
          >
            Select Ship
          </button>
        </div>
      </section>

      <section style={{ margin: "1rem 0" }}>
        <h2>Consoles</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          <li>
            <a href="/bearing-table" style={{ color: "#0f0" }}>
              Bearing Table
            </a>
          </li>
          <li>
            <a href="/proximity" style={{ color: "#0f0" }}>
              Proximity Monitor
            </a>
          </li>
          <li>
            <a href="/tubes" style={{ color: "#0f0" }}>
              Torpedo Tube Matrix
            </a>
          </li>
          <li>
            <a href="/map" style={{ color: "#0f0" }}>
              Debug Map
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
