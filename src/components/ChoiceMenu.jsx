import { useState } from "react";

function ChoiceMenu({ label, onChange, options, value }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <div className="choice-menu">
      <span className="choice-menu-label">{label}</span>
      <button aria-expanded={open} aria-haspopup="listbox" className="choice-menu-trigger" onClick={() => setOpen((current) => !current)} type="button">
        <span>{selected?.label || "Choose"}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {open && (
        <div className="choice-menu-options" role="listbox">
          {options.map((option) => (
            <button aria-selected={option.value === value} className={option.value === value ? "is-selected" : ""} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }} role="option" type="button">
              {option.label}
              {option.value === value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChoiceMenu;
