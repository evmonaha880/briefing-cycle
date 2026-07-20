#!/usr/bin/env python3
"""Build record.json — the queryable static index of the briefing-cycle site.

Stdlib only. Parses every live HTML page and emits one entry per section
heading (h1/h2/h3): {page, phase, heading, anchor, text}. `text` is the
normalized visible text from that heading up to the next heading of any
level; `anchor` is the heading element's id (or "" when it has none).

RUN THIS ON EVERY CONTENT CHANGE. record.json is generated, not edited by
hand — a stale index is how "62 min" survived after the ledger dropped it.

    python3 scripts/build_record.py     # rewrites ../record.json in place
"""

import json
import os
from html.parser import HTMLParser

# Page order + phase label. The phase is constant per page (matches the
# site's five-phase spine plus the two framing pages).
PAGES = [
    ("index.html", "Overview"),
    ("1-intake.html", "Intake"),
    ("2-discovery.html", "Discovery"),
    ("3-agenda.html", "Agenda"),
    ("4-delivery.html", "The room"),
    ("5-follow-through.html", "Follow-through"),
    ("sources.html", "Sources"),
]

HEADINGS = ("h1", "h2", "h3")
SKIP_TAGS = ("script", "style")


class RecordParser(HTMLParser):
    def __init__(self, page, phase):
        super().__init__(convert_charrefs=True)
        self.page = page
        self.phase = phase
        self.entries = []
        self.cur = None          # entry being built
        self.mode = None         # 'heading' while inside an h tag, else 'body'
        self.skip_depth = 0      # inside <script>/<style>

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self.skip_depth += 1
            return
        if tag in HEADINGS:
            self._flush()
            anchor = dict(attrs).get("id") or ""
            self.cur = {
                "page": self.page,
                "phase": self.phase,
                "heading": "",
                "anchor": anchor,
                "text": "",
            }
            self.mode = "heading"

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if tag in HEADINGS and self.mode == "heading":
            self.mode = "body"

    def handle_data(self, data):
        if self.skip_depth or self.cur is None:
            return
        if self.mode == "heading":
            self.cur["heading"] += data
        elif self.mode == "body":
            self.cur["text"] += data

    def _flush(self):
        if self.cur is None:
            return
        self.cur["heading"] = " ".join(self.cur["heading"].split())
        self.cur["text"] = " ".join(self.cur["text"].split())
        if self.cur["heading"]:
            self.entries.append(self.cur)
        self.cur = None

    def close(self):
        super().close()
        self._flush()


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    entries = []
    for page, phase in PAGES:
        path = os.path.join(root, page)
        with open(path, encoding="utf-8") as fh:
            html = fh.read()
        p = RecordParser(page, phase)
        p.feed(html)
        p.close()
        entries.extend(p.entries)

    out = {
        "generated": "static index of the briefing-cycle record",
        "entries": entries,
    }
    dest = os.path.join(root, "record.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print(f"wrote {len(entries)} entries -> {dest}")


if __name__ == "__main__":
    main()
