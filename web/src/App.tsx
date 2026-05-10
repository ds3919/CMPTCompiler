import { useMemo, useState } from "react";
import Convert from "ansi-to-html";
import { compileSource } from "./compilerRunner";
import "./App.css";

const starterCode = `{
  int a
  a = 5
  print(a)
}$`;

function App() {
  const [source, setSource] = useState(starterCode);
  const [terminalOutput, setTerminalOutput] = useState("Compiler output will appear here.");
  const [showDetails, setShowDetails] = useState(false);

  const converter = useMemo(() => {
    return new Convert({
      fg: "#f4f4f5",
      bg: "#2b3038",
      newline: true,
      escapeXML: true
    });
  }, []);

  function compileCode(): void {
    const rawOutput = compileSource(source, showDetails);
    const htmlOutput = converter.toHtml(rawOutput);
    setTerminalOutput(htmlOutput);
  }

  function clearTerminal(): void {
    setTerminalOutput("Compiler output will appear here.");
  }

  return (
    <main className="page">
      <section className="header">
        <div>
          <h1>CMPT Compiler</h1>
          <p>Write code, compile it, and view the output in a browser terminal.</p>
        </div>

        <div className="actions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={showDetails}
              onChange={event => setShowDetails(event.target.checked)}
            />
            Detailed output
          </label>

          <button className="secondaryButton" onClick={clearTerminal}>
            Clear
          </button>

          <button onClick={compileCode}>
            Compile
          </button>
        </div>
      </section>

      <section className="workspace">
        <div className="panel">
          <div className="panelHeader">Source</div>
          <textarea
            value={source}
            onChange={event => setSource(event.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="panel">
          <div className="panelHeader">Terminal</div>
          <pre
            className="terminal"
            dangerouslySetInnerHTML={{ __html: terminalOutput }}
          />
        </div>
      </section>
    </main>
  );
}

export default App;