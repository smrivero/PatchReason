from pathlib import Path

p = Path('README.md')
text = p.read_text(encoding='utf-8')
item = '- [Binary vulnerability data pipeline](docs/BINARY_DATASET_PIPELINE.md)'
if item not in text:
    p.write_text(text.rstrip() + '\n\n' + item + '\n', encoding='utf-8')
    print('Added documentation link to README')
else:
    print('README already contains documentation link')
