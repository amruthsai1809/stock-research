"use client";

import { appServices } from "@/src/app/composition/services";
import { ResearchApp } from "@/src/features/shell/TideApp";

export function AppBootstrap() {
  return <ResearchApp services={appServices} />;
}
