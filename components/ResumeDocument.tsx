"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
} from "@react-pdf/renderer";
import type { ResumeView } from "@/lib/schemas/resume";
import { formatDateRange } from "@/lib/format";

export type ResumeLayout = "two-column" | "single-column";
export type ResumeDensity = "normal" | "compact";

const base = (density: ResumeDensity) =>
  StyleSheet.create({
    page: {
      fontFamily: "Times-Roman",
      fontSize: density === "compact" ? 9 : 10,
      padding: density === "compact" ? 28 : 36,
      color: "#111",
      lineHeight: 1.35,
    },
    name: { fontSize: density === "compact" ? 20 : 22, fontWeight: "bold", textAlign: "center" },
    headline: { fontSize: density === "compact" ? 11 : 12, textAlign: "center", marginBottom: 4 },
    contact: { fontSize: 9, textAlign: "center", marginBottom: 10 },
    sectionTitle: {
      fontSize: density === "compact" ? 10 : 11,
      fontWeight: "bold",
      borderBottomWidth: 1,
      borderBottomColor: "#333",
      marginTop: 8,
      marginBottom: 4,
      textTransform: "uppercase",
    },
    bullet: { marginLeft: 8, marginBottom: 2 },
    row: { flexDirection: "row", justifyContent: "space-between" },
    col: { flex: 1 },
    colLeft: { flex: 1.05, paddingRight: 12 },
    colRight: { flex: 0.95, paddingLeft: 8 },
    skillLine: { marginBottom: 2 },
    muted: { color: "#444" },
  });

type Props = {
  resume: ResumeView;
  layout: ResumeLayout;
  density: ResumeDensity;
};

export function ResumeDocument({ resume, layout, density }: Props) {
  const styles = base(density);
  const contact = [
    resume.person.location,
    resume.person.email,
    "linkedin.com/in/uzair-anwar",
    "github.com/uzair-anwar",
  ].join("  |  ");

  const leftSections = resume.skills;
  const rightSections = (
    <>
      <Text style={styles.sectionTitle}>Summary</Text>
      <Text style={{ marginBottom: 6 }}>{resume.summary}</Text>

      <Text style={styles.sectionTitle}>Professional Experience</Text>
      {resume.experience.map((exp) => (
        <View key={exp.id} wrap={false} style={{ marginBottom: 6 }}>
          <View style={styles.row}>
            <Text style={{ fontWeight: "bold" }}>{exp.title}</Text>
            <Text style={styles.muted}>{formatDateRange(exp.startDate, exp.endDate)}</Text>
          </View>
          <Text style={{ fontWeight: "bold", marginBottom: 2 }}>{exp.company}</Text>
          {exp.bullets.map((b, i) => (
            <Text key={i} style={styles.bullet}>• {b.text}</Text>
          ))}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Education</Text>
      {resume.education.map((e) => (
        <View key={e.id}>
          <Text style={{ fontWeight: "bold" }}>{e.degree}</Text>
          <Text>{e.institution}</Text>
        </View>
      ))}
    </>
  );

  const projectsBlock = (
    <>
      <Text style={styles.sectionTitle}>Projects</Text>
      {resume.projects.map((p) => (
        <View key={p.id} style={{ marginBottom: 4 }}>
          <Text style={{ fontWeight: "bold" }}>
            {p.link ? (
              <Link src={p.link}>{p.name}</Link>
            ) : (
              p.name
            )}
          </Text>
          <Text>{p.description}</Text>
        </View>
      ))}
    </>
  );

  const skillsBlock = (
    <>
      <Text style={styles.sectionTitle}>Skills</Text>
      {leftSections.map((cat) => (
        <View key={cat.categoryId} style={{ marginBottom: 4 }}>
          <Text style={{ fontWeight: "bold", fontSize: 9 }}>{cat.categoryLabel}</Text>
          <Text style={styles.skillLine}>{cat.items.map((i) => i.name).join(" | ")}</Text>
        </View>
      ))}
    </>
  );

  if (layout === "single-column") {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.name}>{resume.person.name}</Text>
          <Text style={styles.headline}>{resume.headline}</Text>
          <Text style={styles.contact}>{contact}</Text>
          {rightSections}
          {projectsBlock}
          {skillsBlock}
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{resume.person.name}</Text>
        <Text style={styles.headline}>{resume.headline}</Text>
        <Text style={styles.contact}>{contact}</Text>
        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <View style={styles.colLeft}>
            {skillsBlock}
            {projectsBlock}
          </View>
          <View style={styles.colRight}>{rightSections}</View>
        </View>
      </Page>
    </Document>
  );
}
