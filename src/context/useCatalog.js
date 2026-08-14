import { useContext } from "react";

import CatalogContext from "./catalog-context";

export default function useCatalog() {
  const catalog = useContext(CatalogContext);
  if (!catalog) throw new Error("useCatalog must be used within a CatalogProvider");
  return catalog;
}
