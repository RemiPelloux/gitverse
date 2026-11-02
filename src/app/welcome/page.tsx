import type { Metadata } from "next";
import { Welcome } from "@/features/progress/welcome";

export const metadata: Metadata = { title: "Welcome" };

export default function WelcomePage() {
  return <Welcome />;
}
