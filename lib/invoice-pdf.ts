import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import path from 'node:path';
import { taka, total, type State, type Order } from './crm.ts';

/** Generate a genuine, self-contained PDF from the saved CRM invoice fields. */
export async function renderInvoicePdf(state:State,order:Order,logo:string):Promise<Buffer>{
  const doc=new PDFDocument({size:'A4',margin:42,font:path.join(process.cwd(),'public/fonts/NotoSansBengali.ttf'),bufferPages:true,info:{Title:'ALOYRI Invoice '+order.number,Author:'ALOYRI'}});
  const chunks:Buffer[]=[];
  const output=new Promise<Buffer>((resolve,reject)=>{doc.on('data',chunk=>chunks.push(Buffer.from(chunk)));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  const left=42,width=511,bottom=770;
  const profile=state.businessProfile;
  const customer=state.customers.find(row=>row.id===order.customerId);
  const color='#352d29',muted='#756e68',accent='#7b4a3f';
  doc.fillColor(color);
  const text=(value:string,x:number,y:number,w:number,size=10,align:'left'|'right'|'center'='left')=>{doc.fontSize(size).text(value,x,y,{width:w,align,lineGap:2});};
  const height=(value:string,w:number,size=10)=>doc.fontSize(size).heightOfString(value,{width:w,lineGap:2});
  const space=(needed:number)=>{if(doc.y+needed>bottom){doc.addPage();doc.y=42;} return doc.y;};
  const section=(title:string)=>{const y=space(30);doc.fillColor(accent);text(title,left,y,width,11);doc.fillColor(color);doc.y=y+25;};
  const png=await sharp(Buffer.from(logo.split(',')[1],'base64'),{limitInputPixels:20_000_000}).resize({width:700,withoutEnlargement:true}).png().toBuffer();
  doc.image(png,left,42,{fit:[185,65]});
  text('INVOICE',300,42,253,20,'right');
  text('INV-'+order.number,270,74,283,11,'right');
  text(new Date(order.created+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Dhaka'}),300,94,253,10,'right');
  doc.moveTo(left,120).lineTo(left+width,120).strokeColor('#c8a393').stroke();
  const business=[profile.address,profile.phone,profile.email,profile.bin?'BIN / VAT: '+profile.bin:''].filter(Boolean).join('\n');
  const status=order.status==='Cancelled'?'Cancelled':order.status==='Returned'?'Returned':order.settled?'Collection recorded':order.payment==='COD'?'Payment on delivery':'Payment not confirmed';
  const details='Order: '+order.number+'\nPayment: '+order.payment+'\nStatus: '+status;
  text(business,left,135,260);text(details,320,135,233,10,'right');
  doc.y=135+Math.max(height(business,260),height(details,233))+22;
  section('BILL TO');
  const billed=customer?.name||'Customer';
  const phone=customer?.phone||'—';
  let y=doc.y;
  text('Customer',left,y,260,9);text('Phone',320,y,233,9);
  y+=16;text(billed,left,y,260,11);text(phone,320,y,233,11);
  doc.y=y+Math.max(height(billed,260,11),height(phone,233,11))+12;
  const address=[customer?.address,customer?.city].filter(Boolean).join(', ')||'—';
  y=space(height(address,width,11)+40);text('Delivery address',left,y,width,9);text(address,left,y+16,width,11);doc.y=y+16+height(address,width,11)+22;
  section('ITEMS');
  const tableHeader=()=>{const y=space(33);doc.rect(left,y,width,28).fill('#f8f4f1');doc.fillColor(muted);text('Item',left+7,y+6,250,10);text('Qty',left+270,y+6,35,10,'center');text('Unit price',left+312,y+6,90,10,'right');text('Amount',left+409,y+6,95,10,'right');doc.fillColor(color);doc.y=y+30;};
  tableHeader();
  for(const item of order.items){
    const product=state.products.find(row=>row.id===item.productId);
    const label=product?.name||'Product';
    const detail=[product?.brand,product?.size].filter(Boolean).join(' · ');
    const rowHeight=Math.max(height(label,250,10)+height(detail,250,9)+14,34);
    if(doc.y+rowHeight>bottom){doc.addPage();doc.y=42;tableHeader();}
    const y=doc.y;
    text(label,left+7,y+7,250);doc.fillColor(muted);text(detail,left+7,y+7+height(label,250),250,9);doc.fillColor(color);
    text(String(item.qty),left+270,y+7,35,10,'center');text(taka(item.price),left+312,y+7,90,10,'right');text(taka(item.price*item.qty),left+409,y+7,95,10,'right');
    doc.moveTo(left,y+rowHeight).lineTo(left+width,y+rowHeight).strokeColor('#ece5e0').stroke();doc.y=y+rowHeight;
  }
  doc.y+=16;
  const totals:[string,number][]=[['Subtotal',order.items.reduce((sum,item)=>sum+item.qty*item.price,0)]];
  if(order.discount>0)totals.push(['Discount',-order.discount]);
  totals.push(['Delivery',order.deliveryCharge],['Total',total(order)]);
  y=space(totals.length*28+16);
  for(const [label,value] of totals){if(label==='Total'){doc.rect(300,y,253,28).fill('#f8f2ee');doc.fillColor(accent);}text(label,308,y+6,100,11);text(taka(value),410,y+6,135,11,'right');doc.fillColor(color);y+=28;}
  doc.y=y+20;
  const paragraph=(title:string,value:string)=>{if(!value)return;section(title);text(value,left,doc.y,width,10);doc.y+=16;};
  paragraph('RETURNS AND EXCHANGES',profile.returnPolicy);
  paragraph('ALOYRI',profile.invoiceFooter||'Thank you for choosing ALOYRI.');
  text([profile.phone,profile.email].filter(Boolean).join(' · ')||'Let Your Skin Glow.',left,space(26),width,9);
  const pages=doc.bufferedPageRange();
  for(let i=0;i<pages.count;i++){doc.switchToPage(pages.start+i);doc.fillColor(muted);text('Page '+(i+1)+' of '+pages.count,left,788,width,8,'right');}
  doc.end();
  return output;
}
