import { pool } from "./db";
import { AGENT_SEED } from "./agent-seed";
import { CASE_TYPE_ALIASES } from "@shared/schema";

// 啟動時自動補上新增的欄位（v2.9.0 收件日期、收件字；v2.10.0 代理人）與資料表（v2.11.0 代理人資訊；v2.12.0 請假類型；v2.15.0 法院股別、發文字號），並把舊格式案號拆回原位。
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
    await pool.query("ALTER TABLE mapscheduler.survey_cases ADD COLUMN IF NOT EXISTS agent text");
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

// v2.11.0 代理人資訊：資料表不存在才建立；表是空的時候放入「測量案件排程」的代理人通訊錄（只放一次）
export async function upgradeAgents(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mapscheduler.agents (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE,
        tel text,
        fax text,
        mobile text,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamp DEFAULT now()
      )`);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM mapscheduler.agents");
    if (rows[0].n > 0) return;
    for (let i = 0; i < AGENT_SEED.length; i++) {
      const a = AGENT_SEED[i];
      await pool.query(
        "INSERT INTO mapscheduler.agents (name, tel, fax, mobile, sort_order) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO NOTHING",
        [a.name, a.tel || null, a.fax || null, a.mobile || null, i],
      );
    }
    console.log(`[schema] 代理人資訊：放入初始資料 ${AGENT_SEED.length} 筆`);
  } catch (error) {
    console.error("代理人資訊資料表建立失敗：", error);
  }
}

// v2.12.0 請假類型（休假／出差／上課）：欄位不存在才新增，並依原本填的原因推測舊資料的類型（只在新增欄位時做一次）
export async function upgradeLeaveType(): Promise<void> {
  try {
    const { rows } = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = 'mapscheduler' AND table_name = 'surveyor_leaves' AND column_name = 'leave_type'",
    );
    if (rows.length) return;
    await pool.query("ALTER TABLE mapscheduler.surveyor_leaves ADD COLUMN IF NOT EXISTS leave_type text NOT NULL DEFAULT '休假'");
    const r1 = await pool.query("UPDATE mapscheduler.surveyor_leaves SET leave_type = '上課' WHERE reason ~ '課|講習|訓練|研習'");
    const r2 = await pool.query("UPDATE mapscheduler.surveyor_leaves SET leave_type = '出差' WHERE leave_type = '休假' AND reason ~ '出差|公差'");
    console.log(`[schema] 請假類型欄位已新增，依原因判斷：上課 ${r1.rowCount ?? 0} 筆、出差 ${r2.rowCount ?? 0} 筆`);
  } catch (error) {
    console.error("請假類型欄位升級失敗：", error);
  }
}

// v2.15.0 法院案件：新增股別、發文字號欄位。只在第一次新增欄位時，把舊資料「民信674」這種格式拆開：
// 股別 民信、發文字號 674，申請人（法院名稱）看不出來的一律填苗栗地方法院
export async function upgradeCourtFields(): Promise<void> {
  try {
    const { rows } = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = 'mapscheduler' AND table_name = 'survey_cases' AND column_name = 'court_division'",
    );
    if (rows.length) return;
    await pool.query("ALTER TABLE mapscheduler.survey_cases ADD COLUMN IF NOT EXISTS court_division text");
    await pool.query("ALTER TABLE mapscheduler.survey_cases ADD COLUMN IF NOT EXISTS court_doc_no text");
    const split = await pool.query(`
      UPDATE mapscheduler.survey_cases SET
        court_division = substring(trim(owner) from '^([^0-9]+)[0-9]+$'),
        court_doc_no = substring(trim(owner) from '^[^0-9]+([0-9]+)$'),
        owner = '苗栗地方法院'
      WHERE case_type IN ('法院', '法院指界') AND trim(owner) ~ '^[^0-9]+[0-9]+$' AND trim(owner) !~ '法院'
    `);
    const blank = await pool.query(
      "UPDATE mapscheduler.survey_cases SET owner = '苗栗地方法院' WHERE case_type IN ('法院', '法院指界') AND coalesce(trim(owner), '') = ''",
    );
    console.log(`[schema] 法院欄位已新增：拆開股別與發文字號 ${split.rowCount ?? 0} 筆、補上法院名稱 ${blank.rowCount ?? 0} 筆`);
  } catch (error) {
    console.error("法院欄位升級失敗：", error);
  }
}

// v2.15.1 種類名稱統一：建物、新建 → 建物保存。案件、案件類型清單、類型權重都一起改；重複執行沒有影響
export async function upgradeCaseTypeAliases(): Promise<void> {
  try {
    for (const [from, to] of Object.entries(CASE_TYPE_ALIASES)) {
      const moved = await pool.query("UPDATE mapscheduler.survey_cases SET case_type = $2 WHERE case_type = $1", [from, to]);
      const { rows } = await pool.query("SELECT 1 FROM mapscheduler.case_types WHERE name = $1", [to]);
      if (rows.length) await pool.query("DELETE FROM mapscheduler.case_types WHERE name = $1", [from]);
      else await pool.query("UPDATE mapscheduler.case_types SET name = $2 WHERE name = $1", [from, to]);
      await pool.query(
        `UPDATE mapscheduler.system_settings
           SET case_type_weights = (case_type_weights - $1::text) || jsonb_build_object($2::text, coalesce(case_type_weights -> $2::text, case_type_weights -> $1::text))
         WHERE case_type_weights ? $1::text`,
        [from, to],
      );
      if (moved.rowCount) console.log(`[schema] 案件類型「${from}」改為「${to}」：${moved.rowCount} 件`);
    }
  } catch (error) {
    console.error("案件類型名稱統一失敗：", error);
  }
}
