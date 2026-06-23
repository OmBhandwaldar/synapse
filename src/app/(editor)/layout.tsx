import { Providers } from "@/components/Providers";
import "./editor.css";
import "@xyflow/react/dist/style.css";


export const metadata = {
  title: "CORTEX Node Editor // ノードエディタ",
  description: "Visual node-graph editor for orchestrating AI agents.",
};

export default function NodeEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Noto+Sans+JP:wght@400;700;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
