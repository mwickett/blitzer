import NavBar from "./NavBar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <NavBar>{children}</NavBar>;
}
