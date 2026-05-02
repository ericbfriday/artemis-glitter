import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div style={{ fontFamily: "monospace", background: "#000", color: "#0f0", minHeight: "100vh" }}>
      <nav
        style={{
          display: "flex",
          gap: "1rem",
          padding: "0.5rem 1rem",
          borderBottom: "1px solid #0f0",
        }}
      >
        <Link to="/" style={{ color: "#0f0" }}>
          Home
        </Link>
        <Link to="/bearing-table" style={{ color: "#0f0" }}>
          Bearing Table
        </Link>
        <Link to="/proximity" style={{ color: "#0f0" }}>
          Proximity
        </Link>
        <Link to="/tubes" style={{ color: "#0f0" }}>
          Tubes
        </Link>
        <Link to="/map" style={{ color: "#0f0" }}>
          Map
        </Link>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
