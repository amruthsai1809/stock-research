"use client";

import { appServices } from "@/src/app/composition/services";
import { EquityLabApp } from "@/src/features/shell/EquityLabApp";

export function AppBootstrap() {
  return <EquityLabApp services={appServices} />;
}
