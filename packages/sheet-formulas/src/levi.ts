function syncColors() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName("TOYA REBORN");
  if (!sourceSheet) return;

  const mappings = [
    {
      sourceCell: "T9",
      checkCell: "V9",
      day1Cells: ["A1", "H1", "P1", "D12"],
      dayNCells: ["A1", "H1", "P1", "D27"],
    },
    {
      sourceCell: "T11",
      checkCell: "V11",
      day1Cells: ["D1", "L1", "R1"],
      dayNCells: ["D1", "L1", "R1"],
    },
    {
      sourceCell: "T13",
      checkCell: "V13",
      day1Ranges: ["D2:H2", "K2:O2", "R2:V2"],
      day1Cells: ["A15"],
      dayNRanges: ["D2:H2", "K2:O2", "R2:V2"],
      dayNCells: ["A30"],
    },
    {
      sourceCell: "T14",
      checkCell: "V14",
      day1Ranges: ["A2:C2", "I2", "P2:Q2", "P12"],
      dayNRanges: ["A2:C2", "I2", "P2:Q2", "P27"],
    },
    {
      sourceCell: "T15",
      checkCell: "V15",
      day1Ranges: [
        "D3:D11",
        "E3:E9",
        "F3:F8",
        "G3:G4",
        "K3:O11",
        "R3:V11",
        "A16",
      ],
      dayNRanges: [
        "D3:D26",
        "E3:E24",
        "F3:F23",
        "G3:G19",
        "H3:H17",
        "K3:O26",
        "A31",
        "R3:V26",
      ],
    },
    {
      sourceCell: "T16",
      checkCell: "V16",
      day1Ranges: ["H3:H11", "G5:G11", "F9:F11", "E10:E11"],
      dayNRanges: ["E25:E26", "F24:F26", "G20:G26", "H18:H26"],
    },
    {
      sourceCell: "T17",
      checkCell: "V17",
      day1Ranges: ["A3:C11", "I3:J11", "P3:Q11", "P13"],
      dayNRanges: ["A3:C26", "I3:J26", "P3:Q26", "P28"],
    },
  ];

  for (let day = 1; day <= 9; day++) {
    const daySheet = ss.getSheetByName(`Day ${day}`);
    if (!daySheet) continue;

    for (const map of mappings) {
      const color = sourceSheet.getRange(map.sourceCell).getBackground();
      const isChecked = sourceSheet.getRange(map.checkCell).getValue() === true;
      const clearColor = !isChecked;
      const bgColor = clearColor ? null : color;

      const targetCells =
        day === 1 ? map.day1Cells || [] : map.dayNCells || map.day1Cells || [];

      for (const a1 of targetCells) {
        daySheet.getRange(a1).setBackground(bgColor);
      }

      const targetRanges =
        day === 1
          ? map.day1Ranges || []
          : map.dayNRanges || map.day1Ranges || [];

      for (const rangeStr of targetRanges) {
        const range = daySheet.getRange(rangeStr);
        const numRows = range.getNumRows();
        const numCols = range.getNumColumns();

        const bgArray = Array.from({ length: numRows }, () =>
          Array(numCols).fill(bgColor),
        );

        range.setBackgrounds(bgArray);
      }
    }
  }
}

export function onEdit(e: GoogleAppsScript.Events.SheetsOnEdit) {
  const sheet = e.range.getSheet();
  const cell = e.range.getA1Notation();
  const watchedCells = [
    "V9",
    "V10",
    "V11",
    "V12",
    "V13",
    "V14",
    "V15",
    "V16",
    "V17",
  ];
  if (sheet.getName() === "TOYA REBORN" && watchedCells.includes(cell)) {
    syncColors();
  }
}
