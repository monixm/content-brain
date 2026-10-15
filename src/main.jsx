import React from "react";
import { createRoot } from "react-dom/client";
import { IconContext } from "@phosphor-icons/react";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <IconContext.Provider value={{ weight: "duotone" }}><App /></IconContext.Provider>
  </React.StrictMode>,
);
