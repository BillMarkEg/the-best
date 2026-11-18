#!/usr/bin/env python3
"""Keep the website data and the Excel workbook in sync.

    python tools/sync_excel.py

1. Reads the PES-era sheet ("tournments") and writes data/pes_history.json for the website.
   Fix a typo in the sheet, run this, and the site's history/stats update.
2. Copies the eFootball winners from data/efootball.json (managed from the admin
   dashboard, admin.html) into the "eFootball" sheet, so the workbook stays complete.

Requires: pip install openpyxl
"""
import json
import sys
from copy import copy
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.worksheet.table import Table, TableStyleInfo

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "our_tournments.xlsx"
PES_SHEET, EF_SHEET = "tournments", "eFootball"
HEADERS = ["Team", "Description", "player", "number of competitors"]


def clean(value):
    if value is None:
        return ""
    return " ".join(str(value).replace("\xa0", " ").split())


def export_pes_history(wb):
    ws = wb[PES_SHEET]
    header = [clean(c.value).lower() for c in ws[1]]
    col = {name: header.index(name) for name in ("team", "description", "player", "number of competitors")}
    winners = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        team, event, player = (clean(row[col[k]]) for k in ("team", "description", "player"))
        if not (team or event or player):
            continue
        winners.append({
            "n": len(winners) + 1,
            "team": team,
            "event": event,
            "player": player,
            "competitors": clean(row[col["number of competitors"]]),
        })
    out = {
        "source": f"{XLSX.name} / sheet '{PES_SHEET}'",
        "game": "PES",
        "note": "PES era (PES 2012 to PES 2021). Rows are in sheet order, oldest first.",
        "winners": winners,
    }
    path = ROOT / "data" / "pes_history.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {path.relative_to(ROOT)}: {len(winners)} PES-era titles")


def copy_style(dst, src):
    dst.font, dst.alignment, dst.border = copy(src.font), copy(src.alignment), copy(src.border)
    dst.fill, dst.protection, dst.number_format = copy(src.fill), copy(src.protection), src.number_format


def write_efootball_sheet(wb):
    data = json.loads((ROOT / "data" / "efootball.json").read_text(encoding="utf-8"))
    rows = [[w.get("team", ""), w.get("event") or "eFootball", w.get("player", ""), w.get("competitors") or None]
            for w in data.get("winners", [])]
    pes = wb[PES_SHEET]
    if EF_SHEET not in wb.sheetnames:
        ws = wb.create_sheet(EF_SHEET)
        for c, h in enumerate(HEADERS, start=1):
            copy_style(ws.cell(1, c, h), pes.cell(1, c))
        for letter, dim in pes.column_dimensions.items():
            ws.column_dimensions[letter].width = dim.width
        ws.freeze_panes = "A2"
    ws = wb[EF_SHEET]

    # Rewrite the data rows from the website data (oldest first, like the PES sheet).
    for r in range(2, max(ws.max_row, len(rows) + 1) + 1):
        for c in range(1, 5):
            ws.cell(r, c).value = None
    for r, row in enumerate(rows, start=2):
        for c, value in enumerate(row, start=1):
            cell = ws.cell(r, c, value)
            copy_style(cell, pes.cell(2, c))

    last = max(len(rows) + 1, 2)
    if "efootball" in ws.tables:
        ws.tables["efootball"].ref = f"A1:D{last}"
    else:
        table = Table(displayName="efootball", ref=f"A1:D{last}")
        table.tableStyleInfo = TableStyleInfo(name="tournments-style", showFirstColumn=True, showLastColumn=True,
                                              showRowStripes=True, showColumnStripes=False)
        ws.add_table(table)
    print(f"Updated sheet '{EF_SHEET}': {len(rows)} eFootball titles")


def main():
    wb = load_workbook(XLSX)
    export_pes_history(wb)
    write_efootball_sheet(wb)
    try:
        wb.save(XLSX)
    except PermissionError:
        sys.exit(f"Could not save {XLSX.name} - close it in Excel and run again.")
    print(f"Saved {XLSX.name}")


if __name__ == "__main__":
    main()
