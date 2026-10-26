#!/usr/bin/env python3
"""Register CWE scope review documentation without overwriting prior project content."""
from pathlib import Path


def append_once(path: Path, marker: str, section: str):
    text = path.read_text(encoding='utf-8') if path.exists() else ''
    if marker not in text:
        path.write_text(text.rstrip() + '\n\n' + section.strip() + '\n', encoding='utf-8')
        print('Updated:', path)
    else:
        print('Already registered:', path)


def main():
    append_once(
        Path('README.md'),
        '(docs/CWE_SCOPE_REVIEW.md)',
        '''### Security weakness coverage\n\n[PatchReason CWE Scope Review](docs/CWE_SCOPE_REVIEW.md) documents how public JavaScript/TypeScript security changes are screened across CWE categories, with reproducible reports and human-review gates. The dataset intake is not automatically approved for model adaptation.''',
    )
    append_once(
        Path('docs/DECISIONS.md'),
        'Decision: review expanded CWE coverage',
        '''### Decision: review expanded CWE coverage\n\nThe first Hugging Face source selection returned only 11 candidates from 355 records under a five-CWE scope. We retained the TypeScript/JavaScript focus but added an independent coverage analysis for the remaining CWE categories. New records must meet the same remediation, diff and provenance criteria and must undergo manual review before training. See [CWE Scope Review](CWE_SCOPE_REVIEW.md).''',
    )


if __name__ == '__main__':
    main()
