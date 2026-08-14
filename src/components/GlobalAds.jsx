import { useCallback, useEffect, useMemo, useState } from "react";

import useAuth from "../context/useAuth";
import { supabase } from "../lib/supabase";

const AD_FIELDS = "id, title, body, accent_color, placement, audience, primary_button_label, primary_button_url, secondary_button_label, secondary_button_url, dismiss_label, show_once, is_dismissible, priority, created_at";

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

function audienceMatches(ad, user) {
  return ad.audience === "all"
    || (ad.audience === "signed_in" && Boolean(user))
    || (ad.audience === "signed_out" && !user);
}

function adPreferenceKey(ad) {
  return `lumio-site-ad:${ad.id}`;
}

function rememberDismissal(ad) {
  if (!ad.show_once) return;
  try {
    window.localStorage.setItem(adPreferenceKey(ad), "dismissed");
  } catch {
    // The current session still keeps the ad closed if storage is unavailable.
  }
}

function wasDismissed(ad) {
  if (!ad.show_once) return false;
  try {
    return window.localStorage.getItem(adPreferenceKey(ad)) === "dismissed";
  } catch {
    return false;
  }
}

function AdAction({ label, url, variant, onDismiss }) {
  if (!label || !url) return null;
  const external = isExternalUrl(url);

  return (
    <a className={variant} href={url} onClick={onDismiss} rel={external ? "noreferrer" : undefined} target={external ? "_blank" : undefined}>
      {label} {external && <span aria-hidden="true">↗</span>}
    </a>
  );
}

function AdModal({ ad, onDismiss }) {
  return (
    <div className="global-ad-modal-overlay" role="presentation">
      <section aria-describedby={`site-ad-copy-${ad.id}`} aria-labelledby={`site-ad-title-${ad.id}`} aria-modal="true" className="global-ad-modal" role="dialog" style={{ "--ad-accent": ad.accent_color }}>
        <span className="global-ad-modal-accent" aria-hidden="true" />
        <p className="eyebrow">Lumio announcement</p>
        <h2 id={`site-ad-title-${ad.id}`}>{ad.title || "Lumio announcement"}</h2>
        {ad.body && <p id={`site-ad-copy-${ad.id}`}>{ad.body}</p>}
        <div className="global-ad-actions">
          {ad.is_dismissible && <button className="secondary-action" onClick={onDismiss} type="button">{ad.dismiss_label}</button>}
          <AdAction label={ad.secondary_button_label} onDismiss={onDismiss} url={ad.secondary_button_url} variant="secondary-action" />
          <AdAction label={ad.primary_button_label} onDismiss={onDismiss} url={ad.primary_button_url} variant="global-ad-primary-action" />
        </div>
      </section>
    </div>
  );
}

function AdBanner({ ad, onDismiss }) {
  return (
    <section className="global-ad-banner" style={{ "--ad-accent": ad.accent_color }}>
      <span className="global-ad-banner-dot" aria-hidden="true" />
      <div>
        {ad.title && <strong>{ad.title}</strong>}
        {ad.body && <p>{ad.body}</p>}
      </div>
      <div className="global-ad-banner-actions">
        <AdAction label={ad.secondary_button_label} onDismiss={onDismiss} url={ad.secondary_button_url} variant="global-ad-banner-link" />
        <AdAction label={ad.primary_button_label} onDismiss={onDismiss} url={ad.primary_button_url} variant="global-ad-banner-link primary" />
        {ad.is_dismissible && <button aria-label={`Dismiss ${ad.title || "announcement"}`} onClick={onDismiss} type="button">×</button>}
      </div>
    </section>
  );
}

function GlobalAds() {
  const { user } = useAuth();
  const [ads, setAds] = useState([]);
  const [dismissedIds, setDismissedIds] = useState([]);

  useEffect(() => {
    let active = true;

    const loadAds = async () => {
      const { data } = await supabase
        .from("site_ads")
        .select(AD_FIELDS)
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (active) setAds(data || []);
    };

    void loadAds();
    return () => {
      active = false;
    };
  }, []);

  const dismissAd = useCallback((ad) => {
    rememberDismissal(ad);
    setDismissedIds((current) => current.includes(ad.id) ? current : [...current, ad.id]);
  }, []);

  const eligibleAds = useMemo(() => ads.filter((ad) => (
    audienceMatches(ad, user)
    && !dismissedIds.includes(ad.id)
    && !wasDismissed(ad)
  )), [ads, dismissedIds, user]);
  const modalAd = eligibleAds.find((ad) => ad.placement === "modal");
  const bannerAds = eligibleAds.filter((ad) => ad.placement === "banner");

  return (
    <>
      {bannerAds.length > 0 && <div className="global-ad-banner-stack">{bannerAds.map((ad) => <AdBanner ad={ad} key={ad.id} onDismiss={() => dismissAd(ad)} />)}</div>}
      {modalAd && <AdModal ad={modalAd} onDismiss={() => dismissAd(modalAd)} />}
    </>
  );
}

export default GlobalAds;
