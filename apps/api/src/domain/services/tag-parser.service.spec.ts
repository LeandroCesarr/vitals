import { describe, expect, it } from "vitest";

import { Tag } from "@/domain/entities/tag.entity.js";
import { TagParserService } from "@/domain/services/tag-parser.service.js";

describe("TagParserService", () => {
  it("extracts a structured HTML-comment tag", () => {
    const service = new TagParserService();

    const tags = service.parse("<!-- metric: lint level=1 -->");

    expect(tags).toEqual([new Tag("lint", 1)]);
  });

  it("extracts a free-text bracket tag", () => {
    const service = new TagParserService();

    const tags = service.parse("[sql:2]");

    expect(tags).toEqual([new Tag("sql", 2)]);
  });

  it("extracts both a structured tag and a bracket tag from the same comment", () => {
    const service = new TagParserService();

    const tags = service.parse("<!-- metric: lint level=1 --> and also [security:3]");

    expect(tags).toEqual([new Tag("lint", 1), new Tag("security", 3)]);
  });

  it("returns an empty array when no tag markup is present", () => {
    const service = new TagParserService();

    const tags = service.parse("Looks good to me, nice work!");

    expect(tags).toEqual([]);
  });

  it("normalizes the metric name to lowercase", () => {
    const service = new TagParserService();

    const tags = service.parse("[Lint:1]");

    expect(tags).toEqual([new Tag("lint", 1)]);
  });
});
