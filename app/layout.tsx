import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "gh-dash — hawaiian-ice PR Dashboard",
  description: "Personal GitHub PR dashboard for Gusto/hawaiian-ice",
};

// Anti-flicker: set data-theme before React hydrates to avoid flash
const themeScript = `
(function(){try{var t=localStorage.getItem('gh-dash:theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}}());
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
