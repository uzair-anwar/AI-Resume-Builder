"use client";

import { Text, View } from "@react-pdf/renderer";
import {
  parseRichText,
  plainFromRich,
  sliceRichSpans,
  type RichSpan,
} from "@/lib/shared/rich-text";
import { breakLines } from "@/lib/resume/layout/linebreak";
import { fontsLoaded } from "@/lib/resume/layout/fonts";
import { SIZE_BODY, SIZE_ENTRY, LINE_HEIGHT_BODY } from "@/lib/resume/layout/constants";

type BodyStyle = {
  fontSize: number;
  lineHeight: number;
};

function spanStyle(span: RichSpan, base: BodyStyle) {
  const fontSize = span.small ? SIZE_ENTRY : base.fontSize;
  const lh = span.small ? 10.5 : base.lineHeight;
  return {
    fontSize,
    lineHeight: lh / fontSize,
    fontWeight: span.bold ? 700 : 400,
    fontStyle: span.italic ? "italic" : "normal",
  } as const;
}

export function RichInlineText({
  text,
  baseStyle,
}: {
  text: string;
  baseStyle: BodyStyle;
}) {
  const spans = parseRichText(text);
  if (!spans.length) return null;
  return (
    <Text>
      {spans.map((s, i) => (
        <Text key={i} style={spanStyle(s, baseStyle)}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

const justifyRow = { flexDirection: "row" as const, justifyContent: "space-between" as const, height: LINE_HEIGHT_BODY };
const lineBox = { height: LINE_HEIGHT_BODY };

export function RichParagraph({
  text,
  width,
  justify,
  indent = 0,
  bodyStyle = { fontSize: SIZE_BODY, lineHeight: LINE_HEIGHT_BODY },
}: {
  text: string;
  width: number;
  justify?: boolean;
  indent?: number;
  bodyStyle?: BodyStyle;
}) {
  const plain = plainFromRich(text);
  if (!plain.trim()) return null;

  if (!fontsLoaded()) {
    return (
      <Text style={{ fontSize: bodyStyle.fontSize, marginLeft: indent }}>{plain}</Text>
    );
  }

  const spans = parseRichText(text);
  const lines = breakLines(plain, width, bodyStyle.fontSize, "regular");
  let offset = 0;

  return (
    <View style={{ marginLeft: indent, width }}>
      {lines.map((line, i) => {
        const start = offset;
        const end = start + line.text.length;
        const lineSpans = sliceRichSpans(spans, start, end);
        offset = end + (line.last ? 0 : 1);
        const content =
          lineSpans.length > 0 ? (
            <Text style={{ fontSize: bodyStyle.fontSize }}>
              {lineSpans.map((s, j) => (
                <Text key={j} style={spanStyle(s, bodyStyle)}>
                  {s.text}
                </Text>
              ))}
            </Text>
          ) : (
            <Text style={{ fontSize: bodyStyle.fontSize }}>{line.text}</Text>
          );

        if (justify && !line.last && line.units.length > 1) {
          return (
            <View key={i} style={justifyRow}>
              {line.units.map((u, j) => (
                <Text key={j} style={{ fontSize: bodyStyle.fontSize }}>
                  {u}
                </Text>
              ))}
            </View>
          );
        }

        return (
          <View key={i} style={[lineBox, { width: width + 4 }]}>
            {content}
          </View>
        );
      })}
    </View>
  );
}
