export async function createAndPushToGoogleSheet(
  title: string,
  data: any[],
  accessToken: string
) {
  if (!accessToken) {
    throw new Error('Missing Google Access Token. Vui lòng đăng nhập lại.');
  }

  // 1. Create a new Spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title || 'Scraped Data',
      },
    }),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json();
    throw new Error(errorData.error?.message || 'Lỗi tạo bảng Google Sheets');
  }

  const spreadSheet = await createRes.json();
  const spreadsheetId = spreadSheet.spreadsheetId;
  const sheetName = spreadSheet.sheets[0].properties.title;

  if (!data || data.length === 0) {
     return spreadSheet.spreadsheetUrl;
  }

  // 2. Prepare data for insertion
  // We assume 'data' is an array of objects
  const headers = Object.keys(data[0]);
  const values = [
    headers,
    ...data.map((row) => headers.map((header) => {
        let val = row[header];
        if (typeof val === 'object') return JSON.stringify(val);
        if (val === null || val === undefined) return '';
        return String(val);
    })),
  ];

  // 3. Write data to Spreadsheet
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${sheetName}!A1`,
        majorDimension: 'ROWS',
        values: values,
      }),
    }
  );

  if (!writeRes.ok) {
     const errorData = await writeRes.json();
     throw new Error(errorData.error?.message || 'Lỗi ghi dữ liệu vào Google Sheets');
  }

  return spreadSheet.spreadsheetUrl;
}
