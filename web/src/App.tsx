import { useMemo, useRef, useState } from "react";
import Convert from "ansi-to-html";
import { compileSource } from "./compilerRunner";
import "./App.css";

type CompiledProgram = {
  label: string;
  code: string;
};

const starterCode = `{
  int a
  a = 5
  print(a)
}$`;

function App() {
  const [source, setSource] = useState(starterCode);
  const [terminalOutput, setTerminalOutput] = useState("Compiler output will appear here.");
  const [showDetails, setShowDetails] = useState(false);
  const [compiledPrograms, setCompiledPrograms] = useState<CompiledProgram[]>([]);
  const [selectedProgramIndex, setSelectedProgramIndex] = useState("0");
  const [copyStatus, setCopyStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    const programs = extractCompiledPrograms(rawOutput);

    setTerminalOutput(htmlOutput);
    setCompiledPrograms(programs);
    setSelectedProgramIndex("0");
    setCopyStatus("");
  }

  function clearTerminal(): void {
    setTerminalOutput("Compiler output will appear here.");
    setCompiledPrograms([]);
    setSelectedProgramIndex("0");
    setCopyStatus("");
  }

  function openFilePicker(): void {
    fileInputRef.current?.click();
  }

  async function importSourceFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];

    if (file === undefined) {
      return;
    }

    if (!file.name.endsWith(".cmpt")) {
      setTerminalOutput(
        converter.toHtml(
          "\x1b[38;2;239;130;130mImport failed: expected a .cmpt source file.\x1b[0m"
        )
      );

      event.target.value = "";
      return;
    }

    const fileText = await file.text();

    setSource(fileText);
    setTerminalOutput(`Imported ${file.name}. Press Compile to compile it.`);
    setCompiledPrograms([]);
    setSelectedProgramIndex("0");
    setCopyStatus("");

    event.target.value = "";
  }

  async function copySelectedProgram(): Promise<void> {
    const selectedProgram = compiledPrograms[Number(selectedProgramIndex)];

    if (selectedProgram === undefined) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedProgram.code);
      setCopyStatus(`Copied ${selectedProgram.label}`);
    } catch {
      setCopyStatus("Copy failed");
    }
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

          <button className="secondaryButton" onClick={openFilePicker}>
            Import File
          </button>

          <input
            ref={fileInputRef}
            className="hiddenFileInput"
            type="file"
            accept=".cmpt,text/plain"
            onChange={importSourceFile}
          />

          <select
            className="programSelect"
            value={selectedProgramIndex}
            onChange={event => {
              setSelectedProgramIndex(event.target.value);
              setCopyStatus("");
            }}
            disabled={compiledPrograms.length === 0}
          >
            {compiledPrograms.length === 0 ? (
              <option>No compiled programs</option>
            ) : (
              compiledPrograms.map((program, index) => (
                <option key={program.label} value={String(index)}>
                  {program.label}
                </option>
              ))
            )}
          </select>

          <button
            className="copyButton"
            onClick={copySelectedProgram}
            disabled={compiledPrograms.length === 0}
          >
            Copy Hex
          </button>

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

          {copyStatus.length > 0 && (
            <div className="copyStatus">{copyStatus}</div>
          )}

          <pre
            className="terminal"
            dangerouslySetInnerHTML={{ __html: terminalOutput }}
          />
        </div>
      </section>
    </main>
  );
}

function extractCompiledPrograms(rawOutput: string): CompiledProgram[] {
  const cleanOutput = stripAnsi(rawOutput);
  const generatedCodeIndex = cleanOutput.indexOf("GENERATED CODE:");

  if (generatedCodeIndex === -1) {
    return [];
  }

  const generatedCodeSection = cleanOutput.slice(generatedCodeIndex);
  const programRegex = /(Program \d+):\s*\n([0-9A-Fa-f\s]+?)(?=\nProgram \d+:|\s*$)/g;

  const programs: CompiledProgram[] = [];
  let match: RegExpExecArray | null;

  while ((match = programRegex.exec(generatedCodeSection)) !== null) {
    const label = match[1];
    const code = match[2]
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();

    if (code.length > 0) {
      programs.push({
        label,
        code
      });
    }
  }

  return programs;
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

export default App;