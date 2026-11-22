import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Vazirmatn } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://penlabs.vercel.app"),
  title: {
    default: "PenLabs — Glass notes",
    template: "%s · PenLabs",
  },
  description:
    "A calm, glassy notes app. Write in sections, export to TXT, PDF and Word, and take your notes anywhere.",
  applicationName: "PenLabs",
  openGraph: {
    title: "PenLabs — Glass notes",
    description: "A calm, glassy notes app. Write in sections and take your notes anywhere.",
    siteName: "PenLabs",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef1fb" },
    { media: "(prefers-color-scheme: dark)", color: "#090914" },
  ],
};

// تم ذخیره‌شده رو قبل از رندر اعمال می‌کنه. پیش‌فرض: روشن
const themeScript = `
try {
  var t = localStorage.getItem("penlabs-theme");
  document.documentElement.dataset.theme = t === "dark" ? "dark" : "light";
} catch (e) {
  document.documentElement.dataset.theme = "light";
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${vazir.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}