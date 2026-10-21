"use client";

import { Document, Page, Text, View, StyleSheet, Link, Font, Svg, Path } from "@react-pdf/renderer";
import type { ResumeView } from "@/lib/schemas/resume";
import { formatDateRangePdf } from "@/lib/format";
import {
  FONT_NAME,
  MARGIN_X,
  MARGIN_TOP,
  COLUMN_WIDTH,
  RIGHT_COLUMN_X,
  SIZE_NAME,
  SIZE_HEADLINE,
  SIZE_SECTION,
  SIZE_ENTRY,
  SIZE_BODY,
  LINE_HEIGHT_BODY,
  BULLET_INDENT,
} from "@/lib/layout/constants";

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
    fontSize: SIZE_BODY,
    paddingTop: MARGIN_TOP,
    paddingHorizontal: MARGIN_X,
    color: "#000000",
    lineHeight: LINE_HEIGHT_BODY / SIZE_BODY,
  },
  name: { fontSize: SIZE_NAME, fontWeight: 700, marginBottom: 2 },
  headline: { fontSize: SIZE_HEADLINE, fontStyle: "italic", marginBottom: 10 },
  contactRow: { flexDirection: "row", marginBottom: 4 },
  contactLeft: { width: COLUMN_WIDTH, flexDirection: "row", alignItems: "center", gap: 4 },
  contactRight: {
    width: COLUMN_WIDTH,
    marginLeft: RIGHT_COLUMN_X - MARGIN_X - COLUMN_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  contactText: { fontSize: SIZE_BODY },
  columns: { flexDirection: "row", marginTop: 6 },
  colLeft: { width: COLUMN_WIDTH },
  colRight: { width: COLUMN_WIDTH, marginLeft: RIGHT_COLUMN_X - MARGIN_X - COLUMN_WIDTH },
  sectionTitle: {
    fontSize: SIZE_SECTION,
    fontWeight: 700,
    textTransform: "uppercase",
    marginTop: 8,
  },
  rule: { borderBottomWidth: 1.5, borderBottomColor: "#000", marginTop: 2, marginBottom: 6 },
  catLabel: { fontSize: SIZE_ENTRY, fontWeight: 700, marginTop: 4 },
  skillLine: { fontSize: SIZE_BODY, marginBottom: 2 },
  projName: { fontSize: SIZE_ENTRY, fontWeight: 700, marginTop: 4 },
  body: { fontSize: SIZE_BODY },
  expTitle: { fontSize: SIZE_ENTRY, fontWeight: 700 },
  expCompany: { fontSize: SIZE_ENTRY, fontStyle: "italic" },
  expDates: { fontSize: SIZE_ENTRY, marginBottom: 2 },
  bullet: { fontSize: SIZE_BODY, marginLeft: BULLET_INDENT, marginBottom: 1 },
  eduDegree: { fontSize: SIZE_ENTRY, fontWeight: 700 },
  eduSchool: { fontSize: SIZE_ENTRY, fontStyle: "italic" },
});

function PinIcon() {
  return (
    <Svg width={8} height={8} viewBox="0 0 24 24">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
        fill="#000"
      />
    </Svg>
  );
}

function LinkIcon() {
  return (
    <Svg width={8} height={8} viewBox="0 0 24 24">
      <Path
        d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
        fill="#000"
      />
    </Svg>
  );
}

function MailIcon() {
  return (
    <Svg width={8} height={8} viewBox="0 0 24 24">
      <Path
        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
        fill="#000"
      />
    </Svg>
  );
}

function Section({ title }: { title: string }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.rule} />
    </View>
  );
}

type Props = { resume: ResumeView };

export function ResumeDocument({ resume }: Props) {
  const gh = resume.person.github.replace(/^https?:\/\/(www\.)?/, "");
  const li = resume.person.linkedin.replace(/^https?:\/\/(www\.)?/, "");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{resume.person.name}</Text>
        <Text style={styles.headline}>{resume.headline}</Text>

        <View style={styles.contactRow}>
          <View style={styles.contactLeft}>
            <PinIcon />
            <Text style={styles.contactText}>{resume.person.location}</Text>
          </View>
          <View style={styles.contactRight}>
            <MailIcon />
            <Link src={`mailto:${resume.person.email}`} style={styles.contactText}>
              {resume.person.email.replace("@", " @")}
            </Link>
          </View>
        </View>
        <View style={styles.contactRow}>
          <View style={styles.contactLeft}>
            <LinkIcon />
            <Link src={resume.person.github} style={styles.contactText}>
              {gh}
            </Link>
          </View>
          <View style={styles.contactRight}>
            <LinkIcon />
            <Link src={resume.person.linkedin} style={styles.contactText}>
              {li}
            </Link>
          </View>
        </View>

        <View style={styles.columns}>
          <View style={styles.colLeft}>
            <Section title="Summary" />
            <Text style={styles.body}>{resume.summary}</Text>

            <Section title="Skills" />
            {resume.skills.map((cat) => (
              <View key={cat.categoryId}>
                <Text style={styles.catLabel}>{cat.categoryLabel}</Text>
                <Text style={styles.skillLine}>{cat.items.map((i) => i.name).join(" | ")}</Text>
              </View>
            ))}

            <Section title="Projects" />
            {resume.projects.map((p) => (
              <View key={p.id} wrap={false}>
                {p.link ? (
                  <Link src={p.link} style={styles.projName}>
                    {p.name}
                  </Link>
                ) : (
                  <Text style={styles.projName}>{p.name}</Text>
                )}
                <Text style={styles.body}>{p.description}</Text>
              </View>
            ))}
          </View>

          <View style={styles.colRight}>
            <Section title="Professional Experience" />
            {resume.experience.map((exp) => (
              <View key={exp.id} style={{ marginBottom: 6 }}>
                <Text style={styles.expTitle}>{exp.title}</Text>
                <Text style={styles.expCompany}>{exp.company}</Text>
                <Text style={styles.expDates}>
                  {formatDateRangePdf(exp.startDate, exp.endDate)}
                </Text>
                {exp.bullets.map((b, i) => (
                  <Text key={i} style={styles.bullet}>
                    • {b.text}
                  </Text>
                ))}
              </View>
            ))}

            <Section title="Education" />
            {resume.education.map((e) => (
              <View key={e.id}>
                <Text style={styles.eduDegree}>{e.degree}</Text>
                <Text style={styles.eduSchool}>{e.institution}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
