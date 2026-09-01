import NextTopLoader from 'nextjs-toploader';
import { display, mono, sans } from './fonts';

const THEME_SCRIPT =
  "try{var m=document.cookie.match(/(?:^|; )app-theme=(light|dark)/);" +
  "if(m)document.documentElement.setAttribute('data-theme',m[1]);}catch(e){}";

type Props = {
  children: React.ReactNode;
  style?: Record<string, string>;
};

export function Document({ children, style }: Props) {
  // suppressHydrationWarning: THEME_SCRIPT sets data-theme from the cookie
  // before hydration — an intentional server/client attribute difference.
  // Tenant CSS variables are set here for the first paint and overridden
  // client-side by any nested TenantScope.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      style={style as unknown as React.CSSProperties}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans">
        <NextTopLoader color="var(--color-accent)" height={3} showSpinner={false} />
        {children}
      </body>
    </html>
  );
}
