import type { Metadata } from "next";
import { QueryProvider } from "../providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deal Radar",
  description: "Advanced deal tracking and processing platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
