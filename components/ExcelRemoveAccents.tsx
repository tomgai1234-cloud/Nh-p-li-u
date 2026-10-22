import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { FileSpreadsheet, Upload, Download, RefreshCw, CheckSquare, Square, FileText, Sparkles, AlertCircle } from 'lucide-react';
import Button from './Button';
import Spinner from './Spinner';

export const removeVietnameseAccents = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

interface ExcelRemoveAccentsProps {
  onHistorySaved?: () => void;
}

export const ExcelRemoveAccents: React.FC<ExcelRemoveAccentsProps> = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]); // raw 2D array (excluding header row)
  const [selectedColumns, setSelectedColumns] = useState<number[]>([]);
  const [mode, setMode] = useState<'overwrite' | 'new_column'>('overwrite');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      toast.error('Vui lòng chọn file Excel (.xlsx, .xls) hoặc CSV!');
      return;
    }

    setIsLoading(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheets(wb.SheetNames);
        const firstSheet = wb.SheetNames[0];
        setSelectedSheet(firstSheet);
        parseSheet(wb, firstSheet);
        toast.success(`Đã tải file "${file.name}" thành công!`);
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        toast.error('Lỗi khi đọc file Excel. Vui lòng kiểm tra lại định dạng file!');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parseSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    // Convert sheet to 2D array
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (data.length === 0) {
      setHeaders([]);
      setRows([]);
      setSelectedColumns([]);
      return;
    }

    const headerRow = data[0].map((h: any, idx: number) => h ? String(h).trim() : `Cột ${idx + 1}`);
    const dataRows = data.slice(1);

    setHeaders(headerRow);
    setRows(dataRows);

    // Auto select text-like columns (columns that contain non-numeric data)
    const autoCols: number[] = [];
    headerRow.forEach((_, colIdx) => {
      // Check first few rows
      const hasVietnamese = dataRows.slice(0, 10).some(row => {
        const cell = row[colIdx];
        return cell && /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(String(cell));
      });
      if (hasVietnamese) {
        autoCols.push(colIdx);
      }
    });

    // If auto detection didn't find any specific ones, select first column
    setSelectedColumns(autoCols.length > 0 ? autoCols : (headerRow.length > 0 ? [0] : []));
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      parseSheet(workbook, sheetName);
    }
  };

  const toggleColumn = (colIdx: number) => {
    setSelectedColumns(prev =>
      prev.includes(colIdx) ? prev.filter(i => i !== colIdx) : [...prev, colIdx]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(headers.map((_, idx) => idx));
  };

  const deselectAllColumns = () => {
    setSelectedColumns([]);
  };

  const handleReset = () => {
    setFileName(null);
    setWorkbook(null);
    setSheets([]);
    setSelectedSheet('');
    setHeaders([]);
    setRows([]);
    setSelectedColumns([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processData = (): { newHeaders: string[]; newRows: any[][]; modifiedCellsCount: number } => {
    let modifiedCount = 0;

    if (mode === 'overwrite') {
      const newHeaders = [...headers];
      const newRows = rows.map(row => {
        const newRow = [...row];
        selectedColumns.forEach(colIdx => {
          const original = newRow[colIdx];
          if (original !== undefined && original !== null && original !== '') {
            const noAccent = removeVietnameseAccents(original);
            if (noAccent !== String(original)) {
              modifiedCount++;
            }
            newRow[colIdx] = noAccent;
          }
        });
        return newRow;
      });
      return { newHeaders, newRows, modifiedCellsCount: modifiedCount };
    } else {
      // Add new non-accent columns next to original or at the end
      const newHeaders = [...headers];
      const addedIndices: { originalIdx: number; newColIdx: number }[] = [];

      selectedColumns.sort((a, b) => a - b).forEach(colIdx => {
        const newColName = `${headers[colIdx]} (Không Dấu)`;
        newHeaders.push(newColName);
        addedIndices.push({ originalIdx: colIdx, newColIdx: newHeaders.length - 1 });
      });

      const newRows = rows.map(row => {
        const newRow = [...row];
        addedIndices.forEach(({ originalIdx }) => {
          const original = newRow[originalIdx];
          const noAccent = removeVietnameseAccents(original);
          if (original && noAccent !== String(original)) {
            modifiedCount++;
          }
          newRow.push(noAccent);
        });
        return newRow;
      });

      return { newHeaders, newRows, modifiedCellsCount: modifiedCount };
    }
  };

  const handleDownload = () => {
    if (!workbook || headers.length === 0 || selectedColumns.length === 0) {
      toast.error('Vui lòng chọn ít nhất một cột để loại bỏ dấu!');
      return;
    }

    setIsProcessing(true);
    try {
      const { newHeaders, newRows, modifiedCellsCount } = processData();
      const aoa = [newHeaders, ...newRows];

      const newWs = XLSX.utils.aoa_to_sheet(aoa);
      const newWb = XLSX.utils.book_new();
      
      // Copy all other sheets if any, replace selectedSheet
      sheets.forEach(sName => {
        if (sName === selectedSheet) {
          XLSX.utils.book_append_sheet(newWb, newWs, sName);
        } else {
          XLSX.utils.book_append_sheet(newWb, workbook.Sheets[sName], sName);
        }
      });

      const baseName = fileName ? fileName.replace(/\.[^/.]+$/, '') : 'excel_processed';
      const outputFileName = `${baseName}_khong_dau.xlsx`;

      XLSX.writeFile(newWb, outputFileName);
      toast.success(`Đã xuất file thành công! (${modifiedCellsCount} ô đã được chuyển sang không dấu)`);
    } catch (err) {
      console.error('Error exporting excel:', err);
      toast.error('Lỗi khi xuất file Excel. Vui lòng thử lại!');
    } finally {
      setIsProcessing(false);
    }
  };

  const { newHeaders, newRows, modifiedCellsCount } = headers.length > 0 ? processData() : { newHeaders: [], newRows: [], modifiedCellsCount: 0 };

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
      {/* File Upload Header */}
      {!workbook ? (
        <div className="bg-zinc-800/50 p-8 sm:p-12 rounded-2xl border-2 border-dashed border-zinc-700 hover:border-sky-500/50 transition-all text-center space-y-4">
          <div className="w-16 h-16 bg-sky-500/10 text-sky-400 rounded-2xl flex items-center justify-center mx-auto border border-sky-500/20 shadow-lg">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-100">Kéo & thả file Excel/CSV vào đây</h3>
            <p className="text-sm text-zinc-400 mt-1">Hỗ trợ các định dạng .xlsx, .xls, .csv</p>
          </div>
          <div className="pt-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              className="hidden"
              id="excel-file-input"
            />
            <label htmlFor="excel-file-input">
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                isLoading={isLoading}
                colorScheme="sky"
                className="!px-6 !py-3 font-semibold"
              >
                <Upload className="w-5 h-5 mr-2" />
                Tải file Excel từ máy tính
              </Button>
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* File & Sheet Controller Bar */}
          <div className="bg-zinc-800/60 p-5 rounded-2xl border border-zinc-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 text-green-400 rounded-xl border border-green-500/20">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-100 truncate max-w-md">{fileName}</h4>
                <p className="text-xs text-zinc-400">
                  {rows.length} dòng • {headers.length} cột • {modifiedCellsCount} ô sẽ được loại bỏ dấu
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {sheets.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-medium">Sheet:</span>
                  <select
                    value={selectedSheet}
                    onChange={e => handleSheetChange(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  >
                    {sheets.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              <Button onClick={handleReset} colorScheme="slate" size="sm" className="!text-xs">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Đổi file khác
              </Button>

              <Button
                onClick={handleDownload}
                disabled={selectedColumns.length === 0 || isProcessing}
                isLoading={isProcessing}
                colorScheme="green"
                size="sm"
                className="!text-xs font-semibold !py-2 !px-4"
              >
                <Download className="w-4 h-4 mr-1.5" />
                Tải File Excel Không Dấu
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Column Selector */}
            <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 space-y-5 lg:col-span-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sky-300 text-base flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-sky-400" />
                  Chọn cột để loại bỏ dấu
                </h3>
                <span className="text-xs px-2.5 py-1 bg-sky-900/40 text-sky-300 rounded-full border border-sky-500/20 font-medium">
                  Đã chọn {selectedColumns.length}/{headers.length}
                </span>
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                  Chế độ xử lý
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('overwrite')}
                    className={`px-3 py-2 text-xs rounded-xl border transition-all text-left font-medium ${
                      mode === 'overwrite'
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 font-semibold shadow-sm'
                        : 'bg-zinc-900/50 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Ghi đè cột cũ
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('new_column')}
                    className={`px-3 py-2 text-xs rounded-xl border transition-all text-left font-medium ${
                      mode === 'new_column'
                        ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 font-semibold shadow-sm'
                        : 'bg-zinc-900/50 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Tạo cột mới không dấu
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-700/50">
                <button
                  type="button"
                  onClick={selectAllColumns}
                  className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
                >
                  <CheckSquare className="w-3.5 h-3.5" /> Chọn tất cả
                </button>
                <span className="text-zinc-600">•</span>
                <button
                  type="button"
                  onClick={deselectAllColumns}
                  className="text-xs text-zinc-400 hover:text-zinc-300 font-medium flex items-center gap-1"
                >
                  <Square className="w-3.5 h-3.5" /> Bỏ chọn
                </button>
              </div>

              {/* Column Checklist */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                {headers.map((header, idx) => {
                  const isChecked = selectedColumns.includes(idx);
                  const sampleValue = rows.find(r => r[idx])?.[idx] || '';
                  const sampleNoAccent = sampleValue ? removeVietnameseAccents(sampleValue) : '';

                  return (
                    <label
                      key={idx}
                      onClick={() => toggleColumn(idx)}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-sky-950/30 border-sky-500/40 text-zinc-100 shadow-sm'
                          : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent onClick
                        className="mt-0.5 rounded border-zinc-700 text-sky-500 focus:ring-sky-500/20 bg-zinc-800"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate flex items-center justify-between">
                          <span>{header}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">Cột {idx + 1}</span>
                        </div>
                        {sampleValue && (
                          <div className="text-[11px] text-zinc-500 mt-1 truncate">
                            Mẫu: <span className="text-zinc-400 font-mono">{String(sampleValue)}</span>
                            {isChecked && sampleValue !== sampleNoAccent && (
                              <span className="text-sky-400 ml-1 font-mono">➔ {sampleNoAccent}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Right: Preview Table */}
            <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 lg:col-span-2 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-zinc-200 text-base flex items-center gap-2">
                    <FileText className="w-5 h-5 text-sky-400" />
                    Xem trước kết quả (10 dòng đầu)
                  </h3>
                  {selectedColumns.length === 0 && (
                    <span className="text-xs text-amber-400 flex items-center gap-1 font-medium bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      <AlertCircle className="w-3.5 h-3.5" /> Hãy chọn ít nhất 1 cột
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto border border-zinc-700/80 rounded-xl bg-zinc-900/80 max-h-[460px]">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="text-[11px] uppercase bg-zinc-800/80 text-sky-300 sticky top-0 z-10 border-b border-zinc-700">
                      <tr>
                        <th className="px-3 py-2.5 w-12 text-center text-zinc-500">STT</th>
                        {newHeaders.map((h, i) => {
                          const isNewAccCol = mode === 'new_column' && i >= headers.length;
                          const isModifiedCol = selectedColumns.includes(i) || isNewAccCol;
                          return (
                            <th
                              key={i}
                              className={`px-3 py-2.5 font-semibold whitespace-nowrap ${
                                isModifiedCol ? 'text-sky-400 bg-sky-950/40' : 'text-zinc-300'
                              }`}
                            >
                              {h}
                              {isModifiedCol && (
                                <span className="ml-1 text-[9px] px-1 py-0.2 bg-sky-500/20 rounded font-normal">
                                  Không dấu
                                </span>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 font-mono text-[11px]">
                      {newRows.slice(0, 10).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="px-3 py-2 text-center text-zinc-500 font-sans">{rIdx + 1}</td>
                          {newHeaders.map((_, cIdx) => {
                            const val = row[cIdx];
                            const isNewAccCol = mode === 'new_column' && cIdx >= headers.length;
                            const isSelected = selectedColumns.includes(cIdx) || isNewAccCol;

                            return (
                              <td
                                key={cIdx}
                                className={`px-3 py-2 max-w-[200px] truncate ${
                                  isSelected ? 'text-sky-300 bg-sky-950/20 font-medium' : 'text-zinc-300'
                                }`}
                                title={String(val || '')}
                              >
                                {val !== undefined && val !== null ? String(val) : ''}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Info & Action */}
              <div className="pt-3 border-t border-zinc-700/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">
                  Hiển thị <span className="font-semibold text-zinc-200">{Math.min(10, rows.length)}</span> / {rows.length} dòng
                </div>

                <Button
                  onClick={handleDownload}
                  disabled={selectedColumns.length === 0 || isProcessing}
                  isLoading={isProcessing}
                  colorScheme="green"
                  className="w-full sm:w-auto font-semibold !py-2.5 !px-6"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Tải Xuống File Excel Không Dấu
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelRemoveAccents;
