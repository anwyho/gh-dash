import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "gh-dash — hawaiian-ice PR Dashboard",
  description: "Personal GitHub PR dashboard for Gusto/hawaiian-ice",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
