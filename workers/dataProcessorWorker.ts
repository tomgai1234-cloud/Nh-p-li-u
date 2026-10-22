import * as XLSX from 'xlsx';
import Papa from 'papaparse';

function toTitleCase(text: string): string {
    const isAllUpperCase = text === text.toUpperCase();
    return text.split(/([\s\-_/]+)/).map(word => {
        if (/^[\s\-_/]+$/.test(word)) return word;
        
        if (/\d/.test(word)) {
            return word.replace(/^([^\p{L}]*)(\p{L})(.*)$/u, (m, p1, p2, p3) => {
                return p1 + p2.toUpperCase() + p3; 
            });
        }
        
        if (isAllUpperCase) {
            return word.replace(/^([^\p{L}]*)(\p{L})(.*)$/u, (m, p1, p2, p3) => {
                return p1 + p2.toUpperCase() + p3.toLowerCase();
            });
        }
        
        const lettersOnly = word.replace(/[^\p{L}]/gu, '');
        if (lettersOnly === lettersOnly.toUpperCase() && lettersOnly.length > 1) {
            return word;
        }
        
        return word.replace(/^([^\p{L}]*)(\p{L})(.*)$/u, (m, p1, p2, p3) => {
            return p1 + p2.toUpperCase() + p3.toLowerCase();
        });
    }).join('');
}

self.onmessage = async (e) => {
  const { fileData, isCSV, fileName, operations, exportFormat, previewData, isPreview } = e.data;
  
  try {
    let rawData: any[][] = [];
    let headers: string[] = [];

    if (isPreview && previewData) {
      rawData = previewData;
    } else {
      if (isCSV) {
        const text = new TextDecoder().decode(fileData);
        const result = Papa.parse(text, { skipEmptyLines: false, header: false });
        rawData = result.data as any[][];
      } else {
        const workbook = XLSX.read(fileData, { type: 'array', cellStyles: false, cellDates: false });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) throw new Error("Không tìm thấy sheet nào.");
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
      }
    }

    if (rawData.length === 0) throw new Error("File không có dữ liệu.");

    headers = rawData[0].map(String);
    let processedData = rawData.slice(1);

    // Apply operations sequentially
    for (const op of operations) {
      if (op.type === 'fill_down') {
        const colIndices = op.columns && op.columns.length > 0 
          ? op.columns.map((c: string) => headers.indexOf(c)).filter((i: number) => i >= 0)
          : headers.map((_, i) => i);

        const groupColIdx = op.conditionColumn ? headers.indexOf(op.conditionColumn) : -1;

        let lastValues: any[] = new Array(headers.length).fill('');
        for (let i = 0; i < processedData.length; i++) {
          const isRowEmpty = processedData[i].every((val: any) => val === null || val === undefined || String(val).trim() === '');
          if (isRowEmpty) {
            continue; // Do not fill down completely empty rows
          }

          const groupValue = groupColIdx >= 0 ? processedData[i][groupColIdx] : null;
          const isNewGroup = groupColIdx >= 0 && groupValue !== null && groupValue !== undefined && String(groupValue).trim() !== '';

          if (isNewGroup) {
            // Reset last values for this new group
            lastValues = new Array(headers.length).fill('');
          }

          for (const colIdx of colIndices) {
            const cellValue = processedData[i][colIdx];
            if (cellValue === null || cellValue === undefined || String(cellValue).trim() === '') {
              processedData[i][colIdx] = lastValues[colIdx];
            } else {
              lastValues[colIdx] = cellValue;
            }
          }
        }
      } 
      else if (op.type === 'extract_text') {
        const srcIdx = headers.indexOf(op.sourceColumn);
        if (srcIdx >= 0) {
          headers.push(op.newColumnName);
          const newColIdx = headers.length - 1;
          
          for (let i = 0; i < processedData.length; i++) {
            const val = String(processedData[i][srcIdx] || '');
            let newVal = '';
            if (op.method === 'left') {
              newVal = val.substring(0, Number(op.param1) || 0);
            } else if (op.method === 'right') {
              newVal = val.substring(val.length - (Number(op.param1) || 0));
            } else if (op.method === 'split') {
              const parts = val.split(String(op.param1 || ''));
              const partIdx = Number(op.param2) || 0;
              newVal = parts[partIdx] || '';
            }
            processedData[i][newColIdx] = newVal;
          }
        }
      }
      else if (op.type === 'add_column') {
        headers.push(op.columnName);
        const newColIdx = headers.length - 1;
        for (let i = 0; i < processedData.length; i++) {
          processedData[i][newColIdx] = op.defaultValue || '';
        }
      }
      else if (op.type === 'remove_columns') {
         const colIndicesToRemove = (op.columns || []).map((c: string) => headers.indexOf(c)).filter((i: number) => i >= 0).sort((a: number, b: number) => b - a);
         for (const idx of colIndicesToRemove) {
             headers.splice(idx, 1);
         }
         for (let i = 0; i < processedData.length; i++) {
             for (const idx of colIndicesToRemove) {
                 processedData[i].splice(idx, 1);
             }
         }
      }
      else if (op.type === 'remove_empty_rows') {
        const colIndices = op.columns && op.columns.length > 0 
          ? op.columns.map((c: string) => headers.indexOf(c)).filter((i: number) => i >= 0)
          : headers.map((_, i) => i);
          
        processedData = processedData.filter(row => {
           return colIndices.some((idx: number) => {
               const cell = row[idx];
               return cell !== null && cell !== undefined && String(cell).trim() !== '';
           });
        });
      }
      else if (op.type === 'trim_whitespace') {
        const colIndices = op.columns && op.columns.length > 0 
          ? op.columns.map((c: string) => headers.indexOf(c)).filter((i: number) => i >= 0)
          : headers.map((_, i) => i);
          
        for (let i = 0; i < processedData.length; i++) {
          for (const idx of colIndices) {
            if (processedData[i][idx] != null) {
              processedData[i][idx] = String(processedData[i][idx]).trim();
            }
          }
        }
      }
      else if (op.type === 'remove_duplicates') {
        const colIndices = op.columns && op.columns.length > 0 
          ? op.columns.map((c: string) => headers.indexOf(c)).filter((i: number) => i >= 0)
          : headers.map((_, i) => i);
          
        const seen = new Set<string>();
        processedData = processedData.filter(row => {
          const key = colIndices.map((idx: number) => String(row[idx] || '')).join('|');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      else if (op.type === 'text_standardization') {
        const colIndices = op.columns && op.columns.length > 0 
          ? op.columns.map((c: string) => headers.indexOf(c)).filter((i: number) => i >= 0)
          : headers.map((_, i) => i);
          
        for (let i = 0; i < processedData.length; i++) {
          for (const idx of colIndices) {
            const val = processedData[i][idx];
            if (val != null && String(val).trim() !== '') {
              const strVal = String(val);
              if (op.method === 'lowercase') {
                processedData[i][idx] = strVal.toLowerCase();
              } else if (op.method === 'uppercase') {
                processedData[i][idx] = strVal.toUpperCase();
              } else if (op.method === 'titlecase') {
                processedData[i][idx] = toTitleCase(strVal);
              }
            }
          }
        }
      }
      else if (op.type === 'convert_to_png') {
        const colIndices = op.columns && op.columns.length > 0 
          ? op.columns.map((c: string) => headers.indexOf(c)).filter((i: number) => i >= 0)
          : headers.map((_, i) => i);
          
        for (let i = 0; i < processedData.length; i++) {
          for (const idx of colIndices) {
            const val = processedData[i][idx];
            if (val != null && String(val).trim() !== '') {
              let strVal = String(val).trim();
              strVal = strVal.split(/([\s,]+)/).map(part => {
                if (part.trim() === '') return part;
                try {
                  const url = new URL(part);
                  url.pathname = url.pathname.replace(/\.[a-zA-Z0-9]+$/, '.png');
                  return url.toString();
                } catch (e) {
                  return part.replace(/\.[a-zA-Z0-9]+$/, '.png');
                }
              }).join('');
              processedData[i][idx] = strVal;
            }
          }
        }
      }
    }

    const finalData = [headers, ...processedData];

    if (isPreview) {
      self.postMessage({
        success: true,
        previewData: finalData,
      });
      return;
    }

    let outputBlob: Blob;
    const extension = exportFormat === 'csv' ? 'csv' : 'xlsx';

    if (exportFormat === 'csv') {
      const csvOutput = Papa.unparse(finalData);
      outputBlob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
    } else {
      const newWorksheet = XLSX.utils.aoa_to_sheet(finalData);
      const newWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Sheet1');
      const output = XLSX.write(newWorkbook, { bookType: 'xlsx', type: 'array' });
      outputBlob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheet.sheet' });
    }

    const baseName = fileName.split('.').slice(0, -1).join('.') || 'file';
    const finalFileName = `processed_${baseName}.${extension}`;

    self.postMessage({
      success: true,
      blob: outputBlob,
      fileName: finalFileName,
      originalRowCount: rawData.length - 1,
      finalRowCount: processedData.length,
    });

  } catch (error: any) {
    self.postMessage({ success: false, error: error.message || "Lỗi xử lý dữ liệu." });
  }
};
