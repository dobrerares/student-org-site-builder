import { z } from "zod";

/** Optional author choices; absence preserves the Theme's default alignment. */
export const TextAlignmentSchema = z.enum(["left", "center", "right", "justify"]);
export const textAlignmentFields = {
  titleAlign: TextAlignmentSchema.optional(),
  paragraphAlign: TextAlignmentSchema.optional(),
};
