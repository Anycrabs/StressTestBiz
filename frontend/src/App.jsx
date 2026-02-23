import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getScenarioResult, listScenarios, login, me, register, runScenario, uploadFile } from "./api";

const METRICS = [
  { key: "revenue", label: "Revenue" },
  { key: "ebitda", label: "EBITDA" },
  { key: "net_profit", label: "Net Profit" },
  { key: "ocf", label: "OCF" },
];

function riskClass(metricDelta) {
  if (!metricDelta) return "risk-green";
  return `risk-${metricDelta.risk}`;
}

function metricNumber(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function percentNumber(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("fsm_token") || "");
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("demo12345");
  const [authMessage, setAuthMessage] = useState("");

  const [file, setFile] = useState(null);
  const [uploadData, setUploadData] = useState(null);
  const [scenarioType, setScenarioType] = useState("fx_growth");
  const [scenarioName, setScenarioName] = useState("Baseline Scenario");

  const [scenarioFx, setScenarioFx] = useState(95);
  const [demandPercent, setDemandPercent] = useState(90);
  const [rawVcPercent, setRawVcPercent] = useState(30);

  const [customQ, setCustomQ] = useState(0);
  const [customPrice, setCustomPrice] = useState(0);
  const [customVc, setCustomVc] = useState(0);
  const [customFx, setCustomFx] = useState(0);
  const [customFc, setCustomFc] = useState(0);

  const [resultData, setResultData] = useState(null);
  const [screen, setScreen] = useState("controls");
  const [history, setHistory] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    me(token)
      .then(() => listScenarios(token))
      .then((res) => setHistory(res.items || []))
      .catch(() => {
        setToken("");
        localStorage.removeItem("fsm_token");
      });
  }, [token]);

  useEffect(() => {
    if (!uploadData?.parsed_json) return;
    const base = uploadData.parsed_json;
    setCustomQ(base.q);
    setCustomPrice(base.price);
    setCustomVc(base.vc_percent);
    setCustomFx(base.fx || 0);
    setCustomFc(base.fc);
    setRawVcPercent(base.vc_percent);
    setScenarioFx(base.fx || 1);
  }, [uploadData]);

  const chartData = useMemo(() => {
    if (!resultData?.result) return [];
    const { base_result: base, scenario_result: scenario } = resultData.result;
    return METRICS.map((metric) => ({
      metric: metric.label,
      Base: base[metric.key],
      Scenario: scenario[metric.key],
    }));
  }, [resultData]);

  const currentDelta = resultData?.result?.delta || {};

  async function handleRegister() {
    try {
      setErrorMessage("");
      await register(email, password);
      setAuthMessage("Registration successful. Please login.");
    } catch (err) {
      setErrorMessage(err.message);
    }
  }

  async function handleLogin() {
    try {
      setErrorMessage("");
      const data = await login(email, password);
      setToken(data.access_token);
      localStorage.setItem("fsm_token", data.access_token);
      setAuthMessage("Login successful");
    } catch (err) {
      setErrorMessage(err.message);
    }
  }

  function logout() {
    setToken("");
    localStorage.removeItem("fsm_token");
    setUploadData(null);
    setResultData(null);
  }

  async function handleUpload() {
    if (!file || !token) return;
    try {
      setLoading(true);
      setErrorMessage("");
      const data = await uploadFile(file, token);
      setUploadData(data);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function buildScenarioParams() {
    if (!uploadData?.parsed_json) return {};
    const base = uploadData.parsed_json;

    if (scenarioType === "fx_growth") {
      return { scenario_fx: Number(scenarioFx) };
    }
    if (scenarioType === "demand_drop") {
      return { q: Number(base.q) * (Number(demandPercent) / 100) };
    }
    if (scenarioType === "raw_material_growth") {
      return { vc_percent: Number(rawVcPercent) };
    }
    return {
      q: Number(customQ),
      price: Number(customPrice),
      vc_percent: Number(customVc),
      fx: Number(customFx),
      fc: Number(customFc),
    };
  }

  async function handleRunScenario() {
    if (!uploadData || !token) return;

    try {
      setLoading(true);
      setErrorMessage("");
      const payload = {
        upload_id: uploadData.id,
        name: scenarioName,
        scenario: {
          type: scenarioType,
          params: buildScenarioParams(),
        },
      };
      const response = await runScenario(payload, token);
      setResultData(response);
      setScreen("results");
      const list = await listScenarios(token);
      setHistory(list.items || []);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openResult(scenarioId) {
    try {
      setLoading(true);
      const response = await getScenarioResult(scenarioId, token);
      setResultData({
        scenario_id: response.scenario_id,
        result_id: response.result_id,
        computed_at: response.computed_at,
        result: response.result,
      });
      setScreen("results");
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Financial Scenario Modeling System</h1>
        <div className="tabs">
          <button className={screen === "controls" ? "active" : ""} onClick={() => setScreen("controls")}>Controls</button>
          <button className={screen === "results" ? "active" : ""} onClick={() => setScreen("results")} disabled={!resultData}>Results</button>
        </div>
      </header>

      <section className="auth-panel">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
        <button onClick={handleRegister}>Register</button>
        <button onClick={handleLogin}>Login</button>
        <button onClick={logout}>Logout</button>
        <span>{authMessage}</span>
      </section>

      {errorMessage && <div className="error-box">{errorMessage}</div>}

      {screen === "controls" && (
        <section className="panel">
          <h2>Screen 1 — Controls</h2>
          <div className="block">
            <h3>File Upload</h3>
            <input type="file" accept=".csv,.json" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={handleUpload} disabled={!file || loading || !token}>Upload</button>
            {uploadData && <pre>{JSON.stringify(uploadData.parsed_json, null, 2)}</pre>}
          </div>

          <div className="block">
            <h3>Scenario Selector</h3>
            <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} placeholder="Scenario name" />
            <select value={scenarioType} onChange={(e) => setScenarioType(e.target.value)}>
              <option value="fx_growth">FX Growth</option>
              <option value="demand_drop">Demand Drop</option>
              <option value="raw_material_growth">Raw Material Growth</option>
              <option value="custom">Custom Scenario</option>
            </select>

            {scenarioType === "fx_growth" && (
              <div className="slider-row">
                <label>Scenario FX: {scenarioFx}</label>
                <input type="range" min="1" max="300" value={scenarioFx} onChange={(e) => setScenarioFx(e.target.value)} />
              </div>
            )}

            {scenarioType === "demand_drop" && (
              <div className="slider-row">
                <label>Demand (% of base Q): {demandPercent}%</label>
                <input type="range" min="1" max="200" value={demandPercent} onChange={(e) => setDemandPercent(e.target.value)} />
              </div>
            )}

            {scenarioType === "raw_material_growth" && (
              <div className="slider-row">
                <label>VC%: {rawVcPercent}</label>
                <input type="range" min="0" max="100" step="0.1" value={rawVcPercent} onChange={(e) => setRawVcPercent(e.target.value)} />
              </div>
            )}

            {scenarioType === "custom" && (
              <div className="custom-grid">
                <label>Q<input type="range" min="0" max="1000000" value={customQ} onChange={(e) => setCustomQ(e.target.value)} /><span>{customQ}</span></label>
                <label>P<input type="range" min="0" max="1000000" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} /><span>{customPrice}</span></label>
                <label>VC%<input type="range" min="0" max="100" step="0.1" value={customVc} onChange={(e) => setCustomVc(e.target.value)} /><span>{customVc}</span></label>
                <label>FX<input type="range" min="0" max="500" step="0.1" value={customFx} onChange={(e) => setCustomFx(e.target.value)} /><span>{customFx}</span></label>
                <label>FC<input type="range" min="0" max="1000000" value={customFc} onChange={(e) => setCustomFc(e.target.value)} /><span>{customFc}</span></label>
              </div>
            )}

            <button onClick={handleRunScenario} disabled={!uploadData || loading || !token}>Run Scenario</button>
          </div>

          <div className="block">
            <h3>Scenario History</h3>
            <ul className="history-list">
              {history.map((item) => (
                <li key={item.scenario_id}>
                  <button onClick={() => openResult(item.scenario_id)}>{item.name}</button>
                  <span>{new Date(item.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {screen === "results" && resultData && (
        <section className="panel">
          <h2>Screen 2 — Results</h2>
          <div className="cards-grid">
            {METRICS.map((metric) => {
              const delta = currentDelta[metric.key];
              const scenarioValue = resultData.result.scenario_result[metric.key];
              return (
                <article key={metric.key} className={`metric-card ${riskClass(delta)}`}>
                  <h3>{metric.label}</h3>
                  <div className="metric-value">{metricNumber(scenarioValue)}</div>
                  <div className="metric-delta">{percentNumber(delta?.delta_percent)}</div>
                </article>
              );
            })}
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Base</th>
                  <th>Scenario</th>
                  <th>Delta</th>
                  <th>Delta %</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(currentDelta).map(([key, delta]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>{metricNumber(delta.base)}</td>
                    <td>{metricNumber(delta.scenario)}</td>
                    <td>{metricNumber(delta.delta_abs)}</td>
                    <td>{percentNumber(delta.delta_percent)}</td>
                    <td className={`risk-cell ${riskClass(delta)}`}>{delta.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" />
                <YAxis />
                <Tooltip formatter={(value) => metricNumber(value)} />
                <Legend />
                <Bar dataKey="Base" fill="#1f77b4" />
                <Bar dataKey="Scenario" fill="#ff7f0e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
