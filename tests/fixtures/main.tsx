// Test-only component harness. Not a production route, authentication system, or backend.
import React from "react";
import { createRoot } from "react-dom/client";
import Workspace from "../../components/workspace";
import "../../app/globals.css";
createRoot(document.getElementById("root")!).render(
  <Workspace
    user={{
      id: "11111111-1111-4111-8111-111111111111",
      email: "fixture@example.test",
    }}
  />,
);
