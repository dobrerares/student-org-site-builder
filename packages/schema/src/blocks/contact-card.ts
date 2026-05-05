import { z } from "zod";

/**
 * `contactCard` block — issue #13.
 *
 * Privacy-sensitive shape:
 *
 *  - `email` is the address an end user can reach the org at. The renderer
 *    obfuscates it via a JS-reveal pattern so it never appears as plain text
 *    in the rendered HTML; the schema simply carries the literal value.
 *  - `mapEmbed` is opt-in. The default behaviour for a published site is to
 *    issue zero third-party network requests; only when `mapEmbed.enabled`
 *    is true does the renderer emit an iframe. `provider = "osm"` is the
 *    default privacy-friendly option (no API key, no Google contact);
 *    `provider = "google"` is the opt-in escape hatch and requires
 *    `acknowledgedPrivacyNotice: true` to ship — the editor surfaces the
 *    notice and writes the flag.
 *
 *  - Coordinates are a `[lat, lng]` array in degrees (numbers, not strings)
 *    so the renderer can compose the bbox / marker URL deterministically.
 */
const SocialLinkSchema = z.looseObject({
  platform: z.string().min(1),
  url: z.string().min(1),
});

const MapCoordinatesSchema = z.tuple([z.number(), z.number()]);

const MapEmbedSchema = z
  .looseObject({
    enabled: z.boolean(),
    provider: z.enum(["osm", "google"]),
    coordinates: MapCoordinatesSchema.optional(),
    zoom: z.number().int().min(1).max(20).optional(),
    acknowledgedPrivacyNotice: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.enabled === true && value.coordinates === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["coordinates"],
        message:
          "mapEmbed.coordinates is required when mapEmbed.enabled is true (otherwise the renderer cannot place a marker).",
      });
    }
    if (value.enabled === true && value.provider === "google") {
      if (value.acknowledgedPrivacyNotice !== true) {
        ctx.addIssue({
          code: "custom",
          path: ["acknowledgedPrivacyNotice"],
          message:
            "Google Maps embed requires acknowledgedPrivacyNotice=true. The editor must show the privacy notice before this flag is set.",
        });
      }
    }
  });

export const ContactCardDataSchema = z.looseObject({
  address: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  socials: z.array(SocialLinkSchema).optional(),
  mapEmbed: MapEmbedSchema.optional(),
});

export const ContactCardBlockSchema = z.looseObject({
  id: z.string().min(1),
  type: z.literal("contactCard"),
  version: z.literal(1),
  data: ContactCardDataSchema,
});

export const CONTACT_CARD_BLOCK_VERSION = 1 as const;

export type ContactCardBlock = z.infer<typeof ContactCardBlockSchema>;
export type ContactCardData = z.infer<typeof ContactCardDataSchema>;
export type ContactCardMapEmbed = z.infer<typeof MapEmbedSchema>;
