import { useMemo, useState } from "react";

import ListingArtwork from "./ListingArtwork";
import traitEffectSummary from "../utils/traitEffectSummary";

function CatalogPickerDialog({ getItemMeta, items, kind, onChoose, onClose, selectedValue, title }) {
  const [query, setQuery] = useState("");
  const isTraitPicker = kind === "trait";
  const pickerItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const choices = isTraitPicker
      ? [{ name: "Standard", rarity: "Base", isStandard: true }, ...items]
      : items;

    if (!normalizedQuery) return choices;
    return choices.filter((item) => [item.name, isTraitPicker ? item.rarity : null, traitEffectSummary(item), getItemMeta?.(item)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery)));
  }, [getItemMeta, isTraitPicker, items, query]);

  const selectItem = (item) => {
    onChoose(isTraitPicker ? item.name : item);
    onClose();
  };

  return (
    <div className="modal-overlay catalog-picker-overlay" role="presentation">
      <section aria-modal="true" className="trade-modal catalog-picker-modal" role="dialog" aria-labelledby="catalog-picker-title">
        <header className="catalog-picker-header">
          <div>
            <p className="eyebrow">Collection catalog</p>
            <h2 id="catalog-picker-title">{title}</h2>
          </div>
          <button aria-label="Close picker" className="modal-close-button" onClick={onClose} type="button">×</button>
        </header>
        <label className="catalog-picker-search">
          <span className="sr-only">Search {isTraitPicker ? "traits" : "champions"}</span>
          <input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder={isTraitPicker ? "Search traits or effects" : "Search champions by name"} type="search" value={query} />
        </label>
        {pickerItems.length ? (
          <div className={`catalog-picker-grid ${isTraitPicker ? "trait-picker-grid" : "champion-picker-grid"}`}>
            {pickerItems.map((item) => {
              const value = isTraitPicker ? item.name : item.id;
              const selected = String(value) === String(selectedValue);
              return isTraitPicker ? (
                <button aria-pressed={selected} className={`catalog-picker-card trait-picker-card${selected ? " is-selected" : ""}`} key={item.name} onClick={() => selectItem(item)} type="button">
                  <span className="catalog-picker-card-top"><span className="rarity-badge">{item.rarity}</span>{selected && <span className="picker-selected-label">Selected</span>}</span>
                  <strong>{item.name}</strong>
                  <span>{traitEffectSummary(item)}</span>
                  {item.notes && <small>{item.notes}</small>}
                </button>
              ) : (
                <button aria-pressed={selected} className={`catalog-picker-card champion-picker-card${selected ? " is-selected" : ""}`} key={item.id} onClick={() => selectItem(item)} type="button">
                  <ListingArtwork imageUrl={item.image_url} name={item.name} trait={item.trait} />
                  {selected && <span className="catalog-picker-card-top"><span className="picker-selected-label">Selected</span></span>}
                  <strong>{item.name}</strong>
                  <span>{getItemMeta ? getItemMeta(item) : "Choose this champion"}</span>
                </button>
              );
            })}
          </div>
        ) : <p className="catalog-picker-empty">No catalog entries match that search.</p>}
      </section>
    </div>
  );
}

export default CatalogPickerDialog;
