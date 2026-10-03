import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '成语辨析·4小时冲刺',
  description: '基于花生十三高频成语资料包的本地自适应刷题系统',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
