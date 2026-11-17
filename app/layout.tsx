import type { Metadata } from "next";
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
  title: "PenLabs",
  description: "Glass-style notes",
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