// Root layout is minimal - locale-specific layout handles everything
// This is needed for Next.js but children are rendered in [locale]/layout.tsx

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
