import type { WorldModel } from "@artemis-glitter/domain";
import { isConnected, isGameOver } from "@artemis-glitter/domain";

interface ConnectionOverlayProps {
  model: WorldModel;
}

export function ConnectionOverlay({ model }: ConnectionOverlayProps) {
  if (isGameOver(model)) {
    return (
      <div style={{ padding: "1rem", background: "#300", color: "#f00", textAlign: "center" }}>
        <h2>{model.gameOver.title}</h2>
        <p>{model.gameOver.reason}</p>
      </div>
    );
  }

  if (!isConnected(model) && !model.gameStarted) {
    return (
      <div style={{ padding: "1rem", background: "#330", color: "#ff0", textAlign: "center" }}>
        <p>Not connected to Artemis server.</p>
      </div>
    );
  }

  if (!model.gameStarted) {
    return (
      <div style={{ padding: "1rem", background: "#033", color: "#0ff", textAlign: "center" }}>
        <p>Connected. Waiting for simulation to start...</p>
      </div>
    );
  }

  return null;
}
