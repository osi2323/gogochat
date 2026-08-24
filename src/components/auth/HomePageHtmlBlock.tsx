"use client";

import { useMemo } from "react";
import { sanitizeHomePageHtmlServerSafe } from "@/lib/sanitizeHomePageHtml";

interface HomePageHtmlBlockProps {
  html?: string | null;
  variant: "standard" | "premium";
  className?: string;
  insertRootOffsetSpacer?: boolean;
}

const LOGIN_OFFSET_SPACER_HTML =
  '<div class="home-page-html-login-spacer" aria-hidden="true"></div>';

const insertLoginOffsetSpacerIntoFirstLayoutRoot = (html: string) => {
  const leadingLinksMatch = html.match(/^(?:\s*<link\b[^>]*>\s*)*/i);
  const contentStart = leadingLinksMatch?.[0]?.length ?? 0;
  const rest = html.slice(contentStart);
  const rootMatch = rest.match(/^<(div|main|section|article)\b[^>]*>/i);

  if (!rootMatch || rootMatch[0].endsWith("/>")) {
    return html;
  }

  return `${html.slice(0, contentStart)}${rootMatch[0]}${LOGIN_OFFSET_SPACER_HTML}${rest.slice(rootMatch[0].length)}`;
};

export const HomePageHtmlBlock = ({
  html,
  variant,
  className = "",
  insertRootOffsetSpacer = false,
}: HomePageHtmlBlockProps) => {
  const scopeClass =
    variant === "premium"
      ? ".home-page-html-premium"
      : ".home-page-html-standard";
  const htmlClassName =
    variant === "premium" ? "home-page-html-premium" : "home-page-html-standard";
  const combinedClassName = [htmlClassName, "m-0 w-full p-0", className]
    .filter(Boolean)
    .join(" ");

  // Use the server-safe path on both SSR and client so the output is
  // identical on first paint — no hydration mismatch, no flicker.
  const sanitizedContent = useMemo(() => {
    if (!html?.trim()) {
      return { html: "", css: "" };
    }

    const sanitized = sanitizeHomePageHtmlServerSafe(html, scopeClass);
    return {
      ...sanitized,
      html: insertRootOffsetSpacer
        ? insertLoginOffsetSpacerIntoFirstLayoutRoot(sanitized.html)
        : sanitized.html,
    };
  }, [html, insertRootOffsetSpacer, scopeClass]);

  if (!sanitizedContent.html) {
    return <div className="m-0 w-full p-0" suppressHydrationWarning />;
  }

  return (
    <div className="m-0 w-full p-0" suppressHydrationWarning>
      <style>
        {`
          .${htmlClassName} h1 {
            display: block;
            font-size: 2em;
            margin-block: 0.67em;
            font-weight: bold;
          }

          .${htmlClassName} h2 {
            display: block;
            font-size: 1.5em;
            margin-block: 0.83em;
            font-weight: bold;
          }

          .${htmlClassName} h3 {
            display: block;
            font-size: 1.17em;
            margin-block: 1em;
            font-weight: bold;
          }

          .${htmlClassName} h4 {
            display: block;
            margin-block: 1.33em;
            font-weight: bold;
          }

          .${htmlClassName} h5 {
            display: block;
            font-size: 0.83em;
            margin-block: 1.67em;
            font-weight: bold;
          }

          .${htmlClassName} h6 {
            display: block;
            font-size: 0.67em;
            margin-block: 2.33em;
            font-weight: bold;
          }

          .${htmlClassName} p {
            display: block;
            margin-block: 1em;
          }

          .${htmlClassName} ul,
          .${htmlClassName} ol {
            display: block;
            margin-block: 1em;
            padding-inline-start: 40px;
          }

          .${htmlClassName} ul {
            list-style-type: disc;
          }

          .${htmlClassName} ol {
            list-style-type: decimal;
          }

          .${htmlClassName} li {
            display: list-item;
            text-align: match-parent;
          }

          .${htmlClassName} strong,
          .${htmlClassName} b {
            font-weight: bold;
          }
        `}
      </style>
      {sanitizedContent.css ? <style>{sanitizedContent.css}</style> : null}
      <div
        className={combinedClassName}
        dangerouslySetInnerHTML={{ __html: sanitizedContent.html }}
        suppressHydrationWarning
      />
    </div>
  );
};
