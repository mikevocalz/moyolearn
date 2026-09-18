from pathlib import Path
from io import BytesIO
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFilter
root=Path('.codex/pdf-qa/sources')
def save(name,w):
 with (root/f'{name}.pdf').open('wb') as f:w.write(f)
def subset(source,name,indices):
 r=PdfReader(root/source); w=PdfWriter()
 for i in indices:w.add_page(r.pages[i])
 save(name,w)
subset('handwritten-fractions.pdf','scanned-fractions-pages65-66',[64,65])
subset('grade5-fractions.pdf','broken-font-page1',[0])
def printed(name,rows=['Original answer: 2 + 2 = 5'],size=(612,792),pages=1):
 b=BytesIO();c=canvas.Canvas(b,pagesize=size)
 for i in range(pages):
  c.setFont('Helvetica',18)
  for j,s in enumerate(rows):c.drawString(40,size[1]-60-j*30,s)
  c.showPage()
 c.save();(root/f'{name}.pdf').write_bytes(b.getvalue())
printed('wrong-answer'); printed('blank',[]);printed('100-pages',['2 + 2 = 5'],pages=100);printed('101-pages',['2 + 2 = 5'],pages=101)
printed('landscape',size=(792,612));printed('tiny-page',['2+2=5'],size=(100,100));printed('huge-page',['2+2=5'],size=(14400,14400))
for degrees in [90,180,270]:
 w=PdfWriter();w.add_page(PdfReader(root/'wrong-answer.pdf').pages[0]).rotate(degrees);save(f'rotated-{degrees}',w)
w=PdfWriter();w.add_page(PdfReader(root/'wrong-answer.pdf').pages[0]);w.encrypt('test-password');save('password-protected',w)
(root/'truncated.pdf').write_bytes((root/'wrong-answer.pdf').read_bytes()[:150])
(root/'not-a-pdf.pdf').write_text('This is not a PDF')
w=PdfWriter();save('zero-pages',w)
for style in ['clear','blurred','low-contrast','header-only-layer']:
 im=Image.new('RGB',(1000,500),'white');d=ImageDraw.Draw(im);color=(220,220,220) if style=='low-contrast' else (0,0,0)
 d.text((50,160),'Solve 2 + 2 = 5',fill=color,font_size=60)
 if style=='blurred':im=im.filter(ImageFilter.GaussianBlur(5))
 image=root/f'{style}.png';im.save(image)
 b=BytesIO();c=canvas.Canvas(b,pagesize=(612,792));c.drawImage(str(image),20,280,width=570,height=285)
 if style=='header-only-layer':c.drawString(40,750,'Homework page 1')
 c.showPage();c.save();(root/f'scan-{style}.pdf').write_bytes(b.getvalue())
