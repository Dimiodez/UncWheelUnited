import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HolidayDraftDecor from "./HolidayDraftDecor";
it("renders a decorative nine-candle Hanukkiah without interactive or animated overlays",()=>{
 const html=renderToStaticMarkup(createElement(HolidayDraftDecor));
 expect((html.match(/class="holiday-candle"/g)||[]).length).toBe(9);
 expect(html).toContain('aria-hidden="true"');
 expect(html).not.toMatch(/<button|<a |<animate|<image/);
});
