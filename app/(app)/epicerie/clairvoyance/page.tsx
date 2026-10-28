import { Suspense } from "react";
import Clairvoyance from "./clairvoyance";

export default function ClairvoyancePage() {
  return (
    <Suspense fallback={<div className="card h-64 animate-pulse" />}>
      <Clairvoyance />
    </Suspense>
  );
}
