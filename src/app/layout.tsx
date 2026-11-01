import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Gitverse — Learn Git by playing with it", template: "%s · Gitverse" },
  description:
    "An interactive, beginner-friendly way to learn Git and GitHub. Type real commands, watch your history grow, and level up.",
};

export const viewport: Viewport = {
  themeColor: "#080b17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className={`${geistSans.variable} ${jetbrains.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem("gitverse-progress")||"{}").state;if(s&&s.settings){document.documentElement.dataset.theme=s.settings.theme||"dark";if(s.settings.motion==="reduced")document.documentElement.dataset.motion="reduced"}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
