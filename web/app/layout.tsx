import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LinkedOut — The feed after the exit",
  description: "A professional network for people who left, were let go, and are ready to talk about it.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
