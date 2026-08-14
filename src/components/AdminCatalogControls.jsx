import { useMemo, useRef, useState } from "react";

import ConfirmDialog from "./ConfirmDialog";
import useCatalog from "../context/useCatalog";
import { supabase } from "../lib/supabase";
import { catalogChampionPayload, catalogTraitPayload, parseChampionCatalogCsv, parseTraitCatalogCsv } from "../utils/catalogImport";

function summarizeIssues(issues) {
  if (!issues.length) return null;
  return `${issues.slice(0, 2).join(" ")}${issues.length > 2 ? ` ${issues.length - 2} more row issues.` : ""}`;
}

function AdminCatalogControls({ onUpdated }) {
  const { champions, refreshCatalog, source, traits } = useCatalog();
  const championInputRef = useRef(null);
  const traitInputRef = useRef(null);
  const [championRows, setChampionRows] = useState([]);
  const [traitRows, setTraitRows] = useState([]);
  const [championLabel, setChampionLabel] = useState("");
  const [traitLabel, setTraitLabel] = useState("");
  const [issues, setIssues] = useState([]);
  const [mode, setMode] = useState("merge");
  const [publishTarget, setPublishTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const preview = useMemo(() => ({ champions: championRows.slice(0, 4), traits: traitRows.slice(0, 4) }), [championRows, traitRows]);
  const publishable = championRows.length > 0 || traitRows.length > 0;

  const readCatalogFile = async (event, kind) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    const parsed = kind === "champions" ? parseChampionCatalogCsv(raw) : parseTraitCatalogCsv(raw);
    if (kind === "champions") {
      setChampionRows(parsed.rows);
      setChampionLabel(file.name);
    } else {
      setTraitRows(parsed.rows);
      setTraitLabel(file.name);
    }
    setIssues(parsed.issues);
    setMessage(parsed.rows.length ? { type: "success", text: `${parsed.rows.length} ${kind === "champions" ? "champion" : "trait"} rows are ready to review.` } : { type: "error", text: `No valid ${kind === "champions" ? "champion" : "trait"} rows were found in that file.` });
    event.target.value = "";
  };

  const stageBundledCatalog = () => {
    setChampionRows(champions.map(catalogChampionPayload));
    setTraitRows(traits.map(catalogTraitPayload));
    setChampionLabel("Current Lumio source");
    setTraitLabel("Current Lumio source");
    setIssues([]);
    setMode("replace");
    setMessage({ type: "success", text: `Current source staged: ${champions.length} champions and ${traits.length} traits.` });
  };

  const requestPublish = () => {
    if (!publishable) {
      setMessage({ type: "error", text: "Choose a CSV file or stage the current source before publishing." });
      return;
    }
    if (source === "bundled" && mode !== "replace") {
      setMessage({ type: "error", text: "Your first live catalog publish must be a full replacement. Stage the current Lumio source or choose both complete CSV files, then use Replace catalog." });
      return;
    }
    if (mode === "replace" && (!championRows.length || !traitRows.length)) {
      setMessage({ type: "error", text: "Full replacement needs both a champions.csv and a traits.csv so nothing is unintentionally retired." });
      return;
    }
    setPublishTarget({ mode, championCount: championRows.length, traitCount: traitRows.length });
  };

  const publishCatalog = async () => {
    if (!publishTarget) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_publish_catalog", {
      incoming_champions: championRows,
      incoming_traits: traitRows,
      publish_mode: publishTarget.mode,
    });
    if (error) {
      setMessage({ type: "error", text: error.message || "Unable to publish this catalog." });
    } else {
      await Promise.all([refreshCatalog(), onUpdated()]);
      setMessage({ type: "success", text: publishTarget.mode === "replace" ? "Live catalog replaced. Entries missing from the import were retired safely." : "Catalog changes are live across Lumio." });
      setChampionRows([]);
      setTraitRows([]);
      setChampionLabel("");
      setTraitLabel("");
    }
    setBusy(false);
    setPublishTarget(null);
  };

  return (
    <section className="admin-panel admin-catalog-controls">
      <div className="admin-panel-heading"><div><p className="eyebrow">Catalog studio</p><h2>Publish game data</h2></div><span className={`admin-catalog-source is-${source}`}>{source === "live" ? "Live database" : "Bundled fallback"}</span></div>
      <p className="admin-panel-copy">Update Lumio’s champions and traits without touching code or redeploying. Import your CSVs, inspect the parsed rows, then publish when ready. Existing owned copies and trade history remain intact.</p>

      <div className="admin-catalog-upload-grid"><article><span>Champions</span><strong>{championRows.length ? `${championRows.length} rows ready` : "No file staged"}</strong><small>{championLabel || "Accepts Champions, Rarity, stats, and Clan Points columns."}</small><input accept=".csv,text/csv" hidden onChange={(event) => void readCatalogFile(event, "champions")} ref={championInputRef} type="file" /><button className="secondary-action" onClick={() => championInputRef.current?.click()} type="button">Choose champions.csv</button></article><article><span>Traits</span><strong>{traitRows.length ? `${traitRows.length} rows ready` : "No file staged"}</strong><small>{traitLabel || "Accepts Trait, Rarity, bonus, and Notes columns."}</small><input accept=".csv,text/csv" hidden onChange={(event) => void readCatalogFile(event, "traits")} ref={traitInputRef} type="file" /><button className="secondary-action" onClick={() => traitInputRef.current?.click()} type="button">Choose traits.csv</button></article></div>

      <div className="admin-catalog-tools"><button className="quiet-action" onClick={stageBundledCatalog} type="button">Stage current Lumio source</button><div className="admin-catalog-mode" role="group" aria-label="Catalog publish mode"><button aria-pressed={mode === "merge"} onClick={() => setMode("merge")} type="button"><strong>Merge changes</strong><small>Add or update only staged rows</small></button><button aria-pressed={mode === "replace"} onClick={() => setMode("replace")} type="button"><strong>Replace catalog</strong><small>Retire entries absent from both files</small></button></div><button className="success-action" disabled={!publishable} onClick={requestPublish} type="button">Publish catalog</button></div>

      <div className="admin-catalog-preview"><div><p className="eyebrow">Preview</p><h3>Champion changes</h3>{preview.champions.length ? preview.champions.map((champion) => <article key={champion.catalog_key}><strong>{champion.name}</strong><span>{champion.rarity} · +{champion.stat_total}% · {champion.clan_points} Clan Points</span></article>) : <p>No champion rows staged.</p>}</div><div><p className="eyebrow">Preview</p><h3>Trait changes</h3>{preview.traits.length ? preview.traits.map((trait) => <article key={trait.catalog_key}><strong>{trait.name}</strong><span>{trait.rarity} · +{trait.bonus_total}% total effect</span></article>) : <p>No trait rows staged.</p>}</div></div>
      {summarizeIssues(issues) && <p className="inline-error" role="alert">{summarizeIssues(issues)}</p>}
      {message && <p className={message.type === "success" ? "inline-success" : "inline-error"} role={message.type === "success" ? "status" : "alert"}>{message.text}</p>}

      {publishTarget && <ConfirmDialog busy={busy} cancelLabel="Keep reviewing" confirmLabel={publishTarget.mode === "replace" ? "Replace live catalog" : "Publish changes"} danger={publishTarget.mode === "replace"} description={publishTarget.mode === "replace" ? `Replace the live catalog with ${publishTarget.championCount} champion rows and ${publishTarget.traitCount} trait rows? Missing entries will be retired from new selections but preserved in existing collections and trade history.` : `Publish ${publishTarget.championCount} champion rows and ${publishTarget.traitCount} trait rows to the live Lumio catalog?`} onCancel={() => setPublishTarget(null)} onConfirm={() => void publishCatalog()} title={publishTarget.mode === "replace" ? "Replace live catalog?" : "Publish catalog changes?"} />}
    </section>
  );
}

export default AdminCatalogControls;
