import type { CatalogModel, IllustrativeReview, ReviewExample } from "../../types/domain";
import { FIXTURE_REVIEW_LABEL } from "../../types/domain";

export const reviewExamples: readonly ReviewExample[] = [
  {
    id: "ref-sql-001",
    title: "SQL injection",
    language: "typescript",
    filename: "ref-sql-001.ts",
    context: "HTTP endpoint interpolates a request-controlled ID into a SQL statement.",
    code: "const id = req.query.id;\nconst users = await db.query(`SELECT * FROM users WHERE id = '${id}'`);",
    findings: [
      {
        cwe: "CWE-89",
        severity: "high",
        evidence: "db.query interpolates req.query.id in SQL text",
        explanation: "Untrusted input becomes part of the SQL command string, enabling SQL injection.",
        remediation: "Use parameterized queries with bound values rather than string interpolation.",
      },
    ],
  },
  {
    id: "ref-sql-002",
    title: "Parameterized query",
    language: "typescript",
    filename: "ref-sql-002.ts",
    context: "Database driver supports parameter binding.",
    code: "const id = String(req.query.id);\nconst users = await db.query('SELECT * FROM users WHERE id = $1', [id]);",
    findings: [],
  },
  {
    id: "ref-mass-001",
    title: "Mass assignment",
    language: "typescript",
    filename: "ref-mass-001.ts",
    context: "Users can update their display name but must not change their role.",
    code: "const updated = await prisma.user.update({where:{id:req.user.id}, data:req.body});",
    findings: [
      {
        cwe: "CWE-915",
        severity: "high",
        evidence: "data:req.body",
        explanation:
          "User-controlled properties are passed directly to an update operation, potentially modifying sensitive fields such as role.",
        remediation: "Build an allowlist of editable fields and pass only approved properties to the update operation.",
      },
    ],
  },
];

export function findReviewExample(code: string, language: ReviewExample["language"]): ReviewExample | undefined {
  return reviewExamples.find((example) => example.code === code && example.language === language);
}

export function illustrativeReview(example: ReviewExample, model: CatalogModel): IllustrativeReview {
  return {
    kind: "illustrative-fixture",
    label: FIXTURE_REVIEW_LABEL,
    source: "datasets/reference_examples.jsonl",
    exampleId: example.id,
    context: example.context,
    model,
    findings: example.findings,
    timing: { kind: "not-measured" },
  };
}
