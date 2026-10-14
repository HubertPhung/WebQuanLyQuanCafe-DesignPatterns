import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
async function favorites():Promise<string[]> {try{return JSON.parse((await cookies()).get('dalatcafe-favorites')?.value??'[]')}catch{return []}}
export async function GET(){return NextResponse.json(await favorites())}
export async function POST(req:NextRequest){
 if(req.headers.get('sec-fetch-site')!=='same-origin'&&req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Invalid origin'},{status:403})
 try {const {id}=await req.json();if(typeof id!=='string'||!/^gid:\/\/shopify\/Product\/\d+$/.test(id))throw new Error('Invalid product');const old=await favorites();const next=old.includes(id)?old.filter(x=>x!==id):[...old,id].slice(-40);(await cookies()).set('dalatcafe-favorites',JSON.stringify(next),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:31536000});return NextResponse.json(next)}catch{return NextResponse.json({error:'Unable to save favorite'},{status:400})}
}
