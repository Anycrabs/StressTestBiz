import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getScenarioResult, listScenarios, login, me, register, runScenario, uploadFile } from "./api";

const METRICS = [
  { key: "revenue", label: "Выручка" },
  { key: "ebitda", label: "Операционная прибыль" },
  { key: "net_profit", label: "Чистая прибыль" },
  { key: "ocf", label: "Операционный денежный поток" },
];

const SCENARIO_TYPES = [
  { key: "fx_growth", label: "Рост курса валюты" },
  { key: "demand_drop", label: "Падение спроса" },
  { key: "raw_material_growth", label: "Рост стоимости сырья" },
  { key: "custom", label: "Пользовательский сценарий" },
];

const HELP_STEPS = [
  {
    title: "1. Войдите в систему",
    text: "Создайте аккаунт или используйте уже зарегистрированную почту, чтобы открыть рабочее пространство моделирования.",
  },
  {
    title: "2. Загрузите исходные данные",
    text: "Поддерживаются CSV и JSON. В файле должны быть колонки q, price, vc_percent, fc, interest и tax_rate.",
  },
  {
    title: "3. Выберите сценарий",
    text: "Используйте готовые сценарии или настройте пользовательский вариант, затем запустите расчёт и сравните метрики.",
  },
];

function riskClass(metricDelta) {
  if (!metricDelta) return "risk-green";
  return `risk-${metricDelta.risk}`;
}

function riskLabel(risk) {
  const labels = {
    green: "Низкий",
    yellow: "Средний",
    red: "Высокий",
  };
  return labels[risk] || risk;
}

function metricLabel(metricKey) {
  return METRICS.find((metric) => metric.key === metricKey)?.label || metricKey;
}

function metricNumber(value) {
  return Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function percentNumber(value) {
  return `${Number(value || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function humanizeErrorMessage(message) {
  if (!message) {
    return "Произошла ошибка. Попробуйте ещё раз.";
  }

  if (message === "Failed to fetch") {
    return "Не удалось связаться с сервером. Проверьте, что backend и frontend запущены.";
  }

  if (message === "User already exists") {
    return "Пользователь с таким email уже зарегистрирован.";
  }

  if (message === "Invalid credentials") {
    return "Неверная почта или пароль.";
  }

  if (message.startsWith("Missing required columns:")) {
    const columns = message.replace("Missing required columns:", "").split(",").map((item) => item.trim()).filter(Boolean);
    const labels = {
      q: "q (объем продаж)",
      price: "price (цена)",
      vc_percent: "vc_percent (доля переменных затрат)",
      fc: "fc (постоянные затраты)",
      interest: "interest (процентные расходы)",
      tax_rate: "tax_rate (ставка налога)",
    };
    return `В файле отсутствуют обязательные колонки: ${columns.map((column) => labels[column] || column).join(", ")}. Проверьте заголовки в первой строке файла.`;
  }

  return message;
}

function HelpContent({ compact = false }) {
  return (
    <div className={compact ? "help-content compact" : "help-content"}>
      <p className="help-kicker">Как пользоваться</p>
      <h2>Короткая инструкция по работе с сервисом</h2>
      <p className="help-lead">Интерфейс специально сделан в три шага: загрузка данных, выбор сценария, просмотр результатов и риска по ключевым метрикам.</p>

      <div className="help-steps">
        {HELP_STEPS.map((step) => (
          <article key={step.title} className="help-step-card">
            <strong>{step.title}</strong>
            <p>{step.text}</p>
          </article>
        ))}
      </div>

      <div className="help-note">
        <strong>Подсказка</strong>
        <p>Если загрузка файла завершилась ошибкой, проверьте заголовки колонок и формат данных в первой строке.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("fsm_token") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthChecking, setIsAuthChecking] = useState(Boolean(localStorage.getItem("fsm_token")));
  const [currentUser, setCurrentUser] = useState(null);

  const [file, setFile] = useState(null);
  const [uploadData, setUploadData] = useState(null);
  const [scenarioType, setScenarioType] = useState("fx_growth");
  const [scenarioName, setScenarioName] = useState("Базовый сценарий");

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
  const [notice, setNotice] = useState(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setIsAuthChecking(false);
      setCurrentUser(null);
      setHistory([]);
      return;
    }

    setIsAuthChecking(true);
    me(token)
      .then((user) => {
        setCurrentUser(user);
        return listScenarios(token);
      })
      .then((res) => setHistory(res.items || []))
      .catch(() => {
        setToken("");
        localStorage.removeItem("fsm_token");
      })
      .finally(() => setIsAuthChecking(false));
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

  useEffect(() => {
    if (!notice || notice.type !== "success") return undefined;

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 3500);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  useEffect(() => {
    if (notice?.type !== "error" && !isHelpOpen) return undefined;

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [notice, isHelpOpen]);

  const chartData = useMemo(() => {
    if (!resultData?.result) return [];
    const { base_result: base, scenario_result: scenario } = resultData.result;
    return METRICS.map((metric) => ({
      metric: metric.label,
      База: base[metric.key],
      Сценарий: scenario[metric.key],
    }));
  }, [resultData]);

  const currentDelta = resultData?.result?.delta || {};

  function hideNotice() {
    setNotice(null);
  }

  function openHelp() {
    setIsHelpOpen(true);
  }

  function closeHelp() {
    setIsHelpOpen(false);
  }

  function showErrorNotice(title, message) {
    const normalizedMessage = humanizeErrorMessage(message);
    setErrorMessage(normalizedMessage);
    setNotice({ type: "error", title, message: normalizedMessage });
  }

  function showSuccessNotice(title, message) {
    setNotice({ type: "success", title, message });
  }

  async function handleRegister() {
    try {
      setErrorMessage("");
      hideNotice();
      await register(email, password);
      setAuthMode("login");
      setAuthMessage("Регистрация выполнена. Теперь войдите в систему.");
      showSuccessNotice("Аккаунт создан", "Регистрация прошла успешно. Теперь можно выполнить вход.");
    } catch (err) {
      showErrorNotice("Ошибка регистрации", err.message);
    }
  }

  async function handleLogin() {
    try {
      setErrorMessage("");
      hideNotice();
      const data = await login(email, password);
      setToken(data.access_token);
      localStorage.setItem("fsm_token", data.access_token);
      setPassword("");
      setAuthMode("login");
      setAuthMessage("Вход выполнен");
    } catch (err) {
      showErrorNotice("Ошибка входа", err.message);
    }
  }

  function logout() {
    setToken("");
    setCurrentUser(null);
    setAuthMessage("");
    setErrorMessage("");
    hideNotice();
    setScreen("controls");
    setHistory([]);
    localStorage.removeItem("fsm_token");
    setUploadData(null);
    setResultData(null);
  }

  async function handleUpload() {
    if (!file || !token) return;
    try {
      setLoading(true);
      setErrorMessage("");
      hideNotice();
      const data = await uploadFile(file, token);
      setUploadData(data);
      showSuccessNotice("Файл загружен", "Исходные данные успешно загружены и готовы для расчёта сценария.");
    } catch (err) {
      showErrorNotice("Ошибка загрузки файла", err.message);
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
      hideNotice();
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
      showErrorNotice("Ошибка расчёта сценария", err.message);
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
      showErrorNotice("Ошибка загрузки результата", err.message);
    } finally {
      setLoading(false);
    }
  }

  function switchAuthMode(mode) {
    setAuthMode(mode);
    setAuthMessage("");
    setErrorMessage("");
    hideNotice();
  }

  const helpModalNode = isHelpOpen ? (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="help-backdrop" onClick={closeHelp} />
      <section className="help-modal">
        <div className="help-modal-header">
          <div>
            <p className="help-kicker">Помощь</p>
            <h2 id="help-title">Инструкция по работе с сервисом</h2>
          </div>
          <button type="button" className="help-close-button" onClick={closeHelp} aria-label="Закрыть инструкцию">
            Закрыть
          </button>
        </div>
        <HelpContent />
      </section>
    </div>
  ) : null;

  const noticeNode = notice ? (
    notice.type === "error" ? (
      <div className="notice-overlay" role="alertdialog" aria-modal="true" aria-live="assertive">
        <div className="notice-backdrop" onClick={hideNotice} />
        <div className="notice-modal notice-error">
          <div className="notice-content">
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>
          <button type="button" className="notice-close" onClick={hideNotice} aria-label="Закрыть уведомление">
            Понятно
          </button>
        </div>
      </div>
    ) : (
      <div className="notice-toast notice-success" role="status" aria-live="polite">
        <div className="notice-content">
          <strong>{notice.title}</strong>
          <p>{notice.message}</p>
        </div>
      </div>
    )
  ) : null;

  if (isAuthChecking) {
    return (
      <div className="auth-shell">
        {noticeNode}
        <section className="auth-card">
          <h1>Проверяем сессию...</h1>
        </section>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="auth-shell">
        {noticeNode}
        {helpModalNode}
        <div className="auth-layout">
          <section className="auth-card">
            <p className="auth-kicker">StressTestBiz</p>
            <h1>Вход в систему моделирования</h1>
            <p className="auth-subtitle">Авторизуйтесь или создайте аккаунт, чтобы перейти к расчетам сценариев.</p>

            <div className="auth-tabs" role="tablist" aria-label="Выбор режима авторизации">
              <button className={authMode === "login" ? "active" : ""} onClick={() => switchAuthMode("login")}>
                Вход
              </button>
              <button className={authMode === "register" ? "active" : ""} onClick={() => switchAuthMode("register")}>
                Регистрация
              </button>
            </div>

            <div className="auth-form">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Электронная почта" autoComplete="email" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} />
              <button onClick={authMode === "login" ? handleLogin : handleRegister} disabled={!email || !password}>
                {authMode === "login" ? "Войти" : "Создать аккаунт"}
              </button>
            </div>

            {authMessage && <div className="auth-message">{authMessage}</div>}
          </section>

          <aside className="auth-help-card">
            <HelpContent compact />
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {noticeNode}
      {helpModalNode}
      <header className="header">
        <h1>Система моделирования финансовых сценариев</h1>
        <div className="header-actions">
          <div className="tabs">
            <button className={screen === "controls" ? "active" : ""} onClick={() => setScreen("controls")}>Управление</button>
            <button className={screen === "results" ? "active" : ""} onClick={() => setScreen("results")} disabled={!resultData}>Результаты</button>
          </div>
          <div className="user-panel">
            <button type="button" className="help-button" onClick={openHelp}>Помощь</button>
            <span>{currentUser?.email || email}</span>
            <button className="logout-button" onClick={logout}>Выйти</button>
          </div>
        </div>
      </header>

      {screen === "controls" && (
        <section className="panel">
          <h2>Экран 1 — Управление</h2>
          <div className="block">
            <h3>Загрузка файла</h3>
            <input type="file" accept=".csv,.json" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <p className="field-hint">Файл должен содержать колонки: q, price, vc_percent, fc, interest, tax_rate.</p>
            <button onClick={handleUpload} disabled={!file || loading || !token}>Загрузить</button>
            {uploadData && <pre>{JSON.stringify(uploadData.parsed_json, null, 2)}</pre>}
          </div>

          <div className="block">
            <h3>Выбор сценария</h3>
            <div className="scenario-header">
              <label className="scenario-name-field">
                <span>Название сценария</span>
                <input
                  className="scenario-name-input"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Название сценария"
                />
              </label>
            </div>

            <div className="scenario-type-group" role="tablist" aria-label="Тип сценария">
              {SCENARIO_TYPES.map((scenario) => (
                <button
                  key={scenario.key}
                  type="button"
                  className={scenarioType === scenario.key ? "scenario-type-button active" : "scenario-type-button"}
                  onClick={() => setScenarioType(scenario.key)}
                >
                  {scenario.label}
                </button>
              ))}
            </div>

            {scenarioType === "fx_growth" && (
              <div className="slider-row">
                <label>Курс валюты в сценарии: {scenarioFx}</label>
                <div className="slider-controls">
                  <input type="range" min="1" max="300" value={scenarioFx} onChange={(e) => setScenarioFx(clampNumber(e.target.value, 1, 300))} />
                  <input className="slider-number" type="number" min="1" max="300" step="1" value={scenarioFx} onChange={(e) => setScenarioFx(clampNumber(e.target.value, 1, 300))} />
                </div>
              </div>
            )}

            {scenarioType === "demand_drop" && (
              <div className="slider-row">
                <label>Спрос (% от базового объема): {demandPercent}%</label>
                <div className="slider-controls">
                  <input type="range" min="1" max="200" value={demandPercent} onChange={(e) => setDemandPercent(clampNumber(e.target.value, 1, 200))} />
                  <input className="slider-number" type="number" min="1" max="200" step="1" value={demandPercent} onChange={(e) => setDemandPercent(clampNumber(e.target.value, 1, 200))} />
                </div>
              </div>
            )}

            {scenarioType === "raw_material_growth" && (
              <div className="slider-row">
                <label>Доля переменных затрат (%): {rawVcPercent}</label>
                <div className="slider-controls">
                  <input type="range" min="0" max="100" step="0.1" value={rawVcPercent} onChange={(e) => setRawVcPercent(clampNumber(e.target.value, 0, 100))} />
                  <input className="slider-number" type="number" min="0" max="100" step="0.1" value={rawVcPercent} onChange={(e) => setRawVcPercent(clampNumber(e.target.value, 0, 100))} />
                </div>
              </div>
            )}

            {scenarioType === "custom" && (
              <div className="custom-grid">
                <label>Объем продаж<input type="range" min="0" max="1000000" value={customQ} onChange={(e) => setCustomQ(clampNumber(e.target.value, 0, 1000000))} /><input className="custom-number" type="number" min="0" max="1000000" step="1" value={customQ} onChange={(e) => setCustomQ(clampNumber(e.target.value, 0, 1000000))} /></label>
                <label>Цена<input type="range" min="0" max="1000000" value={customPrice} onChange={(e) => setCustomPrice(clampNumber(e.target.value, 0, 1000000))} /><input className="custom-number" type="number" min="0" max="1000000" step="1" value={customPrice} onChange={(e) => setCustomPrice(clampNumber(e.target.value, 0, 1000000))} /></label>
                <label>Доля переменных затрат (%)<input type="range" min="0" max="100" step="0.1" value={customVc} onChange={(e) => setCustomVc(clampNumber(e.target.value, 0, 100))} /><input className="custom-number" type="number" min="0" max="100" step="0.1" value={customVc} onChange={(e) => setCustomVc(clampNumber(e.target.value, 0, 100))} /></label>
                <label>Курс валюты<input type="range" min="0" max="500" step="0.1" value={customFx} onChange={(e) => setCustomFx(clampNumber(e.target.value, 0, 500))} /><input className="custom-number" type="number" min="0" max="500" step="0.1" value={customFx} onChange={(e) => setCustomFx(clampNumber(e.target.value, 0, 500))} /></label>
                <label>Постоянные затраты<input type="range" min="0" max="1000000" value={customFc} onChange={(e) => setCustomFc(clampNumber(e.target.value, 0, 1000000))} /><input className="custom-number" type="number" min="0" max="1000000" step="1" value={customFc} onChange={(e) => setCustomFc(clampNumber(e.target.value, 0, 1000000))} /></label>
              </div>
            )}

            <button onClick={handleRunScenario} disabled={!uploadData || loading || !token}>Запустить сценарий</button>
          </div>

          <div className="block">
            <h3>История сценариев</h3>
            <ul className="history-list">
              {history.map((item) => (
                <li key={item.scenario_id}>
                  <button onClick={() => openResult(item.scenario_id)}>{item.name}</button>
                  <span>{new Date(item.created_at).toLocaleString("ru-RU")}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {screen === "results" && resultData && (
        <section className="panel">
          <h2>Экран 2 — Результаты</h2>
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
                  <th>Метрика</th>
                  <th>База</th>
                  <th>Сценарий</th>
                  <th>Изменение</th>
                  <th>Изменение %</th>
                  <th>Риск</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(currentDelta).map(([key, delta]) => (
                  <tr key={key}>
                    <td>{metricLabel(key)}</td>
                    <td>{metricNumber(delta.base)}</td>
                    <td>{metricNumber(delta.scenario)}</td>
                    <td>{metricNumber(delta.delta_abs)}</td>
                    <td>{percentNumber(delta.delta_percent)}</td>
                    <td className={`risk-cell ${riskClass(delta)}`}>{riskLabel(delta.risk)}</td>
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
                <Bar dataKey="База" fill="#1f77b4" />
                <Bar dataKey="Сценарий" fill="#ff7f0e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
