// 전역 스타일을 불러오고 App을 #root에 마운트하는 브라우저 진입점

import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "@/app/app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
