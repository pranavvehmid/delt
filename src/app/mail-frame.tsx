"use client";

// The original mail, read live from Gmail and shown in a locked-down frame (never stored).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FullMessage } from "@/lib/gmail";
import { darkenMail, parseColor, type RGB } from "./mail-dark";
import { inlineCids } from "@/lib/attachments";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const linkify = (s: string) =>
  s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

// In dark themes the mail is shown dark (#26). #71: element by element (see mail-dark.ts), on the
// look's own background, so every text passes 4.5:1 and pictures keep their colours.
// "Original colours" turns it off.
const DARK_MAIL_KEY = "delt-mail-original";

/** The colour behind the mail: the first solid background above the frame. */
function pageColour(el: Element | null): RGB {
  for (; el; el = el.parentElement) {
    const c = parseColor(getComputedStyle(el).backgroundColor);
    if (c && c[3] > 0.9) return c.slice(0, 3) as RGB;
  }
  const b = parseColor(getComputedStyle(document.body).backgroundColor);
  return b && b[3] > 0.9 ? (b.slice(0, 3) as RGB) : [0, 0, 0];
}

// The mail runs in a sandbox with no scripts at all; links open outside DELT.
// #32: a mail can't redirect the frame (meta refresh) or change where its links point (<base>).
export const cleanMailHtml = (html: string) =>
  html
    .replace(/<meta[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "");
/** Does the mail load anything from the internet (images, stylesheets, backgrounds)? */
export const hasRemoteContent = (html: string | null) =>
  !!html &&
  // pictures, backgrounds and stylesheets; a plain link (<a href>) loads nothing until it's tapped (#71)
  /(?<![\w-])(src|background)\s*=\s*["']?\s*(https?:)?\/\/|<link\b[^>]*\bhref\s*=\s*["']?\s*(https?:)?\/\/|url\(\s*["']?\s*(https?:)?\/\//i.test(html);

const DEFAULT_READING = { large: false, scale: 1, lineHeight: "", dyslexic: false };

let readingFont: Promise<string> | undefined;
function loadReadingFont() {
  // Fetch the bundled font in DELT, then embed it in the mail to keep its font-src data-only.
  readingFont ??= fetch("/fonts/OpenDyslexic-Regular.woff2").then(async (response) => {
    if (!response.ok) throw new Error("Reading font unavailable");
    const font = new Blob([await response.arrayBuffer()], { type: "font/woff2" });
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(font);
    });
  }).catch((error: unknown) => {
    readingFont = undefined;
    throw error;
  });
  return readingFont;
}

// #32: by default nothing is fetched from the sender's servers (no tracking pixels, no IP or
// read-time leak). "Load images" allows images only, never scripts or connections.
function frameDoc(m: FullMessage, id: string, darkBg: string | null, remote: boolean, large: boolean, font: string) {
  const body = m.html
    ? inlineCids(cleanMailHtml(m.html), id, m.attachments)
    : `<pre>${linkify(esc(m.text ?? "(This mail has no readable text.)"))}</pre>`;
  // #72: pictures inside the mail come from DELT itself (Gmail, via the attachment route), so they always load
  const self = typeof location === "undefined" ? "" : ` ${location.origin}`;
  const img = remote ? `img-src data:${self} https: http:` : `img-src data:${self}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; ${img}; style-src 'unsafe-inline'; font-src data:; script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; connect-src 'none'; media-src 'none'">
<base target="_blank">
<style>
  html,body{margin:0;background:#fff;color:#1d1b22}
  body{padding:18px 16px 28px;font:${large ? 17.5 : 15.5}px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:anywhere}
  img{max-width:100%!important;height:auto!important} table{max-width:100%!important} td{word-break:break-word}
  a{color:#5b3fd6} pre{white-space:pre-wrap;font:${large ? 17.5 : 15}px/1.6 system-ui,sans-serif;margin:0}
  blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#555}
${darkBg ? `html,body{background:${darkBg};color:#e9e9ec} a{color:#a9b8ff} blockquote{border-left-color:#555;color:#bbb}` : ""}
${font ? `@font-face{font-family:DELTReading;src:url("${font}") format("woff2");font-display:swap}` : ""}
</style></head><body>${body}</body></html>`;
}

/** One mail's content. Give it a `key` per mail so "Load images" resets for the next one. */
export default function MailFrame({ id, msg }: { id: string; msg: FullMessage }) {
  const [height, setHeight] = useState(96);
  const frame = useRef<HTMLIFrameElement>(null);
  const styled = useRef<Document | null>(null);
  const [reading, setReading] = useState(DEFAULT_READING);
  const [font, setFont] = useState("");
  // dark mail in dark themes, unless the student asked for the original colours
  const [darkTheme, setDarkTheme] = useState(false);
  const [original, setOriginal] = useState(false);
  const [remote, setRemote] = useState(false); // #32: images load only when asked
  useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      const { theme, size, mailSize, mailFont, mailSpacing } = root.dataset;
      const scale = mailSize === "largest" ? 1.4 : mailSize === "larger" ? 1.2 : 1;
      setDarkTheme(theme === "dark");
      setReading({
        large: scale === 1 && size === "large",
        scale,
        lineHeight: mailSpacing === "wide" ? "2" : mailSpacing === "relaxed" ? "1.8" : "",
        dyslexic: mailFont === "opendyslexic",
      });
    };
    read();
    try {
      setOriginal(localStorage.getItem(DARK_MAIL_KEY) === "1");
    } catch {}
    const watch = new MutationObserver(read);
    watch.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "data-tone", "data-look", "data-size", "data-mail-size", "data-mail-font", "data-mail-spacing"],
    });
    return () => watch.disconnect();
  }, []);
  useEffect(() => {
    if (!reading.dyslexic) return;
    let active = true;
    void loadReadingFont().then((data) => { if (active) setFont(data); }).catch(() => {});
    return () => { active = false; };
  }, [reading.dyslexic]);
  const embeddedFont = reading.dyslexic ? font : "";
  const dimMail = darkTheme && !original;
  const [bg, setBg] = useState("rgb(0,0,0)");
  useLayoutEffect(() => {
    if (dimMail && frame.current) setBg(`rgb(${pageColour(frame.current.parentElement).join(",")})`);
  }, [dimMail, darkTheme]);
  const toggleOriginal = () => {
    setOriginal((o) => {
      try {
        localStorage.setItem(DARK_MAIL_KEY, o ? "0" : "1");
      } catch {}
      return !o;
    });
  };

  // Grow the frame to the mail's own height, so the whole mail scrolls as one page.
  function fit() {
    const doc = frame.current?.contentDocument;
    if (!doc?.body) return;
    if (styled.current !== doc) {
      styled.current = doc;
      if (reading.scale !== 1 || reading.lineHeight || embeddedFont) {
        const elements = [doc.body, ...doc.body.querySelectorAll<HTMLElement>(":not(svg, svg *, style, script)")];
        // Read all sizes before writing styles so a sender's relative sizes scale only once.
        const sizes = reading.scale === 1 ? [] : elements.map((el) => parseFloat(doc.defaultView!.getComputedStyle(el).fontSize));
        elements.forEach((el, i) => {
          if (Number.isFinite(sizes[i])) el.style.setProperty("font-size", `${sizes[i] * reading.scale}px`, "important");
          if (reading.lineHeight) el.style.setProperty("line-height", reading.lineHeight, "important");
          if (embeddedFont) el.style.setProperty("font-family", "DELTReading, system-ui, sans-serif", "important");
        });
        if (embeddedFont) void doc.fonts.ready.then(() => {
          if (frame.current?.contentDocument === doc) fit();
        });
      }
    }
    // Keys pressed while focus is inside the mail (a link in it) belong to that document, not DELT's.
    // Pass Esc and J/K on so the mail still closes and steps from there, and F6 to get back to the list (#236).
    if (!doc.body.dataset.keys) {
      doc.body.dataset.keys = "1";
      doc.addEventListener("keydown", (e) => {
        if (e.key !== "Escape" && e.key !== "j" && e.key !== "k" && e.key !== "F6") return;
        const passed = new KeyboardEvent("keydown", { key: e.key, bubbles: true, cancelable: true });
        if (!document.dispatchEvent(passed)) e.preventDefault();
        if (e.key === "Escape") frame.current?.focus();
      });
    }
    if (dimMail && !doc.body.dataset.dark) {
      doc.body.dataset.dark = "1";
      darkenMail(doc, parseColor(bg)!.slice(0, 3) as RGB);
    }
    // The mail's own height (#45). documentElement.scrollHeight is never smaller than the frame,
    // so a short mail used to keep the frame's starting height and leave a tall empty box.
    const body = doc.body,
      m = doc.defaultView?.getComputedStyle(body);
    const content =
      Math.max(body.scrollHeight, body.getBoundingClientRect().height) +
      (m ? parseFloat(m.marginTop) + parseFloat(m.marginBottom) : 0);
    setHeight(Math.max(96, Math.ceil(content)));
    doc
      .querySelectorAll("img")
      .forEach(
        (img) =>
          img.complete || img.addEventListener("load", fit, { once: true }),
      );
  }

  return (
    <>
      {!remote && hasRemoteContent(msg.html) && (
        <p className="mv-remote">
          <span className="muted">
            Images are hidden so the sender can&apos;t tell you opened this.
          </span>{" "}
          <button className="link" onClick={() => setRemote(true)}>
            Load images
          </button>
        </p>
      )}
      {darkTheme && (
        <button
          className="mv-colours link"
          onClick={toggleOriginal}
          aria-pressed={original}
        >
          {original ? "Show dark" : "Original colours"}
        </button>
      )}
      <iframe
        key={`${reading.scale}-${reading.lineHeight}`}
        ref={frame}
        title="Mail content"
        className={`mv-frame ${dimMail ? "dim" : ""}`}
        // same-origin only so the height can be measured; no allow-scripts, so nothing in the mail can run
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        srcDoc={frameDoc(msg, id, dimMail ? bg : null, remote, reading.large, embeddedFont)}
        onLoad={fit}
        style={{ height }}
      />
    </>
  );
}
