export interface CustomRichTextContent {
  text?: string;
}

// Same shape and rendering as the Landing domain's CustomRichText (apps/web/src/components/offer/
// sections.tsx) — plain pre-wrap text despite the name, not actual HTML. No default copy: an
// empty section renders nothing.
export function CustomRichText({ content }: { content?: CustomRichTextContent }) {
  if (!content?.text) return null;

  return (
    <section className="mx-auto max-w-page whitespace-pre-wrap px-pad-mobile py-8 font-body text-text-secondary md:px-pad-desktop">
      {content.text}
    </section>
  );
}
