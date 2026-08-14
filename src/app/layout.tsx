import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.scss";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#2243B6",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "CoverageCheckNow — Homeowners & Property Insurance Intelligence",
    template: "%s | CoverageCheckNow",
  },
  description: "Comprehensive policy analysis, replacement cost estimation (RCE), coverage gap detection, and automated CoPilot outreach for property insurance policies.",
  applicationName: "CoverageCheckNow",
  authors: [{ name: "Alsop and Associates Insurance Agency" }],
  keywords: [
    "Property Insurance",
    "DIC insurance",
    "Difference in Conditions",
    "Insurance Policy Review",
    "RCE Verification",
    "Coverage Gap Detection",
    "Alsop and Associates",
    "Allstate CoPilot",
    "Homeowners Insurance California",
    "Property Insurance Intelligence",
  ],
  metadataBase: new URL("https://coveragechecknow.com"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "CoverageCheckNow — Insurance Policy Intelligence Platform",
    description: "Automatic dec page ingestion, RCE verification, coverage gap detection, and Allstate CoPilot prompt generation for Alsop and Associates.",
    url: "https://coveragechecknow.com",
    siteName: "CoverageCheckNow",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "CoverageCheckNow — Insurance Policy Intelligence Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CoverageCheckNow — Insurance Policy Intelligence Platform",
    description: "Comprehensive policy analysis, coverage gap detection, and automated outreach for property insurance agencies.",
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "InsuranceAgency",
      "@id": "https://coveragechecknow.com/#agency",
      "name": "Alsop and Associates Insurance Agency",
      "url": "https://coveragechecknow.com",
      "logo": "https://coveragechecknow.com/icon.svg",
      "description": "Insurance policy intelligence, property policy review, companion coverage analysis, and replacement cost estimation.",
      "areaServed": "California",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://coveragechecknow.com/#software",
      "name": "CoverageCheckNow",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "description": "AI-powered policy analysis, flag detection, and coverage review platform for property insurance agents and homeowners.",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
