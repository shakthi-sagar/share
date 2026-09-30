import { describe, expect, it } from "vitest";
import { detectDelimiter, parseDelimited } from "./csv";

describe("delimited text", () => {
  it("parses quoted fields with delimiters, newlines, and doubled quotes", () => {
    const text = 'name,note\r\n"Smith, J","said ""hi""\nthen left"\nplain,value\n';
    expect(parseDelimited(text, ",", 100)).toEqual({
      rows: [
        ["name", "note"],
        ["Smith, J", 'said "hi"\nthen left'],
        ["plain", "value"],
      ],
      columns: 2,
      truncated: false,
    });
  });

  it("keeps ragged rows, empty fields, and a final row without newline", () => {
    expect(parseDelimited("﻿a,b,c\n1,,\n2", ",", 100)).toEqual({
      rows: [["a", "b", "c"], ["1", "", ""], ["2"]],
      columns: 3,
      truncated: false,
    });
  });

  it("stops at the row limit and reports truncation", () => {
    const parsed = parseDelimited("a\nb\nc\nd\n", ",", 2);
    expect(parsed.rows).toEqual([["a"], ["b"]]);
    expect(parsed.truncated).toBe(true);
  });

  it("detects the delimiter", () => {
    expect(detectDelimiter("a;b;c\n1;2;3", "data.csv")).toBe(";");
    expect(detectDelimiter("a\tb\n", "data.csv")).toBe("\t");
    expect(detectDelimiter("a,b", "data.tsv")).toBe("\t");
    expect(detectDelimiter("single", "x.csv")).toBe(",");
  });
});
