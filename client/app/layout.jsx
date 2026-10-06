import './globals.css';
import Providers from '@/components/providers';

export const metadata = {
  title: { default: 'TechOf Solution Tracker', template: '%s · TechOf Tracker' },
  description: 'Internal task accountability, attendance and team performance tracker.',
  robots: { index: false, follow: false, nocache: true },
};
export const viewport = { themeColor: '#080b14', width: 'device-width', initialScale: 1 };

// Applies the saved theme before first paint so there is no flash.
const themeScript = `(function(){try{var t=localStorage.getItem('techof_theme')||'dark';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');document.documentElement.dataset.reduceMotion=localStorage.getItem('techof_reduce_motion')==='true'?'true':'false';}catch(e){document.documentElement.classList.add('dark')}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
