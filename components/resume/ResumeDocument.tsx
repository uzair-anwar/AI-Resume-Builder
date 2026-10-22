"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
  Font,
  Svg,
  Path,
  Rect,
  Circle,
  G as SvgG,
} from "@react-pdf/renderer";
import type { ResumeView } from "@/lib/schemas/resume";
import { formatDateRangePdf } from "@/lib/shared/format";
import { formatSkillLine } from "@/lib/resume/layout/skill-line";
import { RichInlineText } from "@/components/resume/RichTextPdf";
import { hasRichMarkup, plainFromRich } from "@/lib/shared/rich-text";
import { breakLines } from "@/lib/resume/layout/linebreak";
import { fontsLoaded } from "@/lib/resume/layout/fonts";
import {
  FONT_NAME,
  MARGIN_X,
  COLUMN_WIDTH,
  RIGHT_COLUMN_X,
  SIZE_NAME,
  SIZE_HEADLINE,
  SIZE_SECTION,
  SIZE_ENTRY,
  SIZE_BODY,
  LINE_HEIGHT_BODY,
  BULLET_INDENT,
  BULLET_GAP_PT,
} from "@/lib/resume/layout/constants";

Font.register({
  family: FONT_NAME,
  fonts: [
    { src: "/fonts/pt-serif-latin-400-normal.woff", fontWeight: 400 },
    { src: "/fonts/pt-serif-latin-400-italic.woff", fontWeight: 400, fontStyle: "italic" },
    { src: "/fonts/pt-serif-latin-700-normal.woff", fontWeight: 700 },
    { src: "/fonts/pt-serif-latin-700-italic.woff", fontWeight: 700, fontStyle: "italic" },
  ],
});

/** Lines are broken by our own measured layout; never let react-pdf hyphenate. */
Font.registerHyphenationCallback((word) => [word]);

/** Template geometry (pt). Calibrated against Uzair_FullStack.pdf. */
const G = {
  nameTop: 24.2,
  headlineTop: 49.3,
  contactRow1Top: 71.6,
  contactRow2Top: 88.1,
  columnsTop: 109.3,
  /** Distance from the previous block's last line box to the next section title. */
  sectionGap: 10.7,
  ruleTopGap: 1.1,
  ruleBottomGapBody: 3.7,
  ruleBottomGapLabel: 4.0,
};

const LH = (px: number, size: number) => px / size;

const black = "#000000";

const styles = StyleSheet.create({
  page: { fontFamily: FONT_NAME, color: black, fontSize: SIZE_BODY },
  abs: { position: "absolute" },
  name: { fontSize: SIZE_NAME, fontWeight: 700, lineHeight: LH(24, SIZE_NAME) },
  headline: { fontSize: SIZE_HEADLINE, fontStyle: "italic", lineHeight: LH(15, SIZE_HEADLINE) },
  contactText: { fontSize: SIZE_BODY, lineHeight: LH(LINE_HEIGHT_BODY, SIZE_BODY), color: black },
  link: { color: black, textDecoration: "none" },
  sectionTitle: {
    fontSize: SIZE_SECTION,
    fontWeight: 700,
    textTransform: "uppercase",
    lineHeight: LH(13, SIZE_SECTION),
  },
  rule: { height: 1.5, backgroundColor: black },
  body: { fontSize: SIZE_BODY, lineHeight: LH(LINE_HEIGHT_BODY, SIZE_BODY) },
  label: { fontSize: SIZE_ENTRY, fontWeight: 700, lineHeight: LH(10.5, SIZE_ENTRY) },
  labelItalic: { fontSize: SIZE_ENTRY, fontStyle: "italic", lineHeight: LH(10.5, SIZE_ENTRY) },
  dates: {
    fontSize: SIZE_ENTRY,
    lineHeight: LH(10.5, SIZE_ENTRY),
    marginTop: 1.5,
    marginBottom: 0.45,
  },
  bulletRow: { flexDirection: "row" },
  bulletDot: {
    position: "absolute",
    left: 0.2,
    top: 3.6,
    width: 2.8,
    height: 2.8,
    borderRadius: 1.4,
    backgroundColor: black,
  },
  lineBox: { height: LINE_HEIGHT_BODY },
  justifyRow: { flexDirection: "row", justifyContent: "space-between", height: LINE_HEIGHT_BODY },
});

function PinIcon() {
  return (
    <Svg width={7} height={9} viewBox="0 0 14 18">
      <Path
        d="M7 0C3.1 0 0 3.1 0 7c0 5.1 7 11 7 11s7-5.9 7-11c0-3.9-3.1-7-7-7zm0 9.6a2.6 2.6 0 110-5.2 2.6 2.6 0 010 5.2z"
        fill={black}
      />
    </Svg>
  );
}

function LinkIcon({ size = 7.5 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <SvgG transform="rotate(-45 12 12)">
        <Rect
          x={1.5}
          y={8}
          width={12}
          height={8}
          rx={4}
          fill="none"
          stroke={black}
          strokeWidth={2.2}
        />
        <Rect
          x={10.5}
          y={8}
          width={12}
          height={8}
          rx={4}
          fill="none"
          stroke={black}
          strokeWidth={2.2}
        />
      </SvgG>
    </Svg>
  );
}

function MailIcon() {
  return (
    <Svg width={8} height={6} viewBox="0 0 16 12">
      <Path d="M0 1.2C0 .5.5 0 1.2 0h13.6C15.5 0 16 .5 16 1.2v.4L8 6.6 0 1.6v-.4z" fill={black} />
      <Path d="M0 3.4l8 5 8-5v7.4c0 .7-.5 1.2-1.2 1.2H1.2C.5 12 0 11.5 0 10.8V3.4z" fill={black} />
    </Svg>
  );
}

function LinkedInIcon() {
  return (
    <Svg width={8.5} height={8.5} viewBox="0 0 16 16">
      <Rect x={0} y={0} width={16} height={16} rx={2.2} fill={black} />
      <Rect x={2.6} y={6} width={2.4} height={7.4} fill="#fff" />
      <Circle cx={3.8} cy={3.7} r={1.4} fill="#fff" />
      <Path
        d="M6.9 6h2.3v1c.4-.7 1.2-1.2 2.3-1.2 2.1 0 2.9 1.3 2.9 3.4v4.2h-2.4v-3.7c0-.9-.3-1.5-1.1-1.5-.9 0-1.4.6-1.4 1.6v3.6H6.9V6z"
        fill="#fff"
      />
    </Svg>
  );
}

/**
 * Measured line breaking (same algorithm as line budgets). Justified lines space words evenly except the last.
 */
function Paragraph({
  text,
  width,
  justify,
  indent = 0,
}: {
  text: string;
  width: number;
  justify?: boolean;
  indent?: number;
}) {
  if (!fontsLoaded()) {
    return <Text style={[styles.body, { marginLeft: indent }]}>{text}</Text>;
  }
  const lines = breakLines(text, width, SIZE_BODY, "regular");
  return (
    <View style={{ marginLeft: indent, width }}>
      {lines.map((line, i) =>
        justify && !line.last && line.units.length > 1 ? (
          <View key={i} style={styles.justifyRow}>
            {line.units.map((u, j) => (
              <Text key={j} style={styles.body}>
                {u}
              </Text>
            ))}
          </View>
        ) : (
          <View key={i} style={[styles.lineBox, { width: width + 4 }]}>
            <Text style={styles.body}>{line.text}</Text>
          </View>
        ),
      )}
    </View>
  );
}

/** Rich markup when user edited copy; otherwise use measured Paragraph. */
function BodyParagraph({
  text,
  width,
  justify,
  indent = 0,
}: {
  text: string;
  width: number;
  justify?: boolean;
  indent?: number;
}) {
  if (!hasRichMarkup(text)) {
    return <Paragraph text={text} width={width} justify={justify} indent={indent} />;
  }
  return <RichInlineParagraph text={text} width={width} justify={justify} indent={indent} />;
}

/** Per-line rich render (markup should not span lines). */
function RichInlineParagraph({
  text,
  width,
  justify,
  indent = 0,
}: {
  text: string;
  width: number;
  justify?: boolean;
  indent?: number;
}) {
  const plain = plainFromRich(text);
  if (!fontsLoaded()) {
    return <Text style={[styles.body, { marginLeft: indent }]}>{plain}</Text>;
  }
  const lines = breakLines(plain, width, SIZE_BODY, "regular");
  return (
    <View style={{ marginLeft: indent, width }}>
      {lines.map((line, i) =>
        justify && !line.last && line.units.length > 1 ? (
          <View key={i} style={styles.justifyRow}>
            {line.units.map((u, j) => (
              <Text key={j} style={styles.body}>
                {u}
              </Text>
            ))}
          </View>
        ) : (
          <View key={i} style={[styles.lineBox, { width: width + 4 }]}>
            <Text style={styles.body}>
              <RichInlineText text={line.text} baseStyle={{ fontSize: SIZE_BODY, lineHeight: LINE_HEIGHT_BODY }} />
            </Text>
          </View>
        ),
      )}
    </View>
  );
}

function Section({
  title,
  first,
  labelNext,
}: {
  title: string;
  first?: boolean;
  labelNext?: boolean;
}) {
  return (
    <View wrap={false} style={{ marginTop: first ? 0 : G.sectionGap }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.rule, { marginTop: G.ruleTopGap }]} />
      <View style={{ height: labelNext ? G.ruleBottomGapLabel : G.ruleBottomGapBody }} />
    </View>
  );
}

function HyperLink({ src, children }: { src: string; children: string }) {
  return (
    <Link src={src} style={styles.link}>
      {children}
    </Link>
  );
}

type Props = { resume: ResumeView };

export function ResumeDocument({ resume }: Props) {
  const gh = resume.person.github.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const li = resume.person.linkedin.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
  const textLeft = MARGIN_X + 14.9;
  const textRight = RIGHT_COLUMN_X + 14.9;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={[styles.abs, styles.name, { left: MARGIN_X, top: G.nameTop }]}>
          {resume.person.name}
        </Text>
        <Text style={[styles.abs, styles.headline, { left: MARGIN_X, top: G.headlineTop }]}>
          {hasRichMarkup(resume.headline) ? (
            <RichInlineText
              text={resume.headline}
              baseStyle={{ fontSize: SIZE_HEADLINE, lineHeight: 15 }}
            />
          ) : (
            resume.headline
          )}
        </Text>

        <View style={[styles.abs, { left: MARGIN_X + 1, top: G.contactRow1Top + 2 }]}>
          <PinIcon />
        </View>
        <Text style={[styles.abs, styles.contactText, { left: textLeft, top: G.contactRow1Top }]}>
          {resume.person.phone?.trim()
            ? `${resume.person.location}   |   ${resume.person.phone.trim()}`
            : resume.person.location}
        </Text>
        <View style={[styles.abs, { left: RIGHT_COLUMN_X + 0.5, top: G.contactRow1Top + 3 }]}>
          <MailIcon />
        </View>
        <Text style={[styles.abs, styles.contactText, { left: textRight, top: G.contactRow1Top }]}>
          <HyperLink src={`mailto:${resume.person.email}`}>{resume.person.email}</HyperLink>
        </Text>

        <View style={[styles.abs, { left: MARGIN_X + 1, top: G.contactRow2Top + 1.6 }]}>
          <LinkIcon />
        </View>
        <Text style={[styles.abs, styles.contactText, { left: textLeft, top: G.contactRow2Top }]}>
          <HyperLink src={resume.person.github}>{gh}</HyperLink>
        </Text>
        <View style={[styles.abs, { left: RIGHT_COLUMN_X, top: G.contactRow2Top + 1.2 }]}>
          <LinkedInIcon />
        </View>
        <Text style={[styles.abs, styles.contactText, { left: textRight, top: G.contactRow2Top }]}>
          <HyperLink src={resume.person.linkedin}>{li}</HyperLink>
        </Text>

        <View style={[styles.abs, { left: MARGIN_X, top: G.columnsTop, width: COLUMN_WIDTH }]}>
          <Section title="Summary" first />
          <BodyParagraph text={resume.summary} width={COLUMN_WIDTH} justify />

          <Section title="Skills" labelNext />
          {resume.skills.map((cat, ci) => (
            <View
              key={cat.categoryId}
              wrap={false}
              style={{ marginBottom: ci === resume.skills.length - 1 ? 0 : LINE_HEIGHT_BODY - 0.5 }}
            >
              <Text style={styles.label}>{cat.categoryLabel}</Text>
              <View style={{ marginTop: -0.2 }}>
                <BodyParagraph
                  text={formatSkillLine(
                    cat.categoryId,
                    cat.items.map((i) => i.name),
                  )}
                  width={COLUMN_WIDTH}
                  justify
                />
              </View>
            </View>
          ))}

          <Section title="Projects" labelNext />
          {resume.projects.map((p, pi) => (
            <View
              key={p.id}
              wrap={false}
              style={{ marginBottom: pi === resume.projects.length - 1 ? 0 : 6.8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {p.link ? (
                  <>
                    <Text style={styles.label}>
                      <HyperLink src={p.link}>{p.name}</HyperLink>
                    </Text>
                    <View style={{ marginLeft: 4, marginTop: -1 }}>
                      <LinkIcon size={7} />
                    </View>
                  </>
                ) : (
                  <Text style={styles.label}>{p.name}</Text>
                )}
              </View>
              <View style={{ marginTop: 0.5 }}>
                <BodyParagraph text={p.description} width={COLUMN_WIDTH} justify />
              </View>
            </View>
          ))}
        </View>

        <View
          style={[styles.abs, { left: RIGHT_COLUMN_X, top: G.columnsTop, width: COLUMN_WIDTH }]}
        >
          <Section title="Professional Experience" first labelNext />
          {resume.experience.map((exp, ei) => (
            <View
              key={exp.id}
              style={{ marginBottom: ei === resume.experience.length - 1 ? 0 : 6.9 }}
            >
              <Text style={styles.label}>{exp.title}</Text>
              <Text style={styles.labelItalic}>
                {exp.location?.trim() ? `${exp.company}  |  ${exp.location.trim()}` : exp.company}
              </Text>
              <Text style={styles.dates}>{formatDateRangePdf(exp.startDate, exp.endDate)}</Text>
              {exp.bullets.map((b, i) => (
                <View key={i} style={[styles.bulletRow, { marginTop: i === 0 ? 0 : BULLET_GAP_PT }]}>
                  <View style={styles.bulletDot} />
                  <BodyParagraph
                    text={b.text}
                    width={COLUMN_WIDTH - BULLET_INDENT}
                    indent={BULLET_INDENT}
                  />
                </View>
              ))}
            </View>
          ))}

          <Section title="Education" labelNext />
          {resume.education.map((e) => (
            <View key={e.id}>
              <Text style={styles.label}>{e.degree}</Text>
              <Text style={styles.labelItalic}>{e.institution}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
