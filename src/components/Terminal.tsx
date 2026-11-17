import { useState } from 'react';
export default function Terminal() {
  const [lines, setLines] = useState([
    { cmd: 'whoami', out: 'Cyber Security Learner' },
    { cmd: 'cat /etc/focus', out: 'Pwn  /  Web  /  CTF  /  Linux' },
    { cmd: 'ls ./knowledge', out: 'Writeups/  Notes/  Projects/  Tools/' },
  ]);
  const [input, setInput] = useState('');
  const run = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;
    const responses: Record<string, string> = {
      help: 'whoami · cat /etc/focus · ls ./knowledge · clear · help',
      whoami: 'Cyber Security Learner',
      'cat /etc/focus': 'Pwn  /  Web  /  CTF  /  Linux',
      'ls ./knowledge': 'Writeups/  Notes/  Projects/  Tools/',
    };
    if (cmd === 'clear') setLines([]);
    else
      setLines((l) =>
        [...l, { cmd, out: responses[cmd] || '教学终端：输入 help 查看支持的命令。' }].slice(-6),
      );
    setInput('');
  };
  return (
    <div className="terminal-window">
      <div className="terminal-title">
        <span className="window-dots">
          <i />
          <i />
          <i />
        </span>
        <span>wu_m1ng@lab: ~</span>
        <span>⌘</span>
      </div>
      <div className="terminal-content" aria-live="polite">
        {lines.map((l, i) => (
          <div className="terminal-entry" key={i}>
            <div>
              <span className="terminal-prompt">❯</span> {l.cmd}
            </div>
            <p>{l.out}</p>
          </div>
        ))}
        <form onSubmit={run}>
          <label className="terminal-prompt" htmlFor="terminal-input">
            ❯
          </label>
          <input
            id="terminal-input"
            aria-label="教学终端命令"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            spellCheck="false"
            placeholder="help"
            maxLength={100}
          />
          <span className="cursor" />
        </form>
      </div>
      <div className="terminal-status">
        <span>
          <i className="status-dot" /> browser sandbox
        </span>
        <span>UTF-8　 zsh (simulated)</span>
      </div>
    </div>
  );
}
