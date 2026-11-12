"use client";

import { Document, Page, Text, View, Link } from "@react-pdf/renderer";
import type { ResumeView } from "@/lib/schemas/resume";
import { layoutResume } from "@/lib/resume/engine/layout";
import type { Op } from "@/lib/resume/engine/types";
import { getTemplate } from "@/lib/resume/templates/registry";
import { ascentRatio } from "@/lib/resume/layout/fonts";
import { registerPdfFonts, pdfFamilyName } from "./pdf-fonts";
import { ResumeIcon } from "./ResumeIcons";

registerPdfFonts();

function weight(style: string): 400 | 700 {
  return style === "bold" || style === "boldItalic" ? 700 : 400;
}
function fstyle(style: string): "italic" | "normal" {
  return style === "italic" || style === "boldItalic" ? "italic" : "normal";
}

function TextOp({ op }: { op: Extract<Op, { t: "text" }> }) {
  const first = op.runs[0]?.style ?? "regular";
  const top = op.y - ascentRatio(op.family, first) * op.size;
  const style = {
    position: "absolute" as const,
    left: op.x,
    top,
    width: op.w + 4,
    fontFamily: pdfFamilyName(op.family),
    fontSize: op.size,
    lineHeight: 1,
    color: op.color,
    letterSpacing: op.spacing,
    fontWeight: weight(first),
    fontStyle: fstyle(first),
    textDecoration: "none" as const,
  };
  const content =
    op.runs.length === 1 ? (
      op.runs[0]!.text
    ) : (
      op.runs.map((r, i) => (
        <Text key={i} style={{ fontWeight: weight(r.style), fontStyle: fstyle(r.style) }}>
          {r.text}
        </Text>
      ))
    );
  return (
    <Text style={style} wrap={false}>
      {op.link ? (
        <Link src={op.link} style={{ color: op.color, textDecoration: "none" }}>
          {content}
        </Link>
      ) : (
        content
      )}
    </Text>
  );
}

function OpView({ op }: { op: Op }) {
  if (op.t === "text") return <TextOp op={op} />;
  if (op.t === "rect") {
    return (
      <View
        style={{
          position: "absolute",
          left: op.x,
          top: op.y,
          width: op.w,
          height: op.h,
          backgroundColor: op.fill,
          opacity: op.opacity,
          borderRadius: op.radius,
        }}
      />
    );
  }
  return (
    <View style={{ position: "absolute", left: op.x, top: op.y, width: op.w, height: op.h }}>
      <ResumeIcon kind={op.kind} w={op.w} h={op.h} color={op.color} />
    </View>
  );
}

type Props = { resume: ResumeView; templateId?: string };

export function ResumeDocument({ resume, templateId }: Props) {
  const spec = getTemplate(templateId);
  const { ops, page } = layoutResume(resume, spec);
  return (
    <Document>
      <Page
        size={{ width: page.width, height: page.height }}
        style={{ backgroundColor: page.background ?? "#ffffff" }}
      >
        {ops.filter((op) => op.y < page.height).map((op, i) => (
          <OpView key={i} op={op} />
        ))}
      </Page>
    </Document>
  );
}
