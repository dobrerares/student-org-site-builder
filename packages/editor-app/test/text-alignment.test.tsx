/** @jsxImportSource react */
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { FaqDataSchema, HeroDataSchema, ValueListDataSchema } from "@sosb/schema";
import { BlockForm } from "../src/block-form.js";

afterEach(cleanup);

test.each([
  ["Q&A", FaqDataSchema, { items: [{ question: "Why?", answer: "A longer answer." }] }],
  ["hero", HeroDataSchema, { title: "Hello" }],
  ["values", ValueListDataSchema, { items: [{ label: "Community" }] }],
])(
  "%s exposes paragraph justification and can restore the theme default",
  (_name, schema, data) => {
    const patch = vi.fn();
    const { getByLabelText } = render(
      <BlockForm
        schema={schema}
        data={data}
        onPatch={patch}
        onArrayChange={() => {}}
        newItem={() => ({})}
        uploader={async () => {
          throw new Error("unused");
        }}
        documentUploader={async () => {
          throw new Error("unused");
        }}
      />,
    );
    fireEvent.change(getByLabelText("Paragraph alignment"), { target: { value: "justify" } });
    expect(patch).toHaveBeenLastCalledWith(["paragraphAlign"], "justify");
    fireEvent.change(getByLabelText("Heading alignment"), { target: { value: "center" } });
    expect(patch).toHaveBeenLastCalledWith(["titleAlign"], "center");
    fireEvent.change(getByLabelText("Paragraph alignment"), { target: { value: "" } });
    expect(patch).toHaveBeenLastCalledWith(["paragraphAlign"], undefined);
  },
);
