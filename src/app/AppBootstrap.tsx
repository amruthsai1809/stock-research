"use client";

import { appServices } from "@/src/app/composition/services";
import { TideApp } from "@/src/features/shell/TideApp";

export function AppBootstrap() {
  return <TideApp services={appServices} />;
}
