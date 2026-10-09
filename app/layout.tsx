import "./globals.css";
import "./ecosystem.css";

export const metadata = {
  title: "Rapsometeddy Anime Studio",
  description: "Create original anime episodes and music videos with an AI-assisted workflow.",
  icons: { icon: "/crowned-r.svg", shortcut: "/crowned-r.svg" },
  themeColor: "#09070f"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
