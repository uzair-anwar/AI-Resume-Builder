"use client";

import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { FONT_NAME } from "@/lib/resume/layout/constants";

Font.register({
  family: FONT_NAME,
  fonts: [
    { src: "/fonts/pt-serif-latin-400-normal.woff", fontWeight: 400 },
    { src: "/fonts/pt-serif-latin-400-italic.woff", fontWeight: 400, fontStyle: "italic" },
    { src: "/fonts/pt-serif-latin-700-normal.woff", fontWeight: 700 },
    { src: "/fonts/pt-serif-latin-700-italic.woff", fontWeight: 700, fontStyle: "italic" },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_NAME,
    fontSize: 11,
    lineHeight: 1.45,
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 72,
    color: "#000",
  },
  paragraph: { marginBottom: 10 },
});

type Props = {
  body: string;
};

export function CoverLetterDocument({ body }: Props) {
  const blocks = body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {blocks.map((block, i) => (
          <View key={i} style={styles.paragraph}>
            <Text>{block}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
