import { useEffect, useState } from "react";
import { ReactFlow, Background, Controls, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const placeholderNodes: Node[] = [
  {
    id: "users",
    position: { x: 0, y: 0 },
    data: { label: "users" },
    type: "default",
  },
  {
    id: "posts",
    position: { x: 300, y: 0 },
    data: { label: "posts" },
    type: "default",
  },
];

export function App() {
  const [serverStatus, setServerStatus] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? setServerStatus("ok") : setServerStatus("down")))
      .catch(() => setServerStatus("down"));
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: 8, borderBottom: "1px solid #ddd", fontFamily: "sans-serif" }}>
        AthanorDB — server: {serverStatus}
      </header>
      <div style={{ flex: 1 }}>
        <ReactFlow nodes={placeholderNodes} edges={[]} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
