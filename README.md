# GSX 狀態檢查 WEB (GSXStatusCheckWeb)

![Version](https://img.shields.io/badge/Version-v1.1-cyan?style=flat-square)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)

[GSX-Status-Check](https://github.com/hsiao840412/GSX-Status-Check/) 的網頁版，擺脫系統依賴方便使用

簡單的 Web 工具，用來比對 **SA 報表** 與 **GSX 檔案**。它能自動抓出那些「SA 已經領回但 GSX 還沒關單」或是「SA 已經修好但 GSX 狀態還沒改」的案件。

### 🛠 使用方法
1. **載入檔案**：直接將 SA 報表與 GSX 報表拖入對應框格。
2. **點擊分析**：按下「開始分析數據」，系統會自動對齊單號。
3. **處理異常**：
   * **未關單**：顯示應關單而未關的項目，支援一鍵複製單號或點擊圖示跳轉 GSX。
   * **匯出功能**：勾選項目後可匯出 CSV，直接用於 GSX 批次上傳。

### 📌 注意事項
* **欄位需求**：SA 報表必須包含「單號、狀態」；GSX 報表必須包含「採購訂單、維修、維修狀態」。
