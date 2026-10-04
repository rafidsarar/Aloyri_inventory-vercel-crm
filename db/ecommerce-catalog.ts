import { database } from './raw.ts';
import {
  fixedBusinessName,
  stateSchema,
  stockPosition,
  validateRelations,
  type Product
} from '../lib/crm.ts';

type WorkspaceRow={data:string;updated_at:string};

export type PublicCatalogProduct={
  id:string;
  name:string;
  brand:string;
  size:string;
  category:string;
  price:number;
  active:boolean;
  availableStock:number;
};

export function publicCatalogProduct(
  product:Pick<Product,'id'|'name'|'brand'|'size'|'category'|'price'|'active'>,
  availableStock:number
):PublicCatalogProduct{
  return {
    id:product.id,
    name:product.name,
    brand:product.brand,
    size:product.size,
    category:product.category,
    price:product.price,
    active:product.active,
    availableStock:Math.max(0,Math.floor(availableStock))
  };
}

export async function readEcommerceCatalog(ownerId:string){
  const row=await database().prepare(
    'SELECT data,updated_at FROM crm_workspaces WHERE owner_id=?'
  ).bind(ownerId).first<WorkspaceRow>();
  if(!row)throw new Error('Workspace not found.');

  const state=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
  validateRelations(state,{skipOrderNumberUniqueness:true});

  const products=state.products.map(product=>
    publicCatalogProduct(product,stockPosition(state,product.id).available)
  );

  return {
    generatedAt:new Date().toISOString(),
    workspaceUpdatedAt:row.updated_at,
    products
  };
}
