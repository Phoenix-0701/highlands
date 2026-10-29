import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Highlands Coffee · Quản lý vận hành",
  description:
    "Quản lý thực đơn, hóa đơn và điểm thưởng Highlands Coffee. BTL2 Nhóm 1.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
