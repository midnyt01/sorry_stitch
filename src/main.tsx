import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource/press-start-2p/400.css";
import "./styles.css";

// No StrictMode: it double-invokes the mount effect in dev, which would spin
// up two Phaser engines. A single Phaser game is the correct setup here.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

