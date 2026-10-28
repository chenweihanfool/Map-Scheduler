import { pool } from "./db";

// 啟動時自動補上 v2.9.0 新增的「收件日期」「收件字」欄位，並把舊格式案號拆回原位。
//
// 不用 drizzle-kit push：資料表另有刻意不宣告的 geom 欄位（見 shared/schema.ts），
// push 可能會把它刪掉。這裡只做「欄位不存在才新增」與「只改符合舊格式的列」，重複執行不會有影響。
//
// 舊格式案號：1150914-81-2400 → 收件日期 2026-09-14（民國 115 年 9 月 14 日）、
// 收件字 81通圖土、案號 2400。
const RECEIVE_WORD_SQL = `CASE split_part(case_number, '-', 2)
    WHEN '80' THEN '80通數土'
    WHEN '81' THEN '81通圖土'
    WHEN '82' THEN '82通建'
    ELSE split_part(case_number, '-', 2) END`;

export async function upgradeReceiveFields(): Promise<void> {
  try {
    await pool.query("ALTER TABLE mapscheduler.survey_cases ADD COLUMN IF NOT EXISTS receive_date text");
    await pool.query("ALTER TABLE mapscheduler.survey_cases ADD COLUMN IF NOT EXISTS receive_word text");
    // SET 內的運算都使用更新前的值，所以 case_number 會在最後才被改成末段號碼
    const result = await pool.query(`
      UPDATE mapscheduler.survey_cases SET
        receive_date = (substring(case_number from 1 for 3)::int + 1911)::text
          || '-' || substring(case_number from 4 for 2)
          || '-' || substring(case_number from 6 for 2),
        receive_word = ${RECEIVE_WORD_SQL},
        case_number = split_part(case_number, '-', 3)
      WHERE receive_date IS NULL
        AND case_number ~ '^[0-9]{3}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])-[0-9]+-[0-9]+$'
    `);
    console.log(`[schema] 收件欄位檢查完成，拆解舊格式案號 ${result.rowCount ?? 0} 筆`);
  } catch (error) {
    console.error("收件欄位升級失敗，請手動執行 server/schema-upgrade.ts 內的 SQL：", error);
  }
}
