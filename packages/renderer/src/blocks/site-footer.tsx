/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import type { SiteFooterBlock } from "@sosb/schema";
import type { AssetUrlForPath } from "../asset-url.js";
import { resolveAssetUrl } from "../asset-url.js";
import { ContactIcon, iconNameForPlatform, type IconName } from "./contact-icons.js";

const PLATFORM_LABELS: Readonly<Record<string, string>> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  twitter: "Twitter",
  x: "Twitter",
  youtube: "YouTube",
  tiktok: "TikTok",
  github: "GitHub",
};

const EMAIL_REVEAL_SCRIPT =
  '(function(){var els=document.querySelectorAll("[data-site-footer-email]");for(var i=0;i<els.length;i++){(function(el){function reveal(){var l=el.getAttribute("data-site-footer-local");var d=el.getAttribute("data-site-footer-domain");if(!l||!d)return;var addr=atob(l)+String.fromCharCode(64)+atob(d);el.setAttribute("href","mailto:"+addr);el.textContent=addr;el.removeAttribute("data-site-footer-local");el.removeAttribute("data-site-footer-domain");}el.addEventListener("click",reveal,{once:true});el.addEventListener("focus",reveal,{once:true});el.addEventListener("pointerover",reveal,{once:true});})(els[i]);}})();';

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function platformLabel(platform: string): string {
  const known = PLATFORM_LABELS[platform.trim().toLowerCase()];
  if (known !== undefined) return known;
  const t = platform.trim();
  return t.length === 0 ? "Link" : t.charAt(0).toUpperCase() + t.slice(1);
}

function toBase64(input: string): string {
  const utf8: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let codePoint = input.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
      const low = input.charCodeAt(i + 1);
      codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
      i += 1;
    }
    if (codePoint < 0x80) utf8.push(codePoint);
    else if (codePoint < 0x800) {
      utf8.push(0xc0 | (codePoint >> 6));
      utf8.push(0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      utf8.push(0xe0 | (codePoint >> 12));
      utf8.push(0x80 | ((codePoint >> 6) & 0x3f));
      utf8.push(0x80 | (codePoint & 0x3f));
    } else {
      utf8.push(0xf0 | (codePoint >> 18));
      utf8.push(0x80 | ((codePoint >> 12) & 0x3f));
      utf8.push(0x80 | ((codePoint >> 6) & 0x3f));
      utf8.push(0x80 | (codePoint & 0x3f));
    }
  }
  const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let i = 0;
  while (i < utf8.length) {
    const a = utf8[i++]!;
    const b = i < utf8.length ? utf8[i++]! : -1;
    const c = i < utf8.length ? utf8[i++]! : -1;
    const triplet = (a << 16) | ((b !== -1 ? b : 0) << 8) | (c !== -1 ? c : 0);
    out += alpha[(triplet >> 18) & 0x3f];
    out += alpha[(triplet >> 12) & 0x3f];
    out += b !== -1 ? alpha[(triplet >> 6) & 0x3f] : "=";
    out += c !== -1 ? alpha[triplet & 0x3f] : "=";
  }
  return out;
}

function toNumericRefs(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i += 1) {
    out += `&#${input.charCodeAt(i).toString(10)};`;
  }
  return out;
}

function FooterContactItem(props: {
  icon: IconName;
  children: ComponentChildren;
}): preact.JSX.Element {
  return (
    <li class="site-footer__contact-item">
      <span class="site-footer__contact-icon">
        <ContactIcon name={props.icon} />
      </span>
      <span class="site-footer__contact-body">{props.children}</span>
    </li>
  );
}

export function SiteFooter(props: {
  block: SiteFooterBlock;
  assetUrlForPath?: AssetUrlForPath | undefined;
}): preact.JSX.Element | null {
  const { id, data } = props.block;
  const title = asString(data.title);
  const contactTitle = asString(data.contactTitle);
  const address = asString(data.address);
  const email = asString(data.email);
  const phone = asString(data.phone);
  const phoneTel = phone !== undefined ? phone.replace(/[^\d+]/g, "") : undefined;
  const membership =
    typeof data.membership === "object" && data.membership !== null ? data.membership : undefined;

  const socials = (Array.isArray(data.socials) ? data.socials : [])
    .map((social) => ({
      platform: asString(social.platform) ?? "link",
      url: asString(social.url),
    }))
    .filter((social): social is { platform: string; url: string } => social.url !== undefined);

  let emailLocalB64: string | undefined;
  let emailDomainB64: string | undefined;
  let emailNoscript: string | undefined;
  if (email !== undefined) {
    const atIdx = email.indexOf("@");
    if (atIdx > 0 && atIdx < email.length - 1) {
      emailLocalB64 = toBase64(email.slice(0, atIdx));
      emailDomainB64 = toBase64(email.slice(atIdx + 1));
      emailNoscript = toNumericRefs(email);
    }
  }
  const hasEmail = emailLocalB64 !== undefined && emailDomainB64 !== undefined;
  const hasContact =
    socials.length > 0 || hasEmail || phoneTel !== undefined || address !== undefined;
  const hasMembership =
    membership !== undefined &&
    (asString(membership.text) !== undefined ||
      asString(membership.name) !== undefined ||
      membership.logo !== undefined);

  if (!hasContact && !hasMembership) return null;

  const labelledBy = title !== undefined ? `${id}__title` : undefined;
  const contactLabelledBy = contactTitle !== undefined ? `${id}__contact-title` : undefined;

  return (
    <footer
      data-block="siteFooter"
      data-block-id={id}
      class="site-footer"
      aria-labelledby={labelledBy}
    >
      <div class="site-footer__inner">
        {title !== undefined && (
          <h2 id={`${id}__title`} class="site-footer__title">
            {title}
          </h2>
        )}
        {hasContact && (
          <section
            class="site-footer__contact"
            aria-labelledby={contactLabelledBy}
            aria-label={contactLabelledBy === undefined ? "Contact" : undefined}
          >
            {contactTitle !== undefined && (
              <h3 id={`${id}__contact-title`} class="site-footer__heading">
                {contactTitle}
              </h3>
            )}
            <ul class="site-footer__contact-list">
              {socials.map((social, idx) => (
                <FooterContactItem
                  key={`${id}__social_${idx}`}
                  icon={iconNameForPlatform(social.platform)}
                >
                  <a class="site-footer__link" href={social.url} rel="noopener noreferrer">
                    {platformLabel(social.platform)}
                  </a>
                </FooterContactItem>
              ))}
              {hasEmail && (
                <FooterContactItem icon="mail">
                  <a
                    href="#"
                    class="site-footer__link site-footer__email"
                    data-site-footer-email=""
                    data-site-footer-local={emailLocalB64}
                    data-site-footer-domain={emailDomainB64}
                    aria-label="Reveal contact email and open mail composer"
                    rel="noopener noreferrer"
                  >
                    <span aria-hidden="true">[ click to reveal email ]</span>
                  </a>
                  {emailNoscript !== undefined && (
                    <noscript>
                      <span
                        class="site-footer__email-fallback"
                        dangerouslySetInnerHTML={{ __html: emailNoscript }}
                      />
                    </noscript>
                  )}
                </FooterContactItem>
              )}
              {phoneTel !== undefined && (
                <FooterContactItem icon="phone">
                  <a class="site-footer__link site-footer__phone" href={`tel:${phoneTel}`}>
                    {phone}
                  </a>
                </FooterContactItem>
              )}
              {address !== undefined && (
                <FooterContactItem icon="map-pin">
                  <address class="site-footer__address">{address}</address>
                </FooterContactItem>
              )}
            </ul>
          </section>
        )}
        {hasMembership && membership !== undefined && (
          <Membership id={id} membership={membership} assetUrlForPath={props.assetUrlForPath} />
        )}
      </div>
      {hasEmail && (
        <script
          data-site-footer-reveal=""
          dangerouslySetInnerHTML={{ __html: EMAIL_REVEAL_SCRIPT }}
        />
      )}
    </footer>
  );
}

function Membership(props: {
  id: string;
  membership: NonNullable<SiteFooterBlock["data"]["membership"]>;
  assetUrlForPath?: AssetUrlForPath | undefined;
}): preact.JSX.Element {
  const text = asString(props.membership.text);
  const name = asString(props.membership.name);
  const url = asString(props.membership.url);
  const logo = props.membership.logo;
  const content = (
    <>
      {text !== undefined && <span class="site-footer__membership-text">{text}</span>}
      {logo !== undefined && (
        <img
          class="site-footer__membership-logo"
          src={resolveAssetUrl(logo.path, props.assetUrlForPath)}
          alt={typeof logo.alt === "string" ? logo.alt : (name ?? "")}
          loading="lazy"
          width={logo.width > 0 ? logo.width : undefined}
          height={logo.height > 0 ? logo.height : undefined}
        />
      )}
      {logo === undefined && name !== undefined && (
        <span class="site-footer__membership-name">{name}</span>
      )}
    </>
  );

  return (
    <section class="site-footer__membership" aria-labelledby={`${props.id}__membership-title`}>
      <h3 id={`${props.id}__membership-title`} class="visually-hidden">
        Membership
      </h3>
      {url !== undefined ? (
        <a class="site-footer__membership-link" href={url} rel="noopener noreferrer">
          {content}
        </a>
      ) : (
        <div class="site-footer__membership-link">{content}</div>
      )}
    </section>
  );
}
