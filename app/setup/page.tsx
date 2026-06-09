import { notFound } from "next/navigation";
import SetupClient from "./SetupClient";

export default function SetupPage() {
  if (process.env.ENABLE_SETUP !== "true") {
    notFound();
  }
  return <SetupClient />;
}
