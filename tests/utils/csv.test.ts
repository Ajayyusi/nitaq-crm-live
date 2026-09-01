/**
 * CSV escaping used to live in five places with three different regexes.
 * Four of them tested /[",\n]/ and so left a bare carriage return unquoted —
 * Excel and Sheets both read a lone \r as a row break, which silently shifts
 * every column after it. These tests pin the consolidated behaviour so the
 * strict version cannot regress back to the lenient one.
 */
import { describe, it, expect } from "vitest";
import { csvEscape, toCsv } from "@/lib/utils";

/** Minimal RFC 4180 reader, used to prove the output round-trips. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { quoted = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = ""; i++; continue;
    }
    field += c; i++;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

describe("csvEscape", () => {
  it("leaves ordinary values alone", () => {
    expect(csvEscape("Fatima")).toBe("Fatima");
    expect(csvEscape(2500)).toBe("2500");
  });

  it("renders null and undefined as empty, not as the word", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("quotes commas and doubles embedded quotes", () => {
    expect(csvEscape("Dubai, UAE")).toBe('"Dubai, UAE"');
    expect(csvEscape('He said "yes"')).toBe('"He said ""yes"""');
  });

  it("quotes a bare carriage return — the bug the old copies shared", () => {
    expect(csvEscape("line one\rline two")).toBe('"line one\rline two"');
  });

  it("quotes line feeds and CRLF", () => {
    expect(csvEscape("a\nb")).toBe('"a\nb"');
    expect(csvEscape("a\r\nb")).toBe('"a\r\nb"');
  });
});

describe("toCsv", () => {
  it("round-trips every awkward character a notes field can hold", () => {
    const headers = ["Name", "Notes", "Balance"];
    const rows = [
      ["Fatima Al Hashimi", 'Asked about the "weekend" batch, wants a discount', 2500],
      ["Divanshu Kumar", "Called\rNo answer", -40.5],
      ["Sara, M.", "Line one\nLine two", 0],
    ];

    const parsed = parseCsv(toCsv(headers, rows));

    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toEqual(headers);
    expect(parsed[1]).toEqual([
      "Fatima Al Hashimi",
      'Asked about the "weekend" batch, wants a discount',
      "2500",
    ]);
    // The row that the lenient escaper split in two
    expect(parsed[2]).toEqual(["Divanshu Kumar", "Called\rNo answer", "-40.5"]);
    expect(parsed[3]).toEqual(["Sara, M.", "Line one\nLine two", "0"]);
  });

  it("escapes header cells too", () => {
    expect(toCsv(["Total, AED"], [])).toBe('"Total, AED"');
  });
});
