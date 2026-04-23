import { useState, useEffect, useCallback } from "react";
import Papa from "papaparse";

// นำลิงก์จาก Google Sheet มาใส่ตรงนี้ โค้ดจะจัดการแปลง pubhtml เป็น csv ให้อัตโนมัติ
const RAW_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQfDsgLFHGfBfGYttkda8ujJhILab9DGryK7Pgvlupxy_vgEjORfNoV-haxydRkVa0kvdm4CyeRKY9o/pubhtml";
const CSV_URL = RAW_URL.replace(/\/pubhtml$/, "/pub?output=csv").replace(
  /\/pub$/,
  "/pub?output=csv"
);

// ค้นหาคอลัมน์แบบแม่นยำขึ้น (หาคำเป๊ะๆ ก่อน ค่อยหาคำที่มีส่วนประกอบ)
function findCol(headers, keywords) {
  // 1. ลองหาแบบตรงกันเป๊ะๆ ก่อน (Exact Match)
  for (let k of keywords) {
    const idx = headers.findIndex(
      (h) => (h || "").trim().toLowerCase() === k.toLowerCase()
    );
    if (idx >= 0) return idx;
  }
  // 2. ถ้าไม่เจอแบบเป๊ะๆ ค่อยหาแบบมีคำผสมอยู่ (Partial Match)
  for (let k of keywords) {
    const idx = headers.findIndex((h) =>
      (h || "").toLowerCase().includes(k.toLowerCase())
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [colMap, setColMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [patientQ, setPatientQ] = useState("");
  const [doctorQ, setDoctorQ] = useState("");
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState([]);
  const [lastUpdate, setLastUpdate] = useState("");
  const [debugCols, setDebugCols] = useState("");

  const loadData = useCallback(() => {
    setLoading(true);
    setError("");
    Papa.parse(CSV_URL, {
      download: true,
      header: false,
      skipEmptyLines: true,
      complete: (result) => {
        if (!result.data || result.data.length < 2) {
          setError(
            "ไม่พบข้อมูลใน Google Sheet — ตรวจสอบว่าได้ Publish to web แล้ว และมีข้อมูลมากกว่า 1 บรรทัด"
          );
          setLoading(false);
          return;
        }

        const hdrs = result.data[0].map((h) => (h || "").toString().trim());

        const map = {
          order: findCol(hdrs, [
            "ใบสั่งงาน",
            "เลขใบ",
            "受注",
            "order",
            "เลขที่",
            "no",
            "ลำดับ",
          ]),
          clinic: findCol(hdrs, ["คลินิก", "医院", "clinic", "โรงพยาบาล"]),
          patient: findCol(hdrs, ["คนไข้", "患者", "patient", "ชื่อคนไข้"]),
          doctor: findCol(hdrs, ["หมอ", "先生", "doctor", "ทันตแพทย์"]),
          step: findCol(hdrs, [
            "ขั้นตอน",
            "SD 3D",
            "ประเภท",
            "type",
            "ชนิดงาน",
          ]),
          delivery: findCol(hdrs, [
            "วันส่ง",
            "納品",
            "ส่งคลินิก",
            "delivery",
            "กำหนดส่ง",
          ]),
          status: findCol(hdrs, ["ถึงไหน", "สถานะ", "status"]),
          appt: findCol(hdrs, ["วันนัด", "นัด", "appointment"]),
          remark: findCol(hdrs, ["หมายเหตุ", "remark", "note", "memo"]),
          work: findCol(hdrs, [
            "สิ่งที่ให้ทำ",
            "作製",
            "รายละเอียด",
            "งาน",
            "content",
          ]),
        };
        setColMap(map);

        const found = Object.entries(map)
          .filter(([, v]) => v >= 0)
          .map(([k, v]) => k + '→"' + hdrs[v].substring(0, 30) + '"')
          .join(", ");
        setDebugCols(found || "ไม่พบคอลัมน์ — headers: " + hdrs.join(" | "));

        if (map.patient < 0 || map.doctor < 0) {
          setError(
            "ไม่พบคอลัมน์ 'ชื่อคนไข้' หรือ 'ชื่อหมอ' ในแถวแรกสุดของ Sheet\n\nคอลัมน์ที่เจอ:\n" +
              hdrs.map((h, i) => "[" + i + "] " + h).join("\n")
          );
          setLoading(false);
          return;
        }

        const dataRows = result.data.slice(1).filter((r) => {
          const p = map.patient >= 0 ? (r[map.patient] || "").trim() : "";
          return p.length > 1;
        });
        setRows(dataRows);
        setLastUpdate(
          new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })
        );
        setLoading(false);
      },
      error: (err) => {
        setError(
          "ดึงข้อมูลไม่ได้ — ตรวจสอบว่าลิงก์ถูกต้อง และ Google Sheet ได้ Publish to web แบบ CSV แล้ว\n\n" +
            (err.message || "")
        );
        setLoading(false);
      },
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getVal = (row, key) => {
    if (!colMap || colMap[key] < 0 || colMap[key] === undefined) return "";
    return (row[colMap[key]] || "").trim();
  };

  const handleSearch = () => {
    const p = patientQ.trim().toLowerCase();
    const d = doctorQ.trim().toLowerCase();
    if (!p || !d) return;
    const filtered = rows.filter(
      (r) =>
        getVal(r, "patient").toLowerCase().includes(p) &&
        getVal(r, "doctor").toLowerCase().includes(d)
    );
    setResults(filtered.slice(0, 30));
    setSearched(true);
  };

  const stepColor = (s) => {
    if (!s) return "#94a3b8";
    const low = s.toLowerCase();
    if (low.includes("zr") || low.includes("zirconia")) return "#3b82f6";
    if (low.includes("sd") || low.includes("silicone") || low.includes("flex"))
      return "#10b981";
    if (low.includes("apd") || low.includes("ti") || low.includes("acrylic"))
      return "#f59e0b";
    if (low.includes("ลอง") || low.includes("bb") || low.includes("bite"))
      return "#8b5cf6";
    return "#64748b";
  };

  const bothFilled = patientQ.trim().length > 0 && doctorQ.trim().length > 0;

  // ฟังก์ชันช่วยเคลียร์สถานะเมื่อมีการพิมพ์ใหม่
  const resetSearchState = () => {
    setSearched(false);
    setResults([]);
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f0f4f8",
          fontFamily: "'Noto Sans Thai', sans-serif",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: "4px solid #e2e8f0",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div style={{ marginTop: "1rem", color: "#64748b" }}>
          กำลังดึงข้อมูลจาก Google Sheet...
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f0f4f8",
          fontFamily: "'Noto Sans Thai', sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ fontSize: "3rem" }}>⚠️</div>
        <div
          style={{
            color: "#dc2626",
            marginTop: "1rem",
            textAlign: "center",
            maxWidth: 500,
            whiteSpace: "pre-line",
            fontSize: "0.9rem",
            lineHeight: "1.5",
          }}
        >
          {error}
        </div>
        <button
          onClick={loadData}
          style={{
            marginTop: "1.5rem",
            padding: "0.7rem 2rem",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "0.95rem",
          }}
        >
          🔄 ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f4f8",
        fontFamily: "'Noto Sans Thai', sans-serif",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg,#1e40af 0%,#0ea5e9 100%)",
          padding: "1.8rem 1.5rem",
          textAlign: "center",
          boxShadow: "0 4px 20px rgba(30,64,175,0.3)",
        }}
      >
        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "white" }}>
          🦷 ตรวจสอบสถานะงาน
        </div>
        <div
          style={{ color: "#bae6fd", marginTop: "0.3rem", fontSize: "0.82rem" }}
        >
          กรอกชื่อหมอ และชื่อคนไข้ เพื่อตรวจสอบ
        </div>
        <div
          style={{ color: "#93c5fd", marginTop: "0.3rem", fontSize: "0.72rem" }}
        >
          📊 {rows.length.toLocaleString()} รายการ &nbsp;|&nbsp; อัปเดต:{" "}
          {lastUpdate}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "1.5rem auto", padding: "0 1rem" }}>
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: "1.5rem",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="input-doctor"
              style={{
                display: "block",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "0.35rem",
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              👨‍⚕️ ชื่อหมอ <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="input-doctor"
              value={doctorQ}
              onChange={(e) => {
                setDoctorQ(e.target.value);
                resetSearchState();
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="เช่น สาธิต, จันทนิภา..."
              style={{
                width: "100%",
                padding: "0.7rem 1rem",
                borderRadius: 10,
                border: "2px solid",
                borderColor: doctorQ ? "#3b82f6" : "#e2e8f0",
                fontSize: "1rem",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.2rem" }}>
            <label
              htmlFor="input-patient"
              style={{
                display: "block",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "0.35rem",
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              🧑 ชื่อคนไข้ <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              id="input-patient"
              value={patientQ}
              onChange={(e) => {
                setPatientQ(e.target.value);
                resetSearchState();
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="เช่น สมหมาย, อุมาวรรณ..."
              style={{
                width: "100%",
                padding: "0.7rem 1rem",
                borderRadius: 10,
                border: "2px solid",
                borderColor: patientQ ? "#3b82f6" : "#e2e8f0",
                fontSize: "1rem",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {(patientQ || doctorQ) && !bothFilled && (
            <div
              style={{
                background: "#fef9c3",
                border: "1px solid #fde047",
                borderRadius: 8,
                padding: "0.55rem 1rem",
                fontSize: "0.82rem",
                color: "#854d0e",
                marginBottom: "1rem",
              }}
            >
              ⚠️ กรุณากรอก <strong>ทั้งชื่อหมอและชื่อคนไข้</strong> เพื่อค้นหา
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleSearch}
              disabled={!bothFilled}
              style={{
                flex: 1,
                padding: "0.8rem",
                background: bothFilled ? "#1e40af" : "#cbd5e1",
                color: "white",
                border: "none",
                borderRadius: 10,
                cursor: bothFilled ? "pointer" : "not-allowed",
                fontSize: "1rem",
                fontWeight: 700,
                fontFamily: "inherit",
              }}
            >
              🔍 ค้นหา
            </button>
            <button
              onClick={loadData}
              style={{
                padding: "0.8rem 1rem",
                background: "#f1f5f9",
                color: "#475569",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: "0.85rem",
                fontFamily: "inherit",
              }}
              title="โหลดข้อมูลใหม่"
            >
              🔄
            </button>
          </div>
        </div>

        {searched && (
          <div style={{ marginTop: "1rem" }}>
            <div
              style={{
                color: "#64748b",
                fontSize: "0.82rem",
                marginBottom: "0.6rem",
                paddingLeft: "0.25rem",
              }}
            >
              {results.length > 0 ? "พบ " + results.length + " รายการ" : ""}
            </div>

            {results.length === 0 ? (
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: "2rem",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "2.5rem" }}>🔍</div>
                <div style={{ color: "#94a3b8", marginTop: "0.5rem" }}>
                  ไม่พบข้อมูลที่ตรงกัน
                </div>
                <div
                  style={{
                    color: "#cbd5e1",
                    fontSize: "0.78rem",
                    marginTop: "0.25rem",
                  }}
                >
                  ลองตรวจสอบการสะกดชื่ออีกครั้ง
                </div>
              </div>
            ) : (
              results.map((r, i) => {
                const step = getVal(r, "step");
                return (
                  <div
                    key={i}
                    style={{
                      background: "white",
                      borderRadius: 12,
                      padding: "1rem 1.2rem",
                      marginBottom: "0.6rem",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      borderLeft: "4px solid " + stepColor(step),
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.4rem",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "1rem",
                          color: "#1e293b",
                        }}
                      >
                        {getVal(r, "patient")}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.4rem",
                          alignItems: "center",
                        }}
                      >
                        {getVal(r, "order") && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              background: "#f1f5f9",
                              padding: "2px 7px",
                              borderRadius: 5,
                              color: "#64748b",
                            }}
                          >
                            #{getVal(r, "order")}
                          </span>
                        )}
                        {step && (
                          <span
                            style={{
                              background: stepColor(step) + "22",
                              color: stepColor(step),
                              padding: "2px 10px",
                              borderRadius: 20,
                              fontSize: "0.78rem",
                              fontWeight: 700,
                            }}
                          >
                            {step}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: "0.3rem",
                        color: "#475569",
                        fontSize: "0.88rem",
                      }}
                    >
                      {getVal(r, "doctor")}
                    </div>
                    {getVal(r, "clinic") && (
                      <div
                        style={{
                          color: "#94a3b8",
                          fontSize: "0.82rem",
                          marginTop: "0.05rem",
                        }}
                      >
                        {getVal(r, "clinic")}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: "0.5rem",
                        display: "flex",
                        gap: "1rem",
                        flexWrap: "wrap",
                      }}
                    >
                      {getVal(r, "delivery") && (
                        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          📅 ส่งคลินิก:{" "}
                          <strong style={{ color: "#1e293b" }}>
                            {getVal(r, "delivery")}
                          </strong>
                        </div>
                      )}
                      {getVal(r, "status") && (
                        <div style={{ fontSize: "0.8rem", color: "#059669" }}>
                          ✅ ถึงไหนแล้ว: <strong>{getVal(r, "status")}</strong>
                        </div>
                      )}
                      {getVal(r, "appt") && (
                        <div style={{ fontSize: "0.8rem", color: "#8b5cf6" }}>
                          🗓️ นัด: <strong>{getVal(r, "appt")}</strong>
                        </div>
                      )}
                    </div>
                    {getVal(r, "work") && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          fontSize: "0.78rem",
                          color: "#64748b",
                          background: "#f8fafc",
                          padding: "0.5rem 0.7rem",
                          borderRadius: 8,
                          whiteSpace: "pre-line",
                          lineHeight: 1.4,
                          maxHeight: 120,
                          overflow: "auto",
                        }}
                      >
                        {getVal(r, "work")}
                      </div>
                    )}
                    {getVal(r, "remark") && (
                      <div
                        style={{
                          marginTop: "0.35rem",
                          fontSize: "0.78rem",
                          color: "#f59e0b",
                        }}
                      >
                        💬 {getVal(r, "remark")}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {!searched && (
          <div
            style={{
              textAlign: "center",
              color: "#94a3b8",
              marginTop: "2.5rem",
            }}
          >
            <div style={{ fontSize: "3rem" }}>🦷</div>
            <div style={{ marginTop: "0.5rem", fontSize: "0.88rem" }}>
              กรอกชื่อหมอและชื่อคนไข้เพื่อดูสถานะงาน
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "#cbd5e1",
                marginTop: "0.3rem",
              }}
            >
              ข้อมูลดึงจาก Google Sheet แบบ real-time
            </div>
          </div>
        )}

        {debugCols && (
          <div
            style={{
              marginTop: "2rem",
              padding: "0.6rem 0.8rem",
              background: "#f8fafc",
              borderRadius: 8,
              fontSize: "0.65rem",
              color: "#94a3b8",
              wordBreak: "break-all",
            }}
          >
            🔧 คอลัมน์ที่พบ: {debugCols}
          </div>
        )}
      </div>
    </div>
  );
}
