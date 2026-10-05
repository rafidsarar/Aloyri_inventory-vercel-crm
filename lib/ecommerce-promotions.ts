import { z } from 'zod';

export const ecommercePromotionInputSchema=z.object({
  name:z.string().trim().min(2).max(120),
  code:z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/).optional().default(''),
  description:z.string().trim().max(500).optional().default(''),
  kind:z.enum(['percentage','fixed']),
  value:z.number().min(0).max(1000000),
  minimumSubtotal:z.number().min(0).max(10000000).optional().default(0),
  startsAt:z.string().trim().max(40).optional().default(''),
  endsAt:z.string().trim().max(40).optional().default(''),
  usageLimit:z.number().int().positive().max(1000000).nullable().optional().default(null),
  targetType:z.enum(['all','products','categories']).optional().default('all'),
  targetIds:z.array(z.string().trim().min(1).max(120)).max(200).optional().default([]),
  freeShipping:z.boolean().optional().default(false),
  badgeText:z.string().trim().max(40).optional().default(''),
  priority:z.number().int().min(-1000).max(1000).optional().default(0),
  active:z.boolean().optional().default(true)
}).strict().superRefine((promotion,ctx)=>{
  if(promotion.kind==='percentage'&&promotion.value>100)
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['value'],message:'Percentage discount cannot exceed 100%.'});
  if(promotion.value<=0&&!promotion.freeShipping)
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['value'],message:'Enter a discount value or enable free shipping.'});
  if(promotion.startsAt&&Number.isNaN(Date.parse(promotion.startsAt)))
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['startsAt'],message:'Start date is invalid.'});
  if(promotion.endsAt&&Number.isNaN(Date.parse(promotion.endsAt)))
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['endsAt'],message:'End date is invalid.'});
  if(promotion.startsAt&&promotion.endsAt&&Date.parse(promotion.endsAt)<=Date.parse(promotion.startsAt))
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['endsAt'],message:'End date must be after the start date.'});
  if(promotion.targetType!=='all'&&promotion.targetIds.length===0)
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['targetIds'],message:'Choose at least one promotion target.'});
});

export const ecommercePromotionQuoteInputSchema=z.object({
  items:z.array(z.object({
    productId:z.string().trim().min(1).max(100),
    qty:z.number().int().min(1).max(100)
  }).strict()).min(1).max(50),
  deliveryZone:z.enum(['inside-dhaka','outside-dhaka']).optional(),
  code:z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/).optional().default('')
}).strict();

export type EcommercePromotionInput=z.infer<typeof ecommercePromotionInputSchema>;
export type EcommercePromotionQuoteInput=z.infer<typeof ecommercePromotionQuoteInputSchema>;

export type EcommercePromotion=EcommercePromotionInput&{
  id:string;
  code:string;
  usedCount:number;
  createdAt:string;
  updatedAt:string;
};

export type PromotionLine={
  productId:string;
  category:string;
  qty:number;
  price:number;
};

export type EcommercePromotionQuote={
  productsSubtotal:number;
  discount:number;
  discountedSubtotal:number;
  deliveryChargeBeforeDiscount:number;
  shippingDiscount:number;
  deliveryCharge:number;
  total:number;
  savings:number;
  requestedCode:string;
  codeApplied:boolean;
  promotion:null|{
    id:string;
    name:string;
    code:string;
    badgeText:string;
    kind:'percentage'|'fixed';
    value:number;
    freeShipping:boolean;
  };
};

const rounded=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
export const normalizePromotionCode=(value:string)=>value.trim().toUpperCase();

export function promotionIsLive(promotion:EcommercePromotion,now=new Date()){
  if(!promotion.active)return false;
  const time=now.getTime();
  if(promotion.startsAt&&Date.parse(promotion.startsAt)>time)return false;
  if(promotion.endsAt&&Date.parse(promotion.endsAt)<=time)return false;
  if(promotion.usageLimit!==null&&promotion.usedCount>=promotion.usageLimit)return false;
  return true;
}

function lineMatchesPromotion(line:PromotionLine,promotion:EcommercePromotion){
  if(promotion.targetType==='all')return true;
  if(promotion.targetType==='products')return promotion.targetIds.includes(line.productId);
  return promotion.targetIds.includes(line.category);
}

function savingsForPromotion(
  promotion:EcommercePromotion,
  lines:PromotionLine[],
  productsSubtotal:number,
  deliveryCharge:number
){
  if(productsSubtotal+0.0001<promotion.minimumSubtotal)return null;
  const eligibleSubtotal=rounded(lines
    .filter(line=>lineMatchesPromotion(line,promotion))
    .reduce((sum,line)=>sum+line.price*line.qty,0));
  if(eligibleSubtotal<=0)return null;

  const merchandiseDiscount=promotion.kind==='percentage'
    ? rounded(Math.min(eligibleSubtotal,eligibleSubtotal*(promotion.value/100)))
    : rounded(Math.min(eligibleSubtotal,promotion.value));
  const shippingDiscount=promotion.freeShipping?rounded(deliveryCharge):0;
  const savings=rounded(merchandiseDiscount+shippingDiscount);
  if(savings<=0)return null;
  return {merchandiseDiscount,shippingDiscount,savings};
}

export function evaluatePromotionQuote(input:{
  promotions:EcommercePromotion[];
  lines:PromotionLine[];
  deliveryCharge:number;
  code?:string;
  now?:Date;
}):EcommercePromotionQuote{
  const now=input.now||new Date();
  const productsSubtotal=rounded(input.lines.reduce((sum,line)=>sum+line.price*line.qty,0));
  const deliveryChargeBeforeDiscount=rounded(Math.max(0,input.deliveryCharge));
  const requestedCode=normalizePromotionCode(input.code||'');
  const live=input.promotions.filter(promotion=>promotionIsLive(promotion,now));
  const automatic=live.filter(promotion=>!promotion.code);

  let coupon:EcommercePromotion|undefined;
  if(requestedCode){
    const configured=input.promotions.find(
      promotion=>normalizePromotionCode(promotion.code)===requestedCode
    );
    if(!configured)throw new Error('PROMOTION_CODE_INVALID');
    if(!promotionIsLive(configured,now))throw new Error('PROMOTION_NOT_AVAILABLE');
    const candidate=savingsForPromotion(configured,input.lines,productsSubtotal,deliveryChargeBeforeDiscount);
    if(!candidate)throw new Error('PROMOTION_NOT_ELIGIBLE');
    coupon=configured;
  }

  const candidates=[...automatic,...(coupon?[coupon]:[])]
    .map(promotion=>({
      promotion,
      savings:savingsForPromotion(promotion,input.lines,productsSubtotal,deliveryChargeBeforeDiscount)
    }))
    .filter((entry):entry is {promotion:EcommercePromotion;savings:{merchandiseDiscount:number;shippingDiscount:number;savings:number}}=>Boolean(entry.savings))
    .sort((a,b)=>
      b.savings.savings-a.savings.savings||
      b.promotion.priority-a.promotion.priority||
      a.promotion.name.localeCompare(b.promotion.name)
    );

  const selected=candidates[0];
  if(!selected){
    const total=rounded(productsSubtotal+deliveryChargeBeforeDiscount);
    return {
      productsSubtotal,
      discount:0,
      discountedSubtotal:productsSubtotal,
      deliveryChargeBeforeDiscount,
      shippingDiscount:0,
      deliveryCharge:deliveryChargeBeforeDiscount,
      total,
      savings:0,
      requestedCode,
      codeApplied:false,
      promotion:null
    };
  }

  const discount=selected.savings.merchandiseDiscount;
  const shippingDiscount=selected.savings.shippingDiscount;
  const discountedSubtotal=rounded(Math.max(0,productsSubtotal-discount));
  const deliveryCharge=rounded(Math.max(0,deliveryChargeBeforeDiscount-shippingDiscount));
  const total=rounded(discountedSubtotal+deliveryCharge);
  return {
    productsSubtotal,
    discount,
    discountedSubtotal,
    deliveryChargeBeforeDiscount,
    shippingDiscount,
    deliveryCharge,
    total,
    savings:rounded(discount+shippingDiscount),
    requestedCode,
    codeApplied:Boolean(coupon&&selected.promotion.id===coupon.id),
    promotion:{
      id:selected.promotion.id,
      name:selected.promotion.name,
      code:selected.promotion.code,
      badgeText:selected.promotion.badgeText,
      kind:selected.promotion.kind,
      value:selected.promotion.value,
      freeShipping:selected.promotion.freeShipping
    }
  };
}

export function catalogPromotionForProduct(
  promotions:EcommercePromotion[],
  product:{id:string;category:string;price:number},
  now=new Date()
){
  const lines:[PromotionLine]=[{productId:product.id,category:product.category,qty:1,price:product.price}];
  const candidates=promotions
    .filter(promotion=>
      !promotion.code&&
      promotion.kind==='percentage'&&
      promotionIsLive(promotion,now)
    )
    .map(promotion=>({
      promotion,
      result:savingsForPromotion(promotion,lines,product.price,0)
    }))
    .filter((entry):entry is {promotion:EcommercePromotion;result:{merchandiseDiscount:number;shippingDiscount:number;savings:number}}=>Boolean(entry.result))
    .sort((a,b)=>
      b.result.savings-a.result.savings||
      b.promotion.priority-a.promotion.priority
    );
  const selected=candidates[0];
  if(!selected)return null;
  return {
    promotionId:selected.promotion.id,
    salePrice:rounded(Math.max(0,product.price-selected.result.merchandiseDiscount)),
    badgeText:selected.promotion.badgeText||selected.promotion.name
  };
}
