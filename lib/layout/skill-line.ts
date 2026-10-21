/**
 * Formats the skills of one category the way the template PDF prints them.
 * Cloud skills are folded: "Azure, AWS (Amplify Gen 2, AppSync, ..., CDK)".
 * Everything else is " | " separated.
 */
const AWS_SERVICE_NAMES = new Set(["DynamoDB", "S3", "CloudFront", "API Gateway"]);

export function formatSkillLine(categoryId: string, names: string[]): string {
  if (categoryId !== "cat-cloud") return names.join(" | ");

  const parts: string[] = [];
  const services: string[] = [];
  let hasAws = false;

  for (const name of names) {
    if (name === "AWS") hasAws = true;
    else if (name.startsWith("AWS ")) services.push(name.slice(4));
    else if (AWS_SERVICE_NAMES.has(name)) services.push(name);
    else parts.push(name);
  }

  if (hasAws || services.length) {
    parts.push(services.length ? `AWS (${services.join(", ")})` : "AWS");
  }
  return parts.join(", ");
}
