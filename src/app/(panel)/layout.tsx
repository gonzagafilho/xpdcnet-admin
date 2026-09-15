import type { ReactNode } from "react";
import { PanelFrame } from "@/components/layout/panel-frame";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return <PanelFrame>{children}</PanelFrame>;
}
