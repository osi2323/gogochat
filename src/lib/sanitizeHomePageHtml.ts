"use client";

const ALLOWED_TAGS = new Set([
  "a",
  "article",
  "b",
  "blockquote",
  "button",
  "br",
  "code",
  "center",
  "div",
  "em",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "i",
  "img",
  "li",
  "link",
  "main",
  "marquee",
  "ol",
  "p",
  "pre",
  "section",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const GLOBAL_ATTRS = new Set([
  "aria-label",
  "class",
  "id",
  "role",
  "style",
  "title",
]);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  button: new Set(["type"]),
  img: new Set(["src", "alt", "width", "height"]),
  link: new Set(["rel", "href", "crossorigin", "type"]),
  marquee: new Set([
    "behavior",
    "bgcolor",
    "direction",
    "height",
    "hspace",
    "loop",
    "scrollamount",
    "scrolldelay",
    "truespeed",
    "vspace",
    "width",
    "style",
  ]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan", "scope"]),
};

const isSafeUrl = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("/") ||
    normalized.startsWith("./") ||
    normalized.startsWith("../") ||
    normalized.startsWith("#")
  ) {
    return true;
  }
  return normalized.startsWith("data:image/");
};

const normalizeAttributeValue = (value: string) =>
  value.replace(/\u00a0/g, " ").trim();

const sanitizeCssUrlTokens = (value: string) =>
  value.replace(/url\(([^)]+)\)/gi, (_match, rawUrl: string) => {
    const trimmedUrl = normalizeAttributeValue(rawUrl).replace(
      /^['"]|['"]$/g,
      "",
    );

    if (!isSafeUrl(trimmedUrl)) {
      return "none";
    }

    return `url("${trimmedUrl}")`;
  });

const sanitizeStyleValue = (value: string) => {
  const sanitizedValue = sanitizeCssUrlTokens(value).trim();
  const normalized = sanitizedValue.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) return "";
  if (
    normalized.includes("expression(") ||
    normalized.includes("javascript:") ||
    normalized.includes("behavior:") ||
    normalized.includes("@import")
  ) {
    return "";
  }
  return sanitizedValue;
};

const sanitizeCss = (css: string) => {
  const normalized = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@import[^;]+;/gi, "")
    .trim();
  if (!normalized) return "";
  const sanitizedCss = sanitizeCssUrlTokens(normalized);
  const lowered = sanitizedCss.toLowerCase();
  if (
    lowered.includes("expression(") ||
    lowered.includes("javascript:") ||
    lowered.includes("behavior:")
  ) {
    return "";
  }
  return sanitizedCss;
};

export type HomePageBackgroundStyle = {
  background?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundRepeat?: string;
  backgroundPosition?: string;
  backgroundSize?: string;
};

export type HomePageBackgroundSource = "none" | "body" | "root";

export type HomePageBackgroundExtraction = HomePageBackgroundStyle & {
  source: HomePageBackgroundSource;
};

const hasBackgroundDeclarations = (style: HomePageBackgroundStyle) =>
  Boolean(
    style.background ||
      style.backgroundColor ||
      style.backgroundImage ||
      style.backgroundRepeat ||
      style.backgroundPosition ||
      style.backgroundSize,
  );

export const DEFAULT_HOME_PAGE_BACKGROUND =
  "linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #eff6ff 100%)";

type CssTopLevelBlock = {
  prelude: string;
  body: string;
  cssText: string;
};

const parseCssTopLevelBlocks = (cssText: string): CssTopLevelBlock[] => {
  const blocks: CssTopLevelBlock[] = [];
  let start = 0;
  let bodyStart = -1;
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let i = 0; i < cssText.length; i++) {
    const char = cssText[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "{" && depth === 0) {
      bodyStart = i + 1;
      depth = 1;
      continue;
    }

    if (char === "{") {
      depth++;
      continue;
    }

    if (char === "}") {
      depth--;
      if (depth === 0 && bodyStart !== -1) {
        const cssTextBlock = cssText.slice(start, i + 1).trim();
        const prelude = cssText.slice(start, bodyStart - 1).trim();
        const body = cssText.slice(bodyStart, i).trim();

        if (prelude && cssTextBlock) {
          blocks.push({ prelude, body, cssText: cssTextBlock });
        }

        start = i + 1;
        bodyStart = -1;
      }
      continue;
    }

    if (char === ";" && depth === 0) {
      start = i + 1;
    }
  }

  return blocks;
};

const resolveCssVariables = (
  value: string,
  variables: Record<string, string>,
) =>
  value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/gi, (_match, name, fallback) => {
    const resolved = variables[name]?.trim();
    if (resolved) return resolved;
    return fallback?.trim() || "";
  });

const collectCssVariables = (declarationsText: string) => {
  const variables: Record<string, string> = {};
  const variablePattern = /(--[\w-]+)\s*:\s*([^;]+)\s*;?/gi;

  let match: RegExpExecArray | null = null;
  while ((match = variablePattern.exec(declarationsText))) {
    const name = match[1]?.trim();
    const value = match[2]?.trim();
    if (name && value) {
      variables[name] = value;
    }
  }

  return variables;
};

const applyBackgroundDeclarations = (
  declarationsText: string,
  variables: Record<string, string> = {},
): HomePageBackgroundStyle => {
  const collected: HomePageBackgroundStyle = {};
  const declarationPattern =
    /background(?:-color|-image|-repeat|-position|-size)?\s*:\s*([^;]+)\s*;?/gi;

  let match: RegExpExecArray | null = null;
  while ((match = declarationPattern.exec(declarationsText))) {
    const propertyChunk = match[0];
    const value = resolveCssVariables(match[1]?.trim() ?? "", variables);
    if (!value) continue;

    if (/^background-color\s*:/i.test(propertyChunk)) {
      collected.backgroundColor = value;
      continue;
    }
    if (/^background-image\s*:/i.test(propertyChunk)) {
      collected.backgroundImage = value;
      continue;
    }
    if (/^background-repeat\s*:/i.test(propertyChunk)) {
      collected.backgroundRepeat = value;
      continue;
    }
    if (/^background-position\s*:/i.test(propertyChunk)) {
      collected.backgroundPosition = value;
      continue;
    }
    if (/^background-size\s*:/i.test(propertyChunk)) {
      collected.backgroundSize = value;
      continue;
    }
    collected.background = value;
  }

  return collected;
};

const extractBackgroundFromCssTextServerSafe = (
  cssText: string,
): HomePageBackgroundStyle => {
  if (!cssText.trim()) {
    return {};
  }

  const collected: HomePageBackgroundStyle = {};
  const blocks = parseCssTopLevelBlocks(cssText);
  const variables: Record<string, string> = {};

  for (const block of blocks) {
    const targetsDocument = block.prelude
      .split(",")
      .map((selector) => selector.trim())
      .some(selectorTargetsDocumentRoot);

    if (!targetsDocument) continue;

    Object.assign(variables, collectCssVariables(block.body));
  }

  for (const block of blocks) {
    const targetsDocument = block.prelude
      .split(",")
      .map((selector) => selector.trim())
      .some(selectorTargetsDocumentRoot);

    if (!targetsDocument) continue;

    const declarations = applyBackgroundDeclarations(block.body, variables);
    Object.assign(collected, declarations);
  }

  return collected;
};

type RootElementIdentity = {
  tagName: string;
  id?: string;
  classNames: string[];
  style?: string;
};

const extractFirstRootElementIdentity = (
  html: string,
): RootElementIdentity | null => {
  const shellless = stripDocumentShellTags(removeUnsafeScriptBlocks(html));
  const firstTagPattern =
    /<((?!link\b|style\b|script\b|\/|!)([a-z][\w:-]*))\b([^>]*)>/i;
  const match = shellless.match(firstTagPattern);

  if (!match) return null;

  const tagName = match[1].toLowerCase();
  const attrs = match[3] ?? "";
  const idMatch = attrs.match(/\sid=(["'])(.*?)\1/i);
  const classMatch = attrs.match(/\sclass=(["'])(.*?)\1/i);
  const styleMatch = attrs.match(/\sstyle=(["'])(.*?)\1/i);

  return {
    tagName,
    id: idMatch?.[2]?.trim() || undefined,
    classNames: (classMatch?.[2] ?? "").split(/\s+/).filter(Boolean),
    style: styleMatch?.[2]?.trim() || undefined,
  };
};

const selectorTargetsRootElement = (
  selector: string,
  root: RootElementIdentity,
) => {
  const normalized = selector.trim();
  if (!normalized || /[\s>+~]/.test(normalized)) return false;
  if (normalized.includes(":")) return false;

  const tagMatch = normalized.match(/^[a-z][\w:-]*/i);
  const tagName = tagMatch?.[0]?.toLowerCase();
  if (tagName && tagName !== root.tagName) return false;

  const idMatches = Array.from(normalized.matchAll(/#([\w-]+)/g)).map(
    (item) => item[1],
  );
  if (idMatches.length > 1) return false;
  if (idMatches.length === 1 && idMatches[0] !== root.id) return false;

  const classMatches = Array.from(normalized.matchAll(/\.([\w-]+)/g)).map(
    (item) => item[1],
  );
  if (
    classMatches.length > 0 &&
    !classMatches.every((className) => root.classNames.includes(className))
  ) {
    return false;
  }

  if (!tagName && idMatches.length === 0 && classMatches.length === 0) {
    return false;
  }

  if (!root.id && idMatches.length > 0) return false;

  return true;
};

const selectorTargetsDocumentRoot = (selector: string) => {
  const normalized = selector.trim().toLowerCase();
  return normalized === ":root" || normalized === "html" || normalized === "body";
};

const extractRootBackgroundFromCssTextServerSafe = (
  cssText: string,
  root: RootElementIdentity | null,
): HomePageBackgroundStyle => {
  if (!root) return {};

  const collected: HomePageBackgroundStyle = {};
  const variables: Record<string, string> = {};
  const blocks = parseCssTopLevelBlocks(cssText);

  for (const block of blocks) {
    const selectors = block.prelude
      .split(",")
      .map((selector) => selector.trim());
    const targetsDocument = selectors.some(selectorTargetsDocumentRoot);
    const targetsRoot = selectors.some((selector) =>
      selectorTargetsRootElement(selector, root),
    );

    if (!targetsDocument && !targetsRoot) continue;

    Object.assign(variables, collectCssVariables(block.body));
  }

  for (const block of blocks) {
    const targetsRoot = block.prelude
      .split(",")
      .map((selector) => selector.trim())
      .some((selector) => selectorTargetsRootElement(selector, root));

    if (!targetsRoot) continue;

    Object.assign(collected, applyBackgroundDeclarations(block.body, variables));
  }

  if (root.style) {
    Object.assign(
      collected,
      applyBackgroundDeclarations(root.style, variables),
    );
  }

  return collected;
};

const GLOBAL_ROOT_SELECTOR_PATTERN =
  /^(?::root|html|body)(?=$|[\s>+~.#:[\]])/i;

const scopeGlobalRootSelector = (
  selector: string,
  scopeClass: string,
): string | null => {
  let current = selector.trim();
  let didStripGlobal = false;
  let hasDescendantBoundary = false;
  let combinator = "";

  while (true) {
    const globalMatch = current.match(GLOBAL_ROOT_SELECTOR_PATTERN);
    if (!globalMatch) break;

    didStripGlobal = true;
    current = current.slice(globalMatch[0].length);

    if (!current.trim()) {
      return scopeClass;
    }

    if (/^\s+/.test(current)) {
      hasDescendantBoundary = true;
      current = current.trimStart();
      continue;
    }

    if (/^[>+~]/.test(current)) {
      combinator = current[0];
      current = current.slice(1).trimStart();
      break;
    }

    current = current.trim();
    break;
  }

  if (!didStripGlobal) return null;
  if (!current) return scopeClass;
  if (combinator) return `${scopeClass} ${combinator} ${current}`;
  if (hasDescendantBoundary) return `${scopeClass} ${current}`;
  return `${scopeClass}${current}`;
};

const scopeSelectors = (selectorChunk: string, scopeClass: string) =>
  selectorChunk
    .split(",")
    .map((selector) => selector.trim())
    .filter(Boolean)
    .map((selector) => {
      if (selector.startsWith(scopeClass)) {
        return selector;
      }
      if (selector.startsWith("@")) {
        return selector;
      }

      const scopedGlobalRoot = scopeGlobalRootSelector(selector, scopeClass);
      if (scopedGlobalRoot) {
        return scopedGlobalRoot;
      }

      return `${scopeClass} ${selector}`;
    })
    .join(", ");

const getRuleBodyText = (rule: CSSRule) => {
  const cssText = rule.cssText;
  const startIndex = cssText.indexOf("{");
  const endIndex = cssText.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return "";
  }

  return cssText.slice(startIndex + 1, endIndex).trim();
};

const serializeScopedRule = (rule: CSSRule, scopeClass: string): string => {
  if (rule.type === CSSRule.STYLE_RULE) {
    const styleRule = rule as CSSStyleRule;
    const scopedSelector = scopeSelectors(styleRule.selectorText, scopeClass);
    if (!scopedSelector) return "";
    return `${scopedSelector} { ${styleRule.style.cssText} }`;
  }

  if (rule.type === CSSRule.KEYFRAMES_RULE) {
    return rule.cssText;
  }

  if (rule.type === CSSRule.MEDIA_RULE) {
    const mediaRule = rule as CSSMediaRule;
    const nested = Array.from(mediaRule.cssRules)
      .map((childRule) => serializeScopedRule(childRule, scopeClass))
      .filter(Boolean)
      .join(" ");

    if (!nested) return "";
    return `@media ${mediaRule.conditionText} { ${nested} }`;
  }

  if (rule.type === CSSRule.SUPPORTS_RULE) {
    const supportsRule = rule as CSSSupportsRule;
    const nested = Array.from(supportsRule.cssRules)
      .map((childRule) => serializeScopedRule(childRule, scopeClass))
      .filter(Boolean)
      .join(" ");

    if (!nested) return "";
    return `@supports ${supportsRule.conditionText} { ${nested} }`;
  }

  if (rule.type === CSSRule.FONT_FACE_RULE) {
    return rule.cssText;
  }

  const body = getRuleBodyText(rule);
  if (!body) return rule.cssText;

  const nested = scopeCss(body, scopeClass);
  if (!nested) return "";

  const header = rule.cssText.slice(0, rule.cssText.indexOf("{")).trim();
  return `${header} { ${nested} }`;
};

const scopeCssServer = (css: string, scopeClass: string): string => {
  const sanitized = sanitizeCss(css);
  if (!sanitized) return "";

  return parseCssTopLevelBlocks(sanitized)
    .map((block) => {
      if (/^@(?:-webkit-)?keyframes\b/i.test(block.prelude)) {
        return block.cssText;
      }
      if (/^@font-face\b/i.test(block.prelude)) {
        return block.cssText;
      }

      if (/^@(?:media|supports)\b/i.test(block.prelude)) {
        const inner = scopeCssServer(block.body, scopeClass);
        return inner ? `${block.prelude} { ${inner} }` : "";
      }

      if (block.prelude.startsWith("@")) {
        return block.cssText;
      }

      const scopedSelectors = scopeSelectors(block.prelude, scopeClass);
      if (!scopedSelectors) return "";
      return `${scopedSelectors} { ${block.body} }`;
    })
    .filter(Boolean)
    .join("\n");
};

const scopeCss = (css: string, scopeClass: string) => {
  if (typeof document === "undefined") {
    return scopeCssServer(css, scopeClass);
  }

  const styleElement = document.createElement("style");
  styleElement.textContent = css;
  document.head.appendChild(styleElement);

  try {
    const sheet = styleElement.sheet as CSSStyleSheet | null;
    if (!sheet) return css.trim();

    return Array.from(sheet.cssRules)
      .map((rule) => serializeScopedRule(rule, scopeClass))
      .filter(Boolean)
      .join("\n")
      .trim();
  } catch {
    return css.trim();
  } finally {
    styleElement.remove();
  }
};

const sanitizeNode = (
  node: Node,
  document: Document,
  collectedStyles: string[],
  collectedHeadHtml: string[],
): Node | null => {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (tagName === "style") {
    const safeCss = sanitizeCss(element.textContent ?? "");
    if (safeCss) {
      collectedStyles.push(safeCss);
    }
    return null;
  }

  if (tagName === "link") {
    const rel = (element.getAttribute("rel") ?? "").trim().toLowerCase();
    const href = element.getAttribute("href") ?? "";

    if (!href || !isSafeUrl(href)) {
      return null;
    }

    if (!["stylesheet", "preconnect"].includes(rel)) {
      return null;
    }

    const cleanLink = document.createElement("link");
    cleanLink.setAttribute("rel", rel);
    cleanLink.setAttribute("href", href);

    const crossorigin = element.getAttribute("crossorigin");
    if (crossorigin !== null) {
      cleanLink.setAttribute("crossorigin", crossorigin);
    }

    const type = element.getAttribute("type");
    if (type) {
      cleanLink.setAttribute("type", type);
    }

    collectedHeadHtml.push(cleanLink.outerHTML);
    return null;
  }

  if (!ALLOWED_TAGS.has(tagName)) {
    const fragment = document.createDocumentFragment();
    for (const child of Array.from(element.childNodes)) {
      const sanitizedChild = sanitizeNode(
        child,
        document,
        collectedStyles,
        collectedHeadHtml,
      );
      if (sanitizedChild) fragment.appendChild(sanitizedChild);
    }
    return fragment;
  }

  const cleanElement = document.createElement(tagName);
  const allowedAttrs = TAG_ATTRS[tagName] ?? new Set<string>();

  for (const attribute of Array.from(element.attributes)) {
    const attrName = attribute.name.toLowerCase();
    const attrValue = attribute.value;
    const normalizedAttrValue = normalizeAttributeValue(attrValue);

    if (attrName.startsWith("on")) continue;
    if (!GLOBAL_ATTRS.has(attrName) && !allowedAttrs.has(attrName)) continue;

    if (
      (attrName === "href" || attrName === "src") &&
      !isSafeUrl(normalizedAttrValue)
    ) {
      continue;
    }

    if (attrName === "style") {
      const safeStyle = sanitizeStyleValue(normalizedAttrValue);
      if (!safeStyle) continue;
      cleanElement.setAttribute("style", safeStyle);
      continue;
    }

    if (tagName === "a" && attrName === "target") {
      const safeTarget = normalizedAttrValue === "_blank" ? "_blank" : "_self";
      cleanElement.setAttribute("target", safeTarget);
      if (safeTarget === "_blank") {
        cleanElement.setAttribute("rel", "noopener noreferrer");
      }
      continue;
    }

    cleanElement.setAttribute(attrName, normalizedAttrValue);
  }

  for (const child of Array.from(element.childNodes)) {
    const sanitizedChild = sanitizeNode(
      child,
      document,
      collectedStyles,
      collectedHeadHtml,
    );
    if (sanitizedChild) cleanElement.appendChild(sanitizedChild);
  }

  return cleanElement;
};

const TAILWIND_UTILITY_MAP: Record<string, string> = {
  "max-w-3xl": "max-width: 48rem;",
  "mx-auto": "margin-left: auto; margin-right: auto;",
  "py-8": "padding-top: 2rem; padding-bottom: 2rem;",
  "mb-10": "margin-bottom: 2.5rem;",
  "mt-12": "margin-top: 3rem;",
  "mb-8": "margin-bottom: 2rem;",
  "mt-10": "margin-top: 2.5rem;",
  "mt-8": "margin-top: 2rem;",
  "mt-1": "margin-top: 0.25rem;",
  "mb-6": "margin-bottom: 1.5rem;",
  "mb-3": "margin-bottom: 0.75rem;",
  "p-4": "padding: 1rem;",
  "p-6": "padding: 1.5rem;",
  "pt-4": "padding-top: 1rem;",
  "text-center": "text-align: center;",
  "text-xl": "font-size: 1.25rem; line-height: 1.75rem;",
  "text-3xl": "font-size: 1.875rem; line-height: 2.25rem;",
  "text-lg": "font-size: 1.125rem; line-height: 1.75rem;",
  "text-sm": "font-size: 0.875rem; line-height: 1.25rem;",
  "text-white": "color: rgb(255 255 255);",
  "text-gray-500": "color: rgb(107 114 128);",
  "text-gray-400": "color: rgb(156 163 175);",
  "text-blue-300": "color: rgb(147 197 253);",
  "text-orange-400": "color: rgb(251 146 60);",
  "text-green-400": "color: rgb(74 222 128);",
  "text-yellow-400": "color: rgb(250 204 21);",
  "font-medium": "font-weight: 500;",
  "font-semibold": "font-weight: 600;",
  "font-bold": "font-weight: 700;",
  "font-extrabold": "font-weight: 800;",
  "leading-relaxed": "line-height: 1.625;",
  "rounded-lg": "border-radius: 0.5rem;",
  "rounded-xl": "border-radius: 0.75rem;",
  "shadow-2xl":
    "box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);",
  "shadow-xl": "box-shadow: 0 20px 25px -5px rgba(0,0,0,0.25), 0 8px 10px -6px rgba(0,0,0,0.25);",
  "border": "border-width: 1px; border-style: solid;",
  "border-t": "border-top-width: 1px; border-top-style: solid;",
  "border-gray-700": "border-color: rgb(55 65 81);",
  "border-blue-700": "border-color: rgb(29 78 216);",
  "bg-gray-800/50": "background-color: rgb(31 41 55 / 0.5);",
  "bg-gray-800/70": "background-color: rgb(31 41 55 / 0.7);",
  "bg-blue-900/50": "background-color: rgb(30 58 138 / 0.5);",
  "bg-blue-700/20": "background-color: rgb(29 78 216 / 0.2);",
  "bg-emerald-700/20": "background-color: rgb(4 120 87 / 0.2);",
  "bg-emerald-700/10": "background-color: rgb(4 120 87 / 0.1);",
  "bg-pink-700/20": "background-color: rgb(190 24 93 / 0.2);",
  "bg-pink-700/10": "background-color: rgb(190 24 93 / 0.1);",
  "bg-yellow-700/20": "background-color: rgb(161 98 7 / 0.2);",
  "border-blue-500/80": "border-color: rgb(59 130 246 / 0.8);",
  "border-emerald-500/80": "border-color: rgb(16 185 129 / 0.8);",
  "border-emerald-500/50": "border-color: rgb(16 185 129 / 0.5);",
  "border-pink-500/80": "border-color: rgb(236 72 153 / 0.8);",
  "border-pink-500/50": "border-color: rgb(236 72 153 / 0.5);",
  "border-yellow-500/80": "border-color: rgb(234 179 8 / 0.8);",
  "text-emerald-300": "color: rgb(110 231 183);",
  "text-pink-300": "color: rgb(249 168 212);",
  "text-yellow-300": "color: rgb(253 224 71);",
  "overflow-hidden": "overflow: hidden;",
  "whitespace-nowrap": "white-space: nowrap;",
  block: "display: block;",
};

const TAILWIND_HOVER_UTILITY_MAP: Record<string, string> = {
  "hover:bg-blue-600": "background-color: rgb(37 99 235);",
  "hover:bg-emerald-600": "background-color: rgb(5 150 105);",
  "hover:bg-pink-600": "background-color: rgb(219 39 119);",
  "hover:bg-yellow-600": "background-color: rgb(202 138 4);",
};

const removeUnsafeScriptBlocks = (html: string) =>
  html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

const removeInlineEventHandlers = (html: string) =>
  html
    .replace(/\son[a-z-]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z-]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, "");

const stripDocumentShellTags = (html: string) =>
  html.replace(/<\/?(?:html|head|body)\b[^>]*>/gi, "");

const buildTailwindUtilityCssServer = (html: string) => {
  const classNames = new Set<string>();
  const classAttrPattern = /\sclass\s*=\s*["']([^"']*)["']/gi;
  let m;
  while ((m = classAttrPattern.exec(html)) !== null) {
    for (const cls of (m[1] || "").split(/\s+/)) {
      if (cls) classNames.add(cls);
    }
  }

  const rules: string[] = [];
  for (const className of classNames) {
    const decl = TAILWIND_UTILITY_MAP[className];
    if (decl) rules.push(`[class~="${className}"] { ${decl} }`);
    const hover = TAILWIND_HOVER_UTILITY_MAP[className];
    if (hover) rules.push(`[class~="${className}"]:hover { ${hover} }`);
  }
  return rules.join("\n");
};

const buildTailwindUtilityCss = (container: HTMLElement) => {
  const classNames = new Set<string>();

  if (container.className) {
    for (const className of container.className.split(/\s+/)) {
      if (className) classNames.add(className);
    }
  }

  for (const element of Array.from(container.querySelectorAll("[class]"))) {
    for (const className of Array.from(element.classList)) {
      if (className) classNames.add(className);
    }
  }

  const rules: string[] = [];

  for (const className of classNames) {
    const declaration = TAILWIND_UTILITY_MAP[className];
    if (declaration) {
      rules.push(`[class~="${className}"] { ${declaration} }`);
    }

    const hoverDeclaration = TAILWIND_HOVER_UTILITY_MAP[className];
    if (hoverDeclaration) {
      rules.push(`[class~="${className}"]:hover { ${hoverDeclaration} }`);
    }
  }

  return rules.join("\n");
};

const extractRawHeadLinks = (html: string) => {
  const matches = html.match(/<link\b[^>]*>/gi) ?? [];
  const accepted: string[] = [];

  for (const match of matches) {
    const relMatch = match.match(/\brel\s*=\s*["']([^"']+)["']/i);
    const hrefMatch = match.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    const crossoriginMatch = match.match(
      /\bcrossorigin\s*=\s*["']([^"']*)["']/i,
    );
    const typeMatch = match.match(/\btype\s*=\s*["']([^"']+)["']/i);

    const rel = (relMatch?.[1] ?? "").trim().toLowerCase();
    const href = normalizeAttributeValue(hrefMatch?.[1] ?? "");

    if (!href || !isSafeUrl(href)) continue;
    if (!["stylesheet", "preconnect"].includes(rel)) continue;

    const attrs = [`rel="${rel}"`, `href="${href}"`];

    if (crossoriginMatch) {
      attrs.push(`crossorigin="${normalizeAttributeValue(crossoriginMatch[1])}"`);
    }

    if (typeMatch) {
      attrs.push(`type="${normalizeAttributeValue(typeMatch[1])}"`);
    }

    accepted.push(`<link ${attrs.join(" ")}>`); 
  }

  return accepted;
};

export const sanitizeHomePageHtmlServerSafe = (
  html: string,
  scopeClass?: string,
) => {
  const withoutScripts = removeUnsafeScriptBlocks(html);
  const sanitizedShell = stripDocumentShellTags(
    removeInlineEventHandlers(withoutScripts),
  );
  const styleTagPattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const collectedStyles = Array.from(sanitizedShell.matchAll(styleTagPattern))
    .map((item) => sanitizeCss(item[1] ?? ""))
    .filter(Boolean);
  const rawHeadLinks = extractRawHeadLinks(sanitizedShell);
  const htmlWithoutStyleAndLinks = sanitizedShell
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .trim();

  const cssParts: string[] = [];
  if (scopeClass) {
    cssParts.push(
      ...collectedStyles.map((s) => scopeCssServer(s, scopeClass)),
    );
    cssParts.push(buildTailwindUtilityCssServer(sanitizedShell));
  } else {
    cssParts.push(...collectedStyles);
  }

  return {
    html: `${rawHeadLinks.join("")}${htmlWithoutStyleAndLinks}`.trim(),
    css: cssParts.filter(Boolean).join("\n").trim(),
  };
};

export const sanitizeHomePageHtml = (html: string | null | undefined, scopeClass: string) => {
  if (!html?.trim()) {
    return { html: "", css: "" };
  }

  if (typeof window === "undefined") {
    return sanitizeHomePageHtmlServerSafe(html, scopeClass);
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, "text/html");
  const cleanDocument = document.implementation.createHTMLDocument("");
  const container = cleanDocument.createElement("div");
  const collectedStyles: string[] = [];
  const collectedHeadHtml: string[] = [];

  for (const child of Array.from(parsed.head.childNodes)) {
    sanitizeNode(child, cleanDocument, collectedStyles, collectedHeadHtml);
  }

  for (const child of Array.from(parsed.body.childNodes)) {
    const sanitizedChild = sanitizeNode(
      child,
      cleanDocument,
      collectedStyles,
      collectedHeadHtml,
    );
    if (sanitizedChild) container.appendChild(sanitizedChild);
  }

  const scopedCss = collectedStyles
    .map((item) => scopeCss(item, scopeClass))
    .filter(Boolean)
    .join("\n");
  const utilityCss = buildTailwindUtilityCss(container);
  const rawHeadLinks = extractRawHeadLinks(html);
  const mergedHeadHtml = [...rawHeadLinks, ...collectedHeadHtml].filter(Boolean);

  return {
    html: `${mergedHeadHtml.join("")}${container.innerHTML.trim()}`.trim(),
    css: [scopedCss.trim(), utilityCss.trim()].filter(Boolean).join("\n"),
  };
};

export const extractHomePageBackground = (
  html: string | null | undefined,
): HomePageBackgroundExtraction => {
  if (!html?.trim()) {
    return { source: "none" };
  }

  const styleTagPattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const stylesheetBackground = Array.from(html.matchAll(styleTagPattern))
    .map((item) => sanitizeCss(item[1] ?? ""))
    .filter(Boolean)
    .join("\n");

  const bodyStyleMatch = html.match(/<body[^>]*style=["']([^"']+)["'][^>]*>/i);
  const inlineBackground = bodyStyleMatch?.[1]
    ? `body { ${bodyStyleMatch[1]} }`
    : "";

  const bodyBackground = extractBackgroundFromCssTextServerSafe(
    [stylesheetBackground, inlineBackground].filter(Boolean).join("\n"),
  );
  if (hasBackgroundDeclarations(bodyBackground)) {
    return { ...bodyBackground, source: "body" };
  }

  const rootBackground = extractRootBackgroundFromCssTextServerSafe(
    stylesheetBackground,
    extractFirstRootElementIdentity(html),
  );
  if (hasBackgroundDeclarations(rootBackground)) {
    return { ...rootBackground, source: "root" };
  }

  return { source: "none" };
};

export const extractHomePageBodyBackground = (
  html: string | null | undefined,
): HomePageBackgroundStyle => {
  const extracted = extractHomePageBackground(html);
  return {
    background: extracted.background,
    backgroundColor: extracted.backgroundColor,
    backgroundImage: extracted.backgroundImage,
    backgroundRepeat: extracted.backgroundRepeat,
    backgroundPosition: extracted.backgroundPosition,
    backgroundSize: extracted.backgroundSize,
  };
};

export const hasHomePageRootBackgroundStyle = (
  html: string | null | undefined,
) => {
  return extractHomePageBackground(html).source === "root";
};

export const hasHomePageBackgroundStyle = (
  html: string | null | undefined,
) => {
  return hasBackgroundDeclarations(extractHomePageBackground(html));
};
