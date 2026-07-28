import { Injectable } from "@nestjs/common";

import { Tag } from "@/domain/entities/tag.entity.js";

const STRUCTURED_TAG_PATTERN = /<!--\s*metric:\s*(\w+)\s+level=(\d+)\s*-->/g;
const BRACKET_TAG_PATTERN = /\[(\w+):(\d+)\]/g;

// Add a new pattern here to support another tag format — each must capture
// exactly two groups: (1) metric name, (2) numeric level.
const TAG_PATTERNS: readonly RegExp[] = [STRUCTURED_TAG_PATTERN, BRACKET_TAG_PATTERN];

@Injectable()
export class TagParserService {
  parse(commentBody: string): Tag[] {
    return TAG_PATTERNS.flatMap((pattern) => this.extractTags(commentBody, pattern));
  }

  private extractTags(commentBody: string, pattern: RegExp): Tag[] {
    return Array.from(
      commentBody.matchAll(pattern),
      (match) => new Tag(match[1]!.toLowerCase(), Number(match[2])),
    );
  }
}
