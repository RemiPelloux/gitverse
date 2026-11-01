import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import { Profile } from "@/features/progress/profile";

export const metadata: Metadata = { title: "Profile & settings" };

export default function ProfilePage() {
  return (
    <>
      <AppNav />
      <main>
        <Profile />
      </main>
    </>
  );
}
