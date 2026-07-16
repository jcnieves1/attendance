<?php
/**
 * Minimal, dependency-free XLSX (Excel) writer.
 *
 * Builds a valid .xlsx file — which is just a zip of a handful of small XML
 * parts — using only PHP's built-in ZipArchive extension. No Composer
 * library needed, consistent with the rest of OfficePal having zero external
 * dependencies. Good enough for a single flat sheet of headers + rows, which
 * is all the attendance dashboard export needs.
 */

/** Converts a 0-based column index to a spreadsheet column letter (0->A, 25->Z, 26->AA...). */
function xlsx_col_letter(int $index): string
{
    $letter = '';
    $index++;
    while ($index > 0) {
        $rem = ($index - 1) % 26;
        $letter = chr(65 + $rem) . $letter;
        $index = intdiv($index - 1, 26);
    }
    return $letter;
}

function xlsx_escape(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

/** Builds a single <c> cell element, encoding numbers vs. text appropriately. */
function xlsx_cell(int $colIndex, int $rowNum, $value, bool $bold = false): string
{
    $ref = xlsx_col_letter($colIndex) . $rowNum;
    $style = $bold ? ' s="1"' : ' s="0"';
    if (is_int($value) || is_float($value)) {
        return "<c r=\"$ref\"$style><v>" . $value . '</v></c>';
    }
    $text = xlsx_escape((string) $value);
    return "<c r=\"$ref\"$style t=\"inlineStr\"><is><t xml:space=\"preserve\">$text</t></is></c>";
}

/**
 * Streams a one-sheet .xlsx workbook to the browser and exits.
 *
 * @param string $filename   Suggested download filename (with .xlsx).
 * @param string $sheetTitle Sheet tab name.
 * @param array  $headerRow  List of column header strings (row 1, bold).
 * @param array  $rows       List of rows; each row is a list of scalar cell values.
 */
function send_xlsx_download(string $filename, string $sheetTitle, array $headerRow, array $rows): void
{
    if (!class_exists('ZipArchive')) {
        json_error('xlsx_unavailable', 500, 'The PHP zip extension is required to export Excel files. Ask your host to enable php-zip.');
    }

    $sheetTitle = substr((string) preg_replace('/[\\\\\/\?\*\[\]:]/', ' ', $sheetTitle), 0, 31);
    if ($sheetTitle === '') {
        $sheetTitle = 'Sheet1';
    }

    $tmpPath = tempnam(sys_get_temp_dir(), 'ofcpl_xlsx_');
    if ($tmpPath === false) {
        json_error('xlsx_tmp_failed', 500, 'Could not create a temporary file for the export.');
    }

    $zip = new ZipArchive();
    $zip->open($tmpPath, ZipArchive::OVERWRITE);

    $zip->addFromString('[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' .
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' .
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' .
        '<Default Extension="xml" ContentType="application/xml"/>' .
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' .
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' .
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' .
        '</Types>'
    );

    $zip->addFromString('_rels/.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' .
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' .
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' .
        '</Relationships>'
    );

    $zip->addFromString('xl/_rels/workbook.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' .
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' .
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' .
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' .
        '</Relationships>'
    );

    $zip->addFromString('xl/workbook.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' .
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' .
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' .
        '<sheets><sheet name="' . xlsx_escape($sheetTitle) . '" sheetId="1" r:id="rId1"/></sheets>' .
        '</workbook>'
    );

    $zip->addFromString('xl/styles.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' .
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' .
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' .
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' .
        '<borders count="1"><border/></borders>' .
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0"/></cellStyleXfs>' .
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" xfId="0"/><xf numFmtId="0" fontId="1" xfId="0" applyFont="1"/></cellXfs>' .
        '</styleSheet>'
    );

    $rowsXml = '<row r="1">';
    foreach (array_values($headerRow) as $i => $h) {
        $rowsXml .= xlsx_cell($i, 1, $h, true);
    }
    $rowsXml .= '</row>';

    $rowNum = 2;
    foreach ($rows as $row) {
        $rowsXml .= '<row r="' . $rowNum . '">';
        foreach (array_values($row) as $i => $val) {
            $rowsXml .= xlsx_cell($i, $rowNum, $val);
        }
        $rowsXml .= '</row>';
        $rowNum++;
    }

    $colCount = max(1, count($headerRow));
    $dimensionEnd = xlsx_col_letter($colCount - 1) . max(1, $rowNum - 1);

    $zip->addFromString('xl/worksheets/sheet1.xml',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' .
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' .
        '<dimension ref="A1:' . $dimensionEnd . '"/>' .
        '<sheetData>' . $rowsXml . '</sheetData>' .
        '</worksheet>'
    );

    $zip->close();

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . filesize($tmpPath));
    header('Cache-Control: no-cache, no-store, must-revalidate');
    readfile($tmpPath);
    unlink($tmpPath);
    exit;
}
