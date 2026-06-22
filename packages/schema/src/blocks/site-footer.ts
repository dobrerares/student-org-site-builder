import { z } from "zod";
import { isAcceptableLinkUrl } from "../url.js";
import { AssetRefSchema } from "./asset-ref.js";

const SiteFooterSocialLinkSchema = z.looseObject({
  platform: z.string().min(1),
  url: z.string().min(1).refine(isAcceptableLinkUrl, {
    message:
      "Footer social link URL is malformed. Use a full URL (https://example.org), a site-relative path (/contact), or mailto:/tel: links.",
  }),
});

const SiteFooterMembershipSchema = z.looseObject({
  text: z.string().min(1),
  name: z.string().optional(),
  url: z
    .string()
    .min(1)
    .refine(isAcceptableLinkUrl, {
      message:
        "Footer membership URL is malformed. Use a full URL (https://example.org), a site-relative path (/contact), or mailto:/tel: links.",
    })
    .optional(),
  logo: AssetRefSchema.optional(),
});

export const SiteFooterDataSchema = z.looseObject({
  title: z.string().optional(),
  contactTitle: z.string().optional(),
  address: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  socials: z.array(SiteFooterSocialLinkSchema).optional(),
  membership: SiteFooterMembershipSchema.optional(),
});

export const SiteFooterBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("siteFooter"),
  version: z.literal(1),
  data: SiteFooterDataSchema,
});

export const SITE_FOOTER_BLOCK_VERSION = 1 as const;

export type SiteFooterSocialLink = z.infer<typeof SiteFooterSocialLinkSchema>;
export type SiteFooterMembership = z.infer<typeof SiteFooterMembershipSchema>;
export type SiteFooterData = z.infer<typeof SiteFooterDataSchema>;
export type SiteFooterBlock = z.infer<typeof SiteFooterBlockSchema>;
