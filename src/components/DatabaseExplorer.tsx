import React, { useState, useEffect } from "react";
import { 
  Database, Table, Terminal, Download, RefreshCw, Search, 
  KeyRound, ShieldCheck, Play, Code, CheckCircle, AlertCircle, FileText, ExternalLink
} from "lucide-react";

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

interface TableInfo {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
}

export default function DatabaseExplorer() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("users");
  const [tableData, setTableData] = useState<{ columns: string[]; rows: any[]; rowCount: number }>({ columns: [], rows: [], rowCount: 0 });
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"browse" | "structure" | "sql">("browse");
  
  // Custom SQL Console state
  const [sqlQuery, setSqlQuery] = useState<string>("SELECT * FROM users LIMIT 50;");
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [querySuccess, setQuerySuccess] = useState<string | null>(null);

  // Search filter inside table view
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable && activeTab === "browse") {
      fetchTableRows(selectedTable);
    }
  }, [selectedTable, activeTab]);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/database/tables");
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
        if (data.tables && data.tables.length > 0 && !selectedTable) {
          setSelectedTable(data.tables[0].name);
        }
      }
    } catch (err) {
      console.error("Error fetching database tables:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableRows = async (tableName: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/database/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName })
      });
      if (res.ok) {
        const data = await res.json();
        setTableData({
          columns: data.columns || [],
          rows: data.rows || [],
          rowCount: data.rowCount || 0
        });
      }
    } catch (err) {
      console.error("Error fetching table rows:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteSql = async () => {
    setQueryError(null);
    setQuerySuccess(null);
    setQueryResult(null);
    if (!sqlQuery.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/database/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sqlQuery })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.rows) {
          setQueryResult(data);
          setQuerySuccess(`Query returned ${data.rowCount} rows.`);
        } else {
          setQuerySuccess(data.message || "Query executed successfully.");
          fetchTables(); // Refresh row counts
        }
      } else {
        setQueryError(data.error || "Execution failed.");
      }
    } catch (err: any) {
      setQueryError("Failed to connect to backend database.");
    } finally {
      setLoading(false);
    }
  };

  const currentTableObj = tables.find(t => t.name === selectedTable);

  const filteredRows = tableData.rows.filter(row => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(row).some(val => 
      val !== null && val !== undefined && String(val).toLowerCase().includes(term)
    );
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-slate-800 text-left font-sans">
      
      {/* Top Header / Bar */}
      <div className="bg-slate-900 text-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight">phpMyAdmin Style SQLite Inspector</h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded border border-emerald-500/40 uppercase">
                Relational Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Live SQLite Database Manager • Hashed Passwords (`bcryptjs`) & Schema Explorer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <a
            href="/db-admin"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Open database manager in a full standalone browser tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Standalone Tab (/db-admin)
          </a>

          <button
            onClick={() => { fetchTables(); if (selectedTable) fetchTableRows(selectedTable); }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            title="Refresh database state"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            Refresh DB
          </button>
          
          <a
            href="/api/admin/database/export"
            download="app_database_dump.json"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Backup JSON
          </a>
        </div>
      </div>

      {/* Main Split Layout: Table Navigation Left & View Console Right */}
      <div className="grid grid-cols-1 md:grid-cols-4 min-h-[500px]">
        
        {/* Left Sidebar: Tables List */}
        <div className="bg-slate-50 border-r border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Table className="w-3.5 h-3.5 text-slate-500" />
              Database Tables ({tables.length})
            </span>
          </div>

          <div className="space-y-1">
            {tables.map(tbl => {
              const isSelected = tbl.name === selectedTable;
              return (
                <button
                  key={tbl.name}
                  onClick={() => { setSelectedTable(tbl.name); setActiveTab("browse"); }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer text-left ${
                    isSelected 
                      ? "bg-emerald-600 text-white shadow-sm" 
                      : "text-slate-700 hover:bg-slate-200/60"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Database className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-emerald-600"}`} />
                    <span className="truncate">{tbl.name}</span>
                  </span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    isSelected ? "bg-emerald-800 text-emerald-100" : "bg-slate-200 text-slate-600"
                  }`}>
                    {tbl.rowCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Hashing Safety Note */}
          <div className="mt-6 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[11px] leading-relaxed text-indigo-950 font-medium">
            <div className="flex items-center gap-1.5 text-indigo-700 font-bold mb-1">
              <ShieldCheck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              Bcrypt Hash Security
            </div>
            Passwords are converted to 60-character salted <code className="bg-indigo-100/80 px-1 py-0.5 rounded text-[10px] font-mono text-indigo-900">$2b$10$...</code> bcrypt hashes before writing to disk, protecting user credentials.
          </div>
        </div>

        {/* Right Panel: Content View / SQL / Schema */}
        <div className="md:col-span-3 flex flex-col">
          
          {/* Sub-Header Tabs */}
          <div className="bg-white border-b border-slate-200 px-5 pt-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                Table: <span className="text-emerald-600">{selectedTable}</span>
              </span>
              
              <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-0.5">
                <button
                  onClick={() => setActiveTab("browse")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "browse" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Table className="w-3.5 h-3.5 text-emerald-600" />
                  Browse Rows
                </button>
                <button
                  onClick={() => setActiveTab("structure")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "structure" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Code className="w-3.5 h-3.5 text-indigo-600" />
                  Table Structure
                </button>
                <button
                  onClick={() => {
                    setActiveTab("sql");
                    setSqlQuery(`SELECT * FROM "${selectedTable}" LIMIT 50;`);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "sql" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-amber-500" />
                  SQL Command
                </button>
              </div>
            </div>

            {activeTab === "browse" && (
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter rows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* TAB 1: BROWSE ROWS */}
          {activeTab === "browse" && (
            <div className="p-5 flex-grow overflow-x-auto">
              {loading ? (
                <div className="py-20 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                  <p className="text-xs text-slate-400 font-semibold mt-2">Loading database rows...</p>
                </div>
              ) : tableData.rows.length === 0 ? (
                <div className="py-16 text-center text-slate-400 font-semibold text-xs border-2 border-dashed border-slate-200 rounded-2xl">
                  No records stored in table <code className="text-slate-700 font-bold">{selectedTable}</code>.
                </div>
              ) : (
                <div>
                  <div className="text-[11px] text-slate-500 font-bold mb-3 flex items-center justify-between">
                    <span>Showing {filteredRows.length} of {tableData.rowCount} records</span>
                    <span className="text-[10px] text-slate-400 font-normal">Scroll horizontally for all columns</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[450px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] sticky top-0 z-10">
                          {tableData.columns.map(col => (
                            <th key={col} className="px-3.5 py-2.5 whitespace-nowrap border-r border-slate-200/60 last:border-r-0">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50 transition">
                            {tableData.columns.map(col => {
                              const val = row[col];
                              const isPasswordCol = col.toLowerCase().includes("password");
                              const valStr = val === null || val === undefined ? "NULL" : String(val);
                              const isBcrypt = isPasswordCol && valStr.startsWith("$2b$");

                              return (
                                <td key={col} className="px-3.5 py-2.5 border-r border-slate-100 last:border-r-0 max-w-[280px] truncate">
                                  {val === null || val === undefined ? (
                                    <span className="text-slate-300 italic font-mono text-[10px]">NULL</span>
                                  ) : isBcrypt ? (
                                    <div className="flex items-center gap-1.5" title="Encrypted with 10-round bcrypt hash">
                                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-1 font-mono">
                                        <KeyRound className="w-3 h-3 text-emerald-600" />
                                        bcrypt
                                      </span>
                                      <span className="font-mono text-[10px] text-slate-600 truncate">{valStr}</span>
                                    </div>
                                  ) : typeof val === "object" ? (
                                    <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded truncate inline-block max-w-full">
                                      {JSON.stringify(val)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-800 font-medium truncate block" title={valStr}>
                                      {valStr}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TABLE STRUCTURE */}
          {activeTab === "structure" && (
            <div className="p-5 flex-grow">
              <h3 className="text-xs font-black uppercase text-slate-500 mb-3 tracking-wider">
                Column Definitions & Constraints for {selectedTable}
              </h3>
              
              {currentTableObj && currentTableObj.columns.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px]">
                        <th className="px-4 py-2.5">Col ID</th>
                        <th className="px-4 py-2.5">Column Name</th>
                        <th className="px-4 py-2.5">Data Type</th>
                        <th className="px-4 py-2.5">Nullable</th>
                        <th className="px-4 py-2.5">Primary Key</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentTableObj.columns.map(c => (
                        <tr key={c.name} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-2.5 text-slate-400 font-mono text-[10px]">{c.cid}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900">{c.name}</td>
                          <td className="px-4 py-2.5 font-mono text-emerald-700 font-bold uppercase text-[11px]">{c.type}</td>
                          <td className="px-4 py-2.5">
                            {c.notnull ? (
                              <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-100">NOT NULL</span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">NULLABLE</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {c.pk === 1 ? (
                              <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 w-max">
                                <KeyRound className="w-3 h-3 text-amber-600" />
                                PRIMARY KEY
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Select a table to view structure.</p>
              )}
            </div>
          )}

          {/* TAB 3: SQL CONSOLE */}
          {activeTab === "sql" && (
            <div className="p-5 flex-grow space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">
                  Execute Direct SQL Command
                </label>
                <div className="relative">
                  <textarea
                    rows={4}
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    placeholder="e.g. SELECT * FROM users WHERE role = 'admin';"
                    className="w-full bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                  />
                  <button
                    onClick={handleExecuteSql}
                    disabled={loading}
                    className="absolute bottom-3 right-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Run Query
                  </button>
                </div>
              </div>

              {queryError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold p-3.5 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{queryError}</span>
                </div>
              )}

              {querySuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold p-3.5 rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{querySuccess}</span>
                </div>
              )}

              {queryResult && queryResult.rows && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-2">Query Results ({queryResult.rowCount} rows)</h4>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[10px]">
                          {queryResult.columns.map((c: string) => (
                            <th key={c} className="px-3.5 py-2.5 whitespace-nowrap border-r border-slate-200/60 last:border-r-0">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {queryResult.rows.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            {queryResult.columns.map((c: string) => (
                              <td key={c} className="px-3.5 py-2 border-r border-slate-100 last:border-r-0 max-w-[250px] truncate font-mono text-[11px]">
                                {r[c] === null ? "NULL" : String(r[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
