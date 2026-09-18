"""Fetch public QA sources locally; fail if their content changes. Do not vendor PDFs."""
from pathlib import Path
from subprocess import run
from hashlib import sha256
root=Path('.codex/pdf-qa/sources');root.mkdir(parents=True,exist_ok=True)
sources=[
 ('handwritten-fractions','https://hayutineducation.com/uploads/application/files/lower-level-math-supplements.pdf','ee92fbdd080946e2887ac5655a2477f96399ed77f2d7d056f7ee8271720c2ef2'),
 ('grade5-fractions','https://www.mathworksheets.com/5th-grade/MathWorksheetsGrade5_2_23.pdf','ffeae2edf88b297e6ede01241c77a9e7b84cdc5dd999ff5ff6075c76b30c7253')]
for name,url,digest in sources:
 data=run(['curl','--fail','--silent','--show-error','--location','--max-time','45',url],check=True,capture_output=True).stdout
 if sha256(data).hexdigest()!=digest:raise RuntimeError(f'{name}: source changed; inspect before updating checksum')
 (root/f'{name}.pdf').write_bytes(data)
 print(name,len(data),digest)
